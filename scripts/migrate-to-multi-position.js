// scripts/migrate-to-multi-position.js
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Employee = require('../src/models/Employee');
const Certificate = require('../src/models/Certificate');
const Position = require('../src/models/Position');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Main migration function
const migrateToMultiPosition = async () => {
  console.log('Starting migration to multi-position schema...');
  
  try {
    // 1. Update Employee schema - transform single position to arrays of positions
    console.log('Updating employees...');
    const employees = await Employee.find({});
    
    for (const employee of employees) {
      // Only migrate employees with a position
      if (employee.position) {
        // Create a positions array with the current position
        employee.positions = [employee.position];
        employee.primaryPosition = employee.position;
        
        // Save the updated employee
        await employee.save();
        console.log(`Updated employee: ${employee.name}`);
      } else {
        console.log(`Employee ${employee.name} has no position, skipping`);
      }
    }
    
    console.log('Employee migration completed.');
    
    // 2. Update Certificate schema - ensure position references are ObjectIDs
    console.log('Updating certificates...');
    const certificates = await Certificate.find({});
    
    for (const certificate of certificates) {
      // If position is a string (title), find the corresponding position object
      if (typeof certificate.position === 'string') {
        // Find position by title
        const position = await Position.findOne({ title: certificate.position });
        
        if (position) {
          certificate.position = position._id;
          await certificate.save();
          console.log(`Updated certificate for ${certificate.staffMember} - ${certificate.certificateType}`);
        } else {
          console.log(`Position not found for certificate: ${certificate.position}, creating...`);
          
          // Create a new position if it doesn't exist
          const newPosition = new Position({
            title: certificate.position,
            department: 'Unknown',
            active: true
          });
          
          await newPosition.save();
          
          // Update certificate with new position ID
          certificate.position = newPosition._id;
          await certificate.save();
          console.log(`Created position and updated certificate for ${certificate.staffMember}`);
        }
      } else {
        console.log(`Certificate for ${certificate.staffMember} - ${certificate.certificateType} already has position ID`);
      }
    }
    
    console.log('Certificate migration completed.');
    
    console.log('Migration successful!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Run the migration
migrateToMultiPosition();