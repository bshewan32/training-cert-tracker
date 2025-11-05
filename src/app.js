// app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // let platform envs take precedence

// Routes
const certificateRoutes = require('./routes/certificates');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const setupRoutes = require('./routes/setup');
const templateRoutes = require('./routes/template');
const positionRequirementsRoutes = require('./routes/positionRequirements');

class TrainingCertApp {
  constructor() {
    this.app = express();
    this.PORT = process.env.PORT || 3000;

    this.initializeDatabase();
    this.configureMiddlewares();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  initializeDatabase() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI is not set');
      process.exit(1);
    }

    // Mongoose 7+ no longer needs legacy flags
    mongoose
      .connect(uri)
      .then(() => console.log('MongoDB connected successfully'))
      .catch((err) => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
      });

    // graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  }

  configureMiddlewares() {
    // trust proxy (Render/other hosts put proxy in front; helps with cookies if ever used)
    this.app.set('trust proxy', true);

    // robust CORS that works for prod + all vercel previews + localhost
    const corsOptions = {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // SSR, curl, server-to-server
        const ok =
          origin === 'https://training-cert-tracker.vercel.app' ||
          /\.vercel\.app$/.test(origin) ||
          /^http:\/\/localhost(?::\d+)?$/.test(origin);
        cb(ok ? null : new Error(`CORS blocked for origin: ${origin}`), ok);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Requested-With'],
      optionsSuccessStatus: 204,
      maxAge: 86400, // cache preflight 24h
    };

    // IMPORTANT: apply same options to normal and preflight
    this.app.use(cors(corsOptions));
    this.app.options('*', cors(corsOptions));

    // body parsers (needed before routes)
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // simple health endpoint (useful for Render pings)
    this.app.get('/api/health', (req, res) => {
      res.status(200).json({ ok: true, ts: new Date().toISOString() });
    });
  }

  setupRoutes() {
    // mount API routes AFTER CORS & body parsers
    this.app.use('/api/certificates', certificateRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/setup', setupRoutes);
    this.app.use('/api/setup/template', templateRoutes);
    this.app.use('/api/positionRequirements', positionRequirementsRoutes);
  }

  setupErrorHandling() {
    // central error handler — ensures CORS headers were already set
    // (don’t swallow specific status codes if your routes set them)
    this.app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      const code = err.status || err.statusCode || 500;
      res.status(code).json({
        message: err.message || 'Server error',
      });
    });
  }

  start() {
    this.app.listen(this.PORT, () => {
      console.log(`Server running on port ${this.PORT}`);
    });
  }
}

const appInstance = new TrainingCertApp();
appInstance.start();

module.exports = appInstance.app;
