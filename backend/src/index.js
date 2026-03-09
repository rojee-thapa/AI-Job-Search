require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const { connectDB, runMigrations } = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { initCronJobs } = require('./jobs/cronJobs');

// Routes
const authRoutes = require('./routes/auth');
const resumeRoutes = require('./routes/resume');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const emailRoutes = require('./routes/email');
const interviewRoutes = require('./routes/interview');
const trackingRoutes = require('./routes/tracking');
const preferencesRoutes = require('./routes/preferences');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Security & Middleware ───────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ],
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// Static file serving for uploaded resumes
app.use('/uploads', express.static('uploads'));

// ─── Health Check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/preferences', preferencesRoutes);

// ─── Error Handler ───────────────────────────────────────────
app.use(errorHandler);

// ─── Bootstrap ───────────────────────────────────────────────
async function bootstrap() {
  try {
    await connectDB();
    logger.info('PostgreSQL connected');

    await runMigrations();
    logger.info('Database migrations applied');

    await connectRedis();
    logger.info('Redis connected');

    initCronJobs();
    logger.info('Cron jobs initialized');

    app.listen(PORT, () => {
      logger.info(`AI Job Agent backend running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();

module.exports = app;
