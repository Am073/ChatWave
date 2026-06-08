const mongoose = require('mongoose');

const UserGoogleTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  access_token: {
    type: String,
    required: true,
  },
  refresh_token: {
    type: String,
    default: null,
  },
  expires_at: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('UserGoogleToken', UserGoogleTokenSchema);
