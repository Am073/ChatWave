const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const settings = require('./src/config/settings');

// Import routers
const authRouter = require('./src/routes/auth.routes');
const chatRouter = require('./src/routes/chat.routes');
const uploadRouter = require('./src/routes/upload.routes');
const announcementsRouter = require('./src/routes/announcements.routes');
const calendarRouter = require('./src/routes/calendar.routes');
const adminRouter = require('./src/routes/admin.routes');

const app = express();

// Apply security and logging middleware
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));

// CORS config (explicit origin, credentials support)
app.use(cors({
  origin: settings.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ChatWave is running', version: '2.0.0' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ChatWave is running', version: '2.0.0' });
});

// Mount routers under /api
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/admin', adminRouter);

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('💥 Global Error Handler:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  return res.status(status).json({
    error: message,
    stack: settings.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;
