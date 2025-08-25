const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied', 
        details: 'No token provided' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ 
        error: 'Access denied', 
        details: 'User not found' 
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({ 
        error: 'Account locked', 
        details: 'Too many failed login attempts. Please try again later.' 
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired', 
        details: 'Please log in again' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token', 
        details: 'Please log in again' 
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: 'Authentication failed' 
    });
  }
};

// Middleware to verify refresh token
const authenticateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ 
        error: 'Access denied', 
        details: 'No refresh token provided' 
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Check if user exists
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ 
        error: 'Access denied', 
        details: 'User not found' 
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({ 
        error: 'Account locked', 
        details: 'Too many failed login attempts. Please try again later.' 
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Refresh token expired', 
        details: 'Please log in again' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid refresh token', 
        details: 'Please log in again' 
      });
    }
    
    console.error('Refresh token middleware error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: 'Authentication failed' 
    });
  }
};

// Middleware to check if user has required role
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Access denied', 
        details: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied', 
        details: 'Insufficient permissions' 
      });
    }

    next();
  };
};

// Middleware to check if user owns the resource or is admin
const requireOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Access denied', 
        details: 'Authentication required' 
      });
    }

    // Admin can access all resources
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (req.user._id.toString() === resourceUserId) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Access denied', 
      details: 'You can only access your own resources' 
    });
  };
};

// Middleware to rate limit authentication attempts
const rateLimitAuth = (req, res, next) => {
  // This is handled by express-rate-limit in server.js
  // Additional custom rate limiting can be added here if needed
  next();
};

module.exports = {
  authenticateToken,
  authenticateRefreshToken,
  requireRole,
  requireOwnershipOrAdmin,
  rateLimitAuth
};



