const express = require('express');
const { body, validationResult } = require('express-validator');
const Roadmap = require('../models/Roadmap');
const Questionnaire = require('../models/Questionnaire');
const { authenticateToken, requireOwnershipOrAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/roadmaps
// @desc    Create a new roadmap based on questionnaire results
// @access  Private
router.post('/', authenticateToken, [
  body('questionnaireId')
    .isMongoId()
    .withMessage('Valid questionnaire ID is required'),
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('targetMaturityLevel')
    .isIn(['Basique', 'Intermédiaire', 'Avancé', 'Excellence'])
    .withMessage('Invalid target maturity level'),
  body('estimatedTimeline')
    .isIn(['3-6 months', '6-12 months', '1-2 years', '2+ years'])
    .withMessage('Invalid estimated timeline'),
  body('totalEstimatedCost')
    .isIn(['Low', 'Medium', 'High', 'Very High'])
    .withMessage('Invalid estimated cost')
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

    const { 
      questionnaireId, 
      title, 
      description, 
      targetMaturityLevel, 
      estimatedTimeline, 
      totalEstimatedCost 
    } = req.body;

    // Verify questionnaire exists and belongs to user
    const questionnaire = await Questionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({
        error: 'Questionnaire not found',
        details: 'The specified questionnaire does not exist'
      });
    }

    if (questionnaire.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only create roadmaps from your own questionnaires'
      });
    }

    // Generate priority areas based on questionnaire results
    const priorityAreas = Object.entries(questionnaire.categoryScores).map(([category, currentScore]) => {
      const targetScore = Math.min(100, currentScore + 20); // Aim for 20% improvement
      return {
        category,
        currentScore,
        targetScore,
        improvementNeeded: targetScore - currentScore
      };
    });

    // Generate initial tasks based on non-conformities and low scores
    const initialTasks = [];
    
    // Add tasks for major non-conformities
    questionnaire.majorNonConformities.forEach((nc, index) => {
      initialTasks.push({
        title: `Resolve: ${nc.question}`,
        description: `Address the non-conformity identified in ${nc.clause}. ${nc.impact}`,
        category: questionnaire.responses.find(r => r.clause === nc.clause)?.category || 'Plan',
        priority: 'Critical',
        estimatedEffort: '1-2 weeks',
        cost: 'Medium',
        status: 'Not Started'
      });
    });

    // Add tasks for areas with low scores
    Object.entries(questionnaire.categoryScores).forEach(([category, score]) => {
      if (score < 60) {
        initialTasks.push({
          title: `Improve ${category} Category Score`,
          description: `Current score: ${score}%. Focus on implementing controls and processes to improve this category.`,
          category,
          priority: score < 40 ? 'High' : 'Medium',
          estimatedEffort: '2-4 weeks',
          cost: 'Medium',
          status: 'Not Started'
        });
      }
    });

    // Generate initial milestones
    const initialMilestones = [
      {
        title: 'Initial Assessment Complete',
        description: 'Questionnaire completed and initial roadmap created',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'Completed',
        tasks: []
      },
      {
        title: 'Critical Issues Resolved',
        description: 'All major non-conformities addressed',
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        status: 'Pending',
        tasks: []
      },
      {
        title: 'Target Maturity Level Achieved',
        description: `Reach ${targetMaturityLevel} maturity level`,
        targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        status: 'Pending',
        tasks: []
      }
    ];

    // Generate risk assessment
    const riskAssessment = [
      {
        risk: 'Resource constraints affecting implementation timeline',
        probability: 'Medium',
        impact: 'High',
        mitigation: 'Secure necessary resources and budget approval early in the process'
      },
      {
        risk: 'Staff resistance to new security processes',
        probability: 'Medium',
        impact: 'Medium',
        mitigation: 'Provide comprehensive training and change management support'
      },
      {
        risk: 'External dependencies delaying progress',
        probability: 'Low',
        impact: 'Medium',
        mitigation: 'Establish clear timelines and regular communication with external parties'
      }
    ];

    // Generate compliance requirements
    const complianceRequirements = [
      {
        requirement: 'Implement basic security controls',
        deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months
        status: 'Not Started',
        notes: 'Focus on essential controls first'
      },
      {
        requirement: 'Establish monitoring and review processes',
        deadline: new Date(Date.now() + 270 * 24 * 60 * 60 * 1000), // 9 months
        status: 'Not Started',
        notes: 'Implement regular review cycles'
      },
      {
        requirement: 'Achieve target maturity level',
        deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        status: 'Not Started',
        notes: 'Final milestone for initial implementation'
      }
    ];

    // Create roadmap
    const roadmap = new Roadmap({
      userId: req.user._id,
      questionnaireId,
      title,
      description: description || `Personalized roadmap to achieve ${targetMaturityLevel} maturity level`,
      currentMaturityLevel: questionnaire.maturityLevel.level,
      targetMaturityLevel,
      estimatedTimeline,
      totalEstimatedCost,
      priorityAreas,
      tasks: initialTasks,
      milestones: initialMilestones,
      riskAssessment,
      complianceRequirements
    });

    await roadmap.save();

    res.status(201).json({
      success: true,
      message: 'Roadmap created successfully',
      roadmap: {
        id: roadmap._id,
        title: roadmap.title,
        currentMaturityLevel: roadmap.currentMaturityLevel,
        targetMaturityLevel: roadmap.targetMaturityLevel,
        estimatedTimeline: roadmap.estimatedTimeline,
        totalEstimatedCost: roadmap.totalEstimatedCost,
        progress: roadmap.progress,
        totalTasks: roadmap.tasks.length,
        completedTasks: roadmap.tasks.filter(t => t.status === 'Completed').length,
        createdAt: roadmap.createdAt
      }
    });

  } catch (error) {
    console.error('Create roadmap error:', error);
    res.status(500).json({
      error: 'Failed to create roadmap',
      details: 'Internal server error'
    });
  }
});

