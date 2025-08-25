const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private (Admin)
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build query
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const users = await User.find(query)
      .select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count
    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Failed to get users',
      details: 'Internal server error'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID (admin or self)
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // Users can only view their own profile, admins can view any profile
    if (req.params.id !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only view your own profile'
      });
    }

    const user = await User.findById(req.params.id)
      .select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        details: 'The requested user does not exist'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user',
      details: 'Internal server error'
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user profile (admin or self)
// @access  Private
router.put('/:id', authenticateToken, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('role')
    .optional()
    .isIn(['user', 'web-developer', 'admin'])
    .withMessage('Invalid role'),
  body('profile.company')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Company name cannot exceed 100 characters'),
  body('profile.position')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Position cannot exceed 100 characters'),
  body('profile.phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters'),
  body('profile.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters'),
  body('profile.industry')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Industry cannot exceed 100 characters'),
  body('preferences.language')
    .optional()
    .isIn(['fr', 'en'])
    .withMessage('Invalid language preference'),
  body('preferences.notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be a boolean'),
  body('preferences.notifications.push')
    .optional()
    .isBoolean()
    .withMessage('Push notification preference must be a boolean')
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

    // Users can only update their own profile, admins can update any profile
    if (req.params.id !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only update your own profile'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        details: 'The requested user does not exist'
      });
    }

    const { name, role, profile, preferences } = req.body;

    // Update fields
    if (name !== undefined) user.name = name;
    if (role !== undefined && req.user.role === 'admin') user.role = role; // Only admins can change roles
    if (profile !== undefined) user.profile = { ...user.profile, ...profile };
    if (preferences !== undefined) user.preferences = { ...user.preferences, ...preferences };

    await user.save();

    res.json({
      success: true,
      message: 'User profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile: user.profile,
        preferences: user.preferences,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Failed to update user profile',
      details: 'Internal server error'
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private (Admin)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        error: 'Cannot delete own account',
        details: 'You cannot delete your own admin account'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        details: 'The requested user does not exist'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      details: 'Internal server error'
    });
  }
});

// @route   PUT /api/users/:id/password
// @desc    Change user password (admin or self)
// @access  Private
router.put('/:id/password', authenticateToken, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number')
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

    // Users can only change their own password, admins can change any password
    if (req.params.id !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only change your own password'
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        details: 'The requested user does not exist'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Password change failed',
        details: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Failed to change password',
      details: 'Internal server error'
    });
  }
});

// @route   GET /api/users/stats/summary
// @desc    Get user statistics summary (admin only)
// @access  Private (Admin)
router.get('/stats/summary', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          verifiedUsers: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
          unverifiedUsers: { $sum: { $cond: ['$isEmailVerified', 0, 1] } },
          lockedUsers: { $sum: { $cond: ['$isLocked', 1, 0] } }
        }
      }
    ]);

    // Get role distribution
    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get users by creation date (last 12 months)
    const monthlyRegistrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const summary = stats[0] || {
      totalUsers: 0,
      verifiedUsers: 0,
      unverifiedUsers: 0,
      lockedUsers: 0
    };

    res.json({
      success: true,
      summary,
      roleDistribution,
      monthlyRegistrations
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: 'Failed to get user statistics',
      details: 'Internal server error'
    });
  }
});

// @route   POST /api/users/:id/lock
// @desc    Lock/unlock user account (admin only)
// @access  Private (Admin)
router.post('/:id/lock', authenticateToken, requireRole('admin'), [
  body('locked')
    .isBoolean()
    .withMessage('Locked status must be a boolean')
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

    // Prevent admin from locking themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        error: 'Cannot lock own account',
        details: 'You cannot lock your own admin account'
      });
    }

    const { locked } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        details: 'The requested user does not exist'
      });
    }

    if (locked) {
      // Lock account
      user.lockUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Lock for 1 year
      user.loginAttempts = 5; // Set to trigger lock
    } else {
      // Unlock account
      user.lockUntil = undefined;
      user.loginAttempts = 0;
    }

    await user.save();

    res.json({
      success: true,
      message: `User account ${locked ? 'locked' : 'unlocked'} successfully`
    });

  } catch (error) {
    console.error('Lock/unlock user error:', error);
    res.status(500).json({
      error: 'Failed to update user lock status',
      details: 'Internal server error'
    });
  }
});

module.exports = router;



