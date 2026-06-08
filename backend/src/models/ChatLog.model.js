const mongoose = require('mongoose');

const ChatLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  college_name: {
    type: String,
    required: true,
    trim: true,
  },
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
  sources: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  session_id: {
    type: String,
    required: true,
    trim: true,
  },
  tokens_used: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ChatLog', ChatLogSchema);
