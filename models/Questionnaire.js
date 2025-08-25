const mongoose = require('mongoose');

const questionResponseSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true
  },
  questionText: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['Plan', 'Do', 'Check', 'Act'],
    required: true
  },
  clause: {
    type: String,
    required: true
  },
  weight: {
    type: Number,
    required: true
  },
  critical: {
    type: Boolean,
    default: false
  },
  response: {
    type: String,
    enum: ['Oui', 'Non', 'Partiellement'],
    required: true
  },
  score: {
    type: Number,
    required: true
  }
});

const questionnaireSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  responses: [questionResponseSchema],
  overallScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  categoryScores: {
    Plan: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    Do: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    Check: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    Act: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    }
  },
  maturityLevel: {
    level: {
      type: String,
      enum: ['Critique', 'Basique', 'Intermédiaire', 'Avancé', 'Excellence'],
      required: true
    },
    color: {
      type: String,
      enum: ['danger', 'secondary', 'warning', 'info', 'success'],
      required: true
    },
    description: {
      type: String,
      required: true
    }
  },
  majorNonConformities: [{
    question: {
      type: String,
      required: true
    },
    clause: {
      type: String,
      required: true
    },
    impact: {
      type: String,
      required: true
    }
  }],
  totalQuestions: {
    type: Number,
    required: true
  },
  answeredQuestions: {
    type: Number,
    required: true
  },
  completionTime: {
    type: Number, // in seconds
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'completed', 'archived'],
    default: 'completed'
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for calculating completion percentage
questionnaireSchema.virtual('completionPercentage').get(function() {
  return this.totalQuestions > 0 ? (this.answeredQuestions / this.totalQuestions) * 100 : 0;
});

// Virtual for checking if questionnaire has critical issues
questionnaireSchema.virtual('hasCriticalIssues').get(function() {
  return this.majorNonConformities.length > 0;
});

// Indexes for better query performance
questionnaireSchema.index({ userId: 1, createdAt: -1 });
questionnaireSchema.index({ overallScore: -1 });
questionnaireSchema.index({ 'maturityLevel.level': 1 });
questionnaireSchema.index({ status: 1 });

// Pre-save middleware to calculate scores
questionnaireSchema.pre('save', function(next) {
  if (this.isModified('responses')) {
    // Calculate overall score
    const totalWeight = this.responses.reduce((sum, r) => sum + r.weight, 0);
    const totalScore = this.responses.reduce((sum, r) => sum + r.score, 0);
    this.overallScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100 * 10) / 10 : 0;
    
    // Calculate category scores
    const categoryScores = { Plan: 0, Do: 0, Check: 0, Act: 0 };
    const categoryWeights = { Plan: 0, Do: 0, Check: 0, Act: 0 };
    
    this.responses.forEach(response => {
      categoryScores[response.category] += response.score;
      categoryWeights[response.category] += response.weight;
    });
    
    Object.keys(categoryScores).forEach(category => {
      this.categoryScores[category] = categoryWeights[category] > 0 ? 
        Math.round((categoryScores[category] / categoryWeights[category]) * 100) : 0;
    });
    
    // Determine maturity level
    this.maturityLevel = this.getMaturityLevel(this.overallScore);
    
    // Update counts
    this.totalQuestions = this.responses.length;
    this.answeredQuestions = this.responses.filter(r => r.response).length;
  }
  next();
});

// Instance method to get maturity level
questionnaireSchema.methods.getMaturityLevel = function(score) {
  if (score >= 90) {
    return {
      level: 'Excellence',
      color: 'success',
      description: 'SMSI mature et robuste'
    };
  } else if (score >= 75) {
    return {
      level: 'Avancé',
      color: 'info',
      description: 'SMSI bien structuré'
    };
  } else if (score >= 60) {
    return {
      level: 'Intermédiaire',
      color: 'warning',
      description: 'SMSI en développement'
    };
  } else if (score >= 40) {
    return {
      level: 'Basique',
      color: 'secondary',
      description: 'SMSI en phase initiale'
    };
  } else {
    return {
      level: 'Critique',
      color: 'danger',
      description: 'SMSI nécessite une attention immédiate'
    };
  }
};

// Static method to find questionnaires by user
questionnaireSchema.statics.findByUser = function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

// Static method to find questionnaires by maturity level
questionnaireSchema.statics.findByMaturityLevel = function(level) {
  return this.find({ 'maturityLevel.level': level });
};

// Static method to get average scores by category
questionnaireSchema.statics.getAverageScoresByCategory = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        avgPlan: { $avg: '$categoryScores.Plan' },
        avgDo: { $avg: '$categoryScores.Do' },
        avgCheck: { $avg: '$categoryScores.Check' },
        avgAct: { $avg: '$categoryScores.Act' },
        avgOverall: { $avg: '$overallScore' }
      }
    }
  ]);
};

module.exports = mongoose.model('Questionnaire', questionnaireSchema);



