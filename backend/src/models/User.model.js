const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  college_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['student', 'faculty', 'admin'],
    default: 'student',
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
  is_active: {
    type: Boolean,
    default: true,
  },
  refresh_token_hash: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', UserSchema);