// @route   GET /api/roadmaps
// @desc    Get all roadmaps for the current user
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
    const roadmaps = await Roadmap.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-tasks -milestones') // Don't include full details for list view
      .populate('questionnaireId', 'overallScore categoryScores maturityLevel')
      .exec();

    // Get total count
    const total = await Roadmap.countDocuments(query);

    res.json({
      success: true,
      roadmaps,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get roadmaps error:', error);
    res.status(500).json({
      error: 'Failed to get roadmaps',
      details: 'Internal server error'
    });
  }
});

// @route   GET /api/roadmaps/:id
// @desc    Get a specific roadmap by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const roadmap = await Roadmap.findById(req.params.id)
      .populate('questionnaireId', 'overallScore categoryScores maturityLevel responses');

    if (!roadmap) {
      return res.status(404).json({
        error: 'Roadmap not found',
        details: 'The requested roadmap does not exist'
      });
    }

    // Check ownership
    if (roadmap.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only view your own roadmaps'
      });
    }

    res.json({
      success: true,
      roadmap
    });

  } catch (error) {
    console.error('Get roadmap error:', error);
    res.status(500).json({
      error: 'Failed to get roadmap',
      details: 'Internal server error'
    });
  }
});

// @route   PUT /api/roadmaps/:id
// @desc    Update a roadmap
// @access  Private
router.put('/:id', authenticateToken, [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('status')
    .optional()
    .isIn(['Draft', 'Active', 'On Hold', 'Completed', 'Archived'])
    .withMessage('Invalid status'),
  body('estimatedTimeline')
    .optional()
    .isIn(['3-6 months', '6-12 months', '1-2 years', '2+ years'])
    .withMessage('Invalid estimated timeline'),
  body('totalEstimatedCost')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Very High'])
    .withMessage('Invalid estimated cost')
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

    const roadmap = await Roadmap.findById(req.params.id);

    if (!roadmap) {
      return res.status(404).json({
        error: 'Roadmap not found',
        details: 'The requested roadmap does not exist'
      });
    }

    // Check ownership
    if (roadmap.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only update your own roadmaps'
      });
    }

    const { title, description, status, estimatedTimeline, totalEstimatedCost } = req.body;

    // Update fields
    if (title !== undefined) roadmap.title = title;
    if (description !== undefined) roadmap.description = description;
    if (status !== undefined) roadmap.status = status;
    if (estimatedTimeline !== undefined) roadmap.estimatedTimeline = estimatedTimeline;
    if (totalEstimatedCost !== undefined) roadmap.totalEstimatedCost = totalEstimatedCost;

    await roadmap.save();

    res.json({
      success: true,
      message: 'Roadmap updated successfully',
      roadmap: {
        id: roadmap._id,
        title: roadmap.title,
        status: roadmap.status,
        estimatedTimeline: roadmap.estimatedTimeline,
        totalEstimatedCost: roadmap.totalEstimatedCost,
        progress: roadmap.progress,
        updatedAt: roadmap.updatedAt
      }
    });

  } catch (error) {
    console.error('Update roadmap error:', error);
    res.status(500).json({
      error: 'Failed to update roadmap',
      details: 'Internal server error'
    });
  }
});

