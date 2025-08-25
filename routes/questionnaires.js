const express = require('express');
const { body, validationResult } = require('express-validator');
const Questionnaire = require('../models/Questionnaire');
const { authenticateToken, requireOwnershipOrAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/questionnaires
// @desc    Submit a new questionnaire
// @access  Private
router.post('/', authenticateToken, [
  body('responses')
    .isArray({ min: 1 })
    .withMessage('At least one response is required'),
  body('responses.*.questionId')
    .notEmpty()
    .withMessage('Question ID is required for each response'),
  body('responses.*.questionText')
    .notEmpty()
    .withMessage('Question text is required for each response'),
  body('responses.*.category')
    .isIn(['Plan', 'Do', 'Check', 'Act'])
    .withMessage('Invalid category for response'),
  body('responses.*.clause')
    .notEmpty()
    .withMessage('Clause is required for each response'),
  body('responses.*.weight')
    .isNumeric()
    .withMessage('Weight must be a number'),
  body('responses.*.critical')
    .isBoolean()
    .withMessage('Critical must be a boolean'),
  body('responses.*.response')
    .isIn(['Oui', 'Non', 'Partiellement'])
    .withMessage('Response must be Oui, Non, or Partiellement'),
  body('completionTime')
    .optional()
    .isNumeric()
    .withMessage('Completion time must be a number'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { responses, completionTime, notes, tags } = req.body;

    // Calculate scores for each response
    const scoredResponses = responses.map(response => {
      let score = 0;
      if (response.response === 'Oui') {
        score = response.weight;
      } else if (response.response === 'Partiellement') {
        score = response.weight * 0.5;
      }
      // 'Non' gets 0 points
      
      return {
        ...response,
        score
      };
    });

    // Create questionnaire
    const questionnaire = new Questionnaire({
      userId: req.user._id,
      responses: scoredResponses,
      completionTime: completionTime || 0,
      notes: notes || '',
      tags: tags || []
    });

    await questionnaire.save();

    res.status(201).json({
      success: true,
      message: 'Questionnaire submitted successfully',
      questionnaire: {
        id: questionnaire._id,
        overallScore: questionnaire.overallScore,
        categoryScores: questionnaire.categoryScores,
        maturityLevel: questionnaire.maturityLevel,
        majorNonConformities: questionnaire.majorNonConformities,
        totalQuestions: questionnaire.totalQuestions,
        answeredQuestions: questionnaire.answeredQuestions,
        createdAt: questionnaire.createdAt
      }
    });

  } catch (error) {
    console.error('Submit questionnaire error:', error);
    res.status(500).json({
      error: 'Questionnaire submission failed',
      details: 'Internal server error'
    });
  }
});

// @route   GET /api/questionnaires
// @desc    Get all questionnaires for the current user
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build query
    const query = { userId: req.user._id };
    if (status) query.status = status;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const questionnaires = await Questionnaire.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-responses') // Don't include full responses for list view
      .exec();

    // Get total count
    const total = await Questionnaire.countDocuments(query);

    res.json({
      success: true,
      questionnaires,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get questionnaires error:', error);
    res.status(500).json({
      error: 'Failed to get questionnaires',
      details: 'Internal server error'
    });
  }
});

// @route   GET /api/questionnaires/:id
// @desc    Get a specific questionnaire by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const questionnaire = await Questionnaire.findById(req.params.id);

    if (!questionnaire) {
      return res.status(404).json({
        error: 'Questionnaire not found',
        details: 'The requested questionnaire does not exist'
      });
    }

    // Check ownership
    if (questionnaire.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only view your own questionnaires'
      });
    }

    res.json({
      success: true,
      questionnaire
    });

  } catch (error) {
    console.error('Get questionnaire error:', error);
    res.status(500).json({
      error: 'Failed to get questionnaire',
      details: 'Internal server error'
    });
  }
});

// @route   PUT /api/questionnaires/:id
// @desc    Update a questionnaire
// @access  Private
router.put('/:id', authenticateToken, [
  body('responses')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one response is required'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('status')
    .optional()
    .isIn(['draft', 'completed', 'archived'])
    .withMessage('Invalid status')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const questionnaire = await Questionnaire.findById(req.params.id);

    if (!questionnaire) {
      return res.status(404).json({
        error: 'Questionnaire not found',
        details: 'The requested questionnaire does not exist'
      });
    }

    // Check ownership
    if (questionnaire.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only update your own questionnaires'
      });
    }

    const { responses, notes, tags, status } = req.body;

    // Update fields
    if (responses) {
      // Recalculate scores if responses are updated
      const scoredResponses = responses.map(response => {
        let score = 0;
        if (response.response === 'Oui') {
          score = response.weight;
        } else if (response.response === 'Partiellement') {
          score = response.weight * 0.5;
        }
        return { ...response, score };
      });
      questionnaire.responses = scoredResponses;
    }

    if (notes !== undefined) questionnaire.notes = notes;
    if (tags !== undefined) questionnaire.tags = tags;
    if (status !== undefined) questionnaire.status = status;

    await questionnaire.save();

    res.json({
      success: true,
      message: 'Questionnaire updated successfully',
      questionnaire: {
        id: questionnaire._id,
        overallScore: questionnaire.overallScore,
        categoryScores: questionnaire.categoryScores,
        maturityLevel: questionnaire.maturityLevel,
        majorNonConformities: questionnaire.majorNonConformities,
        totalQuestions: questionnaire.totalQuestions,
        answeredQuestions: questionnaire.answeredQuestions,
        status: questionnaire.status,
        updatedAt: questionnaire.updatedAt
      }
    });

  } catch (error) {
    console.error('Update questionnaire error:', error);
    res.status(500).json({
      error: 'Failed to update questionnaire',
      details: 'Internal server error'
    });
  }
});

