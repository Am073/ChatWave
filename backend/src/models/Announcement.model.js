const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  author: {
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
  title: {
    type: String,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['exam', 'fee', 'holiday', 'event', 'notice'],
    default: 'notice',
  },
  scope: {
    type: String,
    enum: ['college_wide', 'department'],
    default: 'college_wide',
  },
  is_private: {
    type: Boolean,
    default: false,
  },
  read_by: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('Announcement', AnnouncementSchema);
