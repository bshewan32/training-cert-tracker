// app.js
const express = require('express');
const mongoose = require('mongoose');
const certificateRoutes = require('./routes/certificates');
const userRoutes = require('./routes/users');
const cors = require('cors');
const adminRoutes = require('./routes/admin');
const setupRoutes = require('./routes/setup');
const templateRoutes = require('./routes/template'); // Add new template routes
require('dotenv').config({ path: '../.env' });
const positionRequirementsRoutes = require('./routes/positionRequirements'); 
const allowedOrigins = [
  'https://training-cert-tracker.vercel.app',
  'https://training-cert-tracker-d1lezctbu-bill-shewans-projects.vercel.app',
  // Add any other URLs where your frontend might be deployed
];

class TrainingCertApp {
  constructor() {
    this.app = express();
    this.PORT = process.env.PORT || 3000;
    this.initializeDatabase();
    this.configureMiddlewares();
    this.setupRoutes();
  }
  
  configureMiddlewares() {
    this.app.use(cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) === -1) {
          const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
          return callback(new Error(msg), false);
        }

        return callback(null, true);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }));

    this.app.options('*', cors()); // Enable preflight across-the-board
    
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  initializeDatabase() {
    mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));
  }

  setupRoutes() {
    this.app.use('/api/certificates', certificateRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/setup', setupRoutes);
    this.app.use('/api/setup/template', templateRoutes); 
    this.app.use('/api/positionRequirements', positionRequirementsRoutes);

    // Global error handler
    this.app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).send('Something broke!');
    });
  }

  start() {
    this.app.listen(this.PORT, () => {
      console.log(`Server running on port ${this.PORT}`);
    });
  }
}

const app = new TrainingCertApp();
app.start();

module.exports = app;

// const express = require('express');
// const mongoose = require('mongoose');
// const certificateRoutes = require('./routes/certificates');
// const userRoutes = require('./routes/users');
// const cors = require('cors');
// const adminRoutes = require('./routes/admin');
// const setupRoutes = require('./routes/setup');
// require('dotenv').config({ path: '../.env' });


// class TrainingCertApp {
//   constructor() {
//     this.app = express();
//     this.PORT = process.env.PORT || 3000;
//     this.initializeDatabase();
//     this.configureMiddlewares();
//     this.setupRoutes();
//   }
//   configureMiddlewares() {
//     this.app.use(cors({
//       origin: 'https://training-cert-tracker.vercel.app', // Your Vercel frontend URL
//       methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//       allowedHeaders: ['Content-Type', 'Authorization']
//     }));
    
//     this.app.use(express.json());
//     this.app.use(express.urlencoded({ extended: true }));
//   }

//   initializeDatabase() {
//     mongoose.connect(process.env.MONGODB_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true
//     })
//     .then(() => console.log('MongoDB connected successfully'))
//     .catch(err => console.error('MongoDB connection error:', err));
//   }

//   configureMiddlewares() {
//     this.app.use(express.json());
//     this.app.use(express.urlencoded({ extended: true }));
    
//     // CORS middleware
//     this.app.use((req, res, next) => {
//       res.header('Access-Control-Allow-Origin', '*');
//       res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//       res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
//       next();
//     });
//   }

//   setupRoutes() {
//     this.app.use('/api/certificates', certificateRoutes);
//     this.app.use('/api/users', userRoutes);
//     this.app.use('/api/admin', adminRoutes);
//     this.app.use('/api/setup', setupRoutes);

//     // Global error handler
//     this.app.use((err, req, res, next) => {
//       console.error(err.stack);
//       res.status(500).send('Something broke!');
//     });
//   }

//   start() {
//     this.app.listen(this.PORT, () => {
//       console.log(`Server running on port ${this.PORT}`);
//     });
//   }
// }

// const app = new TrainingCertApp();
// app.start();

// module.exports = app;