// @route   DELETE /api/questionnaires/:id
// @desc    Delete a questionnaire
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const questionnaire = await Questionnaire.findById(req.params.id);

    if (!questionnaire) {
      return res.status(404).json({
        error: 'Questionnaire not found',
        details: 'The requested questionnaire does not exist'
      });
    }

    // Check ownership
    if (questionnaire.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only delete your own questionnaires'
      });
    }

    await Questionnaire.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Questionnaire deleted successfully'
    });

  } catch (error) {
    console.error('Delete questionnaire error:', error);
    res.status(500).json({
      error: 'Failed to delete questionnaire',
      details: 'Internal server error'
    });
  }
});

// @route   GET /api/questionnaires/stats/summary
// @desc    Get questionnaire statistics summary for the current user
// @access  Private
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const stats = await Questionnaire.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          totalQuestionnaires: { $sum: 1 },
          averageScore: { $avg: '$overallScore' },
          highestScore: { $max: '$overallScore' },
          lowestScore: { $min: '$overallScore' },
          totalQuestions: { $sum: '$totalQuestions' },
          totalResponses: { $sum: '$answeredQuestions' }
        }
      }
    ]);

    // Get category averages
    const categoryStats = await Questionnaire.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          avgPlan: { $avg: '$categoryScores.Plan' },
          avgDo: { $avg: '$categoryScores.Do' },
          avgCheck: { $avg: '$categoryScores.Check' },
          avgAct: { $avg: '$categoryScores.Act' }
        }
      }
    ]);

    // Get maturity level distribution
    const maturityDistribution = await Questionnaire.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$maturityLevel.level',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const summary = stats[0] || {
      totalQuestionnaires: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      totalQuestions: 0,
      totalResponses: 0
    };

    const categoryAverages = categoryStats[0] || {
      avgPlan: 0,
      avgDo: 0,
      avgCheck: 0,
      avgAct: 0
    };

    res.json({
      success: true,
      summary: {
        ...summary,
        averageScore: Math.round(summary.averageScore * 10) / 10
      },
      categoryAverages: {
        Plan: Math.round(categoryAverages.avgPlan || 0),
        Do: Math.round(categoryAverages.avgDo || 0),
        Check: Math.round(categoryAverages.avgCheck || 0),
        Act: Math.round(categoryAverages.avgAct || 0)
      },
      maturityDistribution
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      details: 'Internal server error'
    });
  }
});

// @route   GET /api/questionnaires/stats/trends
// @desc    Get questionnaire score trends over time
// @access  Private
router.get('/stats/trends', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let dateFormat;
    let dateRange;

    switch (period) {
      case 'week':
        dateFormat = { $dateToString: { format: "%Y-%U", date: "$createdAt" } };
        dateRange = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000); // 12 weeks
        break;
      case 'month':
        dateFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
        dateRange = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000); // 12 months
        break;
      case 'quarter':
        dateFormat = { $dateToString: { format: "%Y-Q%q", date: "$createdAt" } };
        dateRange = new Date(Date.now() - 8 * 90 * 24 * 60 * 60 * 1000); // 8 quarters
        break;
      default:
        dateFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
        dateRange = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000);
    }

    const trends = await Questionnaire.aggregate([
      { $match: { userId: req.user._id, createdAt: { $gte: dateRange } } },
      {
        $group: {
          _id: dateFormat,
          averageScore: { $avg: '$overallScore' },
          count: { $sum: 1 },
          avgPlan: { $avg: '$categoryScores.Plan' },
          avgDo: { $avg: '$categoryScores.Do' },
          avgCheck: { $avg: '$categoryScores.Check' },
          avgAct: { $avg: '$categoryScores.Act' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      period,
      trends: trends.map(trend => ({
        period: trend._id,
        averageScore: Math.round(trend.averageScore * 10) / 10,
        count: trend.count,
        categoryScores: {
          Plan: Math.round(trend.avgPlan || 0),
          Do: Math.round(trend.avgDo || 0),
          Check: Math.round(trend.avgCheck || 0),
          Act: Math.round(trend.avgAct || 0)
        }
      }))
    });

  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({
      error: 'Failed to get trends',
      details: 'Internal server error'
    });
  }
});

module.exports = router;



