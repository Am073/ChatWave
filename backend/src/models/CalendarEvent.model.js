const mongoose = require('mongoose');

const CalendarEventSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  google_event_id: {
    type: String,
    default: null,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  start_time: {
    type: Date,
    required: true,
  },
  end_time: {
    type: Date,
    default: null,
  },
  event_date: {
    type: Date,
  },
  event_description: {
    type: String,
    trim: true,
  },
  source_chat_log: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatLog',
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('CalendarEvent', CalendarEventSchema);
