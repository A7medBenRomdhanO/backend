const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Task title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: [1000, 'Task description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    enum: ['Plan', 'Do', 'Check', 'Act'],
    required: true
  },
  priority: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Low'],
    required: true
  },
  estimatedEffort: {
    type: String,
    enum: ['1-2 days', '3-5 days', '1-2 weeks', '2-4 weeks', '1-3 months'],
    required: true
  },
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  resources: [{
    type: String,
    trim: true
  }],
  cost: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Very High'],
    required: true
  },
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Completed', 'On Hold'],
    default: 'Not Started'
  },
  startDate: Date,
  dueDate: Date,
  completedDate: Date,
  assignedTo: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
});

const milestoneSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Milestone title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Milestone description cannot exceed 500 characters']
  },
  targetDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed', 'Delayed'],
    default: 'Pending'
  },
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  completionPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
});

const roadmapSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questionnaireId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Questionnaire',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Roadmap title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: [1000, 'Roadmap description cannot exceed 1000 characters']
  },
  currentMaturityLevel: {
    type: String,
    enum: ['Critique', 'Basique', 'Intermédiaire', 'Avancé', 'Excellence'],
    required: true
  },
  targetMaturityLevel: {
    type: String,
    enum: ['Basique', 'Intermédiaire', 'Avancé', 'Excellence'],
    required: true
  },
  estimatedTimeline: {
    type: String,
    enum: ['3-6 months', '6-12 months', '1-2 years', '2+ years'],
    required: true
  },
  totalEstimatedCost: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Very High'],
    required: true
  },
  milestones: [milestoneSchema],
  tasks: [taskSchema],
  priorityAreas: [{
    category: {
      type: String,
      enum: ['Plan', 'Do', 'Check', 'Act'],
      required: true
    },
    currentScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    targetScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    improvementNeeded: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    }
  }],
  riskAssessment: [{
    risk: {
      type: String,
      required: true,
      trim: true
    },
    probability: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      required: true
    },
    impact: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      required: true
    },
    mitigation: {
      type: String,
      required: true,
      trim: true
    }
  }],
  complianceRequirements: [{
    requirement: {
      type: String,
      required: true,
      trim: true
    },
    deadline: Date,
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Completed', 'At Risk'],
      default: 'Not Started'
    },
    notes: String
  }],
  progress: {
    overall: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    byCategory: {
      Plan: { type: Number, min: 0, max: 100, default: 0 },
      Do: { type: Number, min: 0, max: 100, default: 0 },
      Check: { type: Number, min: 0, max: 100, default: 0 },
      Act: { type: Number, min: 0, max: 100, default: 0 }
    }
  },
  status: {
    type: String,
    enum: ['Draft', 'Active', 'On Hold', 'Completed', 'Archived'],
    default: 'Draft'
  },
  tags: [{
    type: String,
    trim: true
  }],
  version: {
    type: String,
    default: '1.0.0'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for calculating overall progress
roadmapSchema.virtual('overallProgress').get(function() {
  if (this.tasks.length === 0) return 0;
  
  const completedTasks = this.tasks.filter(task => task.status === 'Completed').length;
  return Math.round((completedTasks / this.tasks.length) * 100);
});

// Virtual for calculating progress by category
roadmapSchema.virtual('categoryProgress').get(function() {
  const categoryProgress = { Plan: 0, Do: 0, Check: 0, Act: 0 };
  
  this.tasks.forEach(task => {
    if (task.status === 'Completed') {
      categoryProgress[task.category] += 1;
    }
  });
  
  // Calculate percentage for each category
  const categoryCounts = { Plan: 0, Do: 0, Check: 0, Act: 0 };
  this.tasks.forEach(task => {
    categoryCounts[task.category] += 1;
  });
  
  Object.keys(categoryProgress).forEach(category => {
    categoryProgress[category] = categoryCounts[category] > 0 ? 
      Math.round((categoryProgress[category] / categoryCounts[category]) * 100) : 0;
  });
  
  return categoryProgress;
});

// Indexes for better query performance
roadmapSchema.index({ userId: 1, createdAt: -1 });
roadmapSchema.index({ status: 1 });
roadmapSchema.index({ currentMaturityLevel: 1 });
roadmapSchema.index({ targetMaturityLevel: 1 });

// Pre-save middleware to update progress
roadmapSchema.pre('save', function(next) {
  if (this.isModified('tasks')) {
    // Update overall progress
    this.progress.overall = this.overallProgress;
    
    // Update category progress
    this.progress.byCategory = this.categoryProgress;
    
    // Update last updated timestamp
    this.lastUpdated = new Date();
  }
  next();
});

// Instance method to add task
roadmapSchema.methods.addTask = function(taskData) {
  const task = new this.model('Task')(taskData);
  this.tasks.push(task);
  return this.save();
};

// Instance method to update task status
roadmapSchema.methods.updateTaskStatus = function(taskId, status) {
  const task = this.tasks.id(taskId);
  if (task) {
    task.status = status;
    if (status === 'Completed') {
      task.completedDate = new Date();
    }
    return this.save();
  }
  throw new Error('Task not found');
};

// Instance method to add milestone
roadmapSchema.methods.addMilestone = function(milestoneData) {
  const milestone = new this.model('Milestone')(milestoneData);
  this.milestones.push(milestone);
  return this.save();
};

// Static method to find roadmaps by user
roadmapSchema.statics.findByUser = function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

// Static method to find roadmaps by status
roadmapSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

// Static method to find roadmaps by maturity level
roadmapSchema.statics.findByMaturityLevel = function(level) {
  return this.find({ currentMaturityLevel: level });
};

module.exports = mongoose.model('Roadmap', roadmapSchema);