// @route   POST /api/roadmaps/:id/tasks
// @desc    Add a new task to a roadmap
// @access  Private
router.post('/:id/tasks', authenticateToken, [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Task title must be between 3 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Task description must be between 10 and 1000 characters'),
  body('category')
    .isIn(['Plan', 'Do', 'Check', 'Act'])
    .withMessage('Invalid category'),
  body('priority')
    .isIn(['Critical', 'High', 'Medium', 'Low'])
    .withMessage('Invalid priority'),
  body('estimatedEffort')
    .isIn(['1-2 days', '3-5 days', '1-2 weeks', '2-4 weeks', '1-3 months'])
    .withMessage('Invalid estimated effort'),
  body('cost')
    .isIn(['Low', 'Medium', 'High', 'Very High'])
    .withMessage('Invalid cost'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid due date format')
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

    const roadmap = await Roadmap.findById(req.params.id);

    if (!roadmap) {
      return res.status(404).json({
        error: 'Roadmap not found',
        details: 'The requested roadmap does not exist'
      });
    }

    // Check ownership
    if (roadmap.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only modify your own roadmaps'
      });
    }

    const taskData = req.body;
    if (taskData.dueDate) {
      taskData.dueDate = new Date(taskData.dueDate);
    }

    // Add task to roadmap
    await roadmap.addTask(taskData);

    res.json({
      success: true,
      message: 'Task added successfully',
      task: roadmap.tasks[roadmap.tasks.length - 1]
    });

  } catch (error) {
    console.error('Add task error:', error);
    res.status(500).json({
      error: 'Failed to add task',
      details: 'Internal server error'
    });
  }
});

// @route   PUT /api/roadmaps/:id/tasks/:taskId
// @desc    Update a task in a roadmap
// @access  Private
router.put('/:id/tasks/:taskId', authenticateToken, [
  body('status')
    .isIn(['Not Started', 'In Progress', 'Completed', 'On Hold'])
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

    const roadmap = await Roadmap.findById(req.params.id);

    if (!roadmap) {
      return res.status(404).json({
        error: 'Roadmap not found',
        details: 'The requested roadmap does not exist'
      });
    }

    // Check ownership
    if (roadmap.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only modify your own roadmaps'
      });
    }

    const { status } = req.body;

    // Update task status
    await roadmap.updateTaskStatus(req.params.taskId, status);

    res.json({
      success: true,
      message: 'Task status updated successfully'
    });

  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      error: 'Failed to update task',
      details: 'Internal server error'
    });
  }
});

// @route   DELETE /api/roadmaps/:id
// @desc    Delete a roadmap
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const roadmap = await Roadmap.findById(req.params.id);

    if (!roadmap) {
      return res.status(404).json({
        error: 'Roadmap not found',
        details: 'The requested roadmap does not exist'
      });
    }

    // Check ownership
    if (roadmap.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only delete your own roadmaps'
      });
    }

    await Roadmap.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Roadmap deleted successfully'
    });

  } catch (error) {
    console.error('Delete roadmap error:', error);
    res.status(500).json({
      error: 'Failed to delete roadmap',
      details: 'Internal server error'
    });
  }
});

// @route   GET /api/roadmaps/:id/progress
// @desc    Get roadmap progress details
// @access  Private
router.get('/:id/progress', authenticateToken, async (req, res) => {
  try {
    const roadmap = await Roadmap.findById(req.params.id)
      .select('progress tasks milestones priorityAreas');

    if (!roadmap) {
      return res.status(404).json({
        error: 'Roadmap not found',
        details: 'The requested roadmap does not exist'
      });
    }

    // Check ownership
    if (roadmap.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only view your own roadmaps'
      });
    }

    // Calculate additional progress metrics
    const taskProgress = {
      total: roadmap.tasks.length,
      completed: roadmap.tasks.filter(t => t.status === 'Completed').length,
      inProgress: roadmap.tasks.filter(t => t.status === 'In Progress').length,
      notStarted: roadmap.tasks.filter(t => t.status === 'Not Started').length,
      onHold: roadmap.tasks.filter(t => t.status === 'On Hold').length
    };

    const milestoneProgress = {
      total: roadmap.milestones.length,
      completed: roadmap.milestones.filter(m => m.status === 'Completed').length,
      inProgress: roadmap.milestones.filter(m => m.status === 'In Progress').length,
      pending: roadmap.milestones.filter(m => m.status === 'Pending').length,
      delayed: roadmap.milestones.filter(m => m.status === 'Delayed').length
    };

    res.json({
      success: true,
      progress: {
        overall: roadmap.progress.overall,
        byCategory: roadmap.progress.byCategory
      },
      taskProgress,
      milestoneProgress,
      priorityAreas: roadmap.priorityAreas
    });

  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      error: 'Failed to get progress',
      details: 'Internal server error'
    });
  }
});

module.exports = router;



