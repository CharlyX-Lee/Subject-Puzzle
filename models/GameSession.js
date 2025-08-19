const mongoose = require('mongoose');

const GameSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  level: {
    type: Number,
    default: 1
  },
  answer: {
    type: String,
    required: true
  },
  hint: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  questions: [{
    question: String,
    answer: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  maxQuestions: {
    type: Number,
    default: 20
  },
  rounds: {
    type: Number,
    default: 1
  },
  currentRound: {
    type: Number,
    default: 1
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  isWon: {
    type: Boolean,
    default: false
  },
  score: {
    type: Number,
    default: 0
  },
  hintRequested: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('GameSession', GameSessionSchema);