const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  college_name: {
    type: String,
    required: true,
    trim: true,
  },
  department: {
    type: String,
    default: null,
    trim: true,
  },
  filename: {
    type: String,
    required: true,
    trim: true,
  },
  file_type: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  chunk_count: {
    type: Number,
    default: 0,
  },
  qdrant_ids: {
    type: [String],
    default: [],
  },
  error_message: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Document', DocumentSchema);
