// fix-employee-positions.js - Improved version
const mongoose = require('mongoose');
require('dotenv').config();

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

// Load models
const Employee = require('./src/models/Employee');
const Position = require('./src/models/Position');

async function fixEmployeePositions() {
  try {
    console.log('Starting employee position data fix...');
    
    // Get all employees
    const employees = await Employee.find({});
    console.log(`Found ${employees.length} employees to process`);
    
    // Get all positions for reference
    const positions = await Position.find({});
    console.log(`Found ${positions.length} positions for reference`);
    
    // Get default position if available
    let defaultPosition = null;
    if (positions.length > 0) {
      defaultPosition = positions[0]._id.toString();
      console.log(`Using default position if needed: ${defaultPosition} (${positions[0].title})`);
    } else {
      console.log('WARNING: No positions found in database!');
    }
    
    // Track results
    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process each employee
    for (const employee of employees) {
      console.log(`\nProcessing employee: ${employee.name} (${employee._id})`);
      
      try {
        let needsUpdate = false;
        
        // Check positions array
        let normalizedPositions = [];
        if (Array.isArray(employee.positions)) {
          console.log(`  - Original positions: ${JSON.stringify(employee.positions)}`);
          
          normalizedPositions = employee.positions
            .map(pos => {
              // Handle object references
              if (pos && typeof pos === 'object' && pos._id) {
                return pos._id.toString();
              }
              // Handle string IDs
              else if (pos && typeof pos === 'string') {
                return pos;
              }
              // Skip invalid positions
              else {
                console.log(`  - Skipping invalid position: ${pos}`);
                return null;
              }
            })
            .filter(Boolean); // Remove nulls
        } else {
          console.log('  - No positions array found, creating empty array');
          normalizedPositions = [];
          needsUpdate = true;
        }
        
        // Ensure all position IDs are valid
        const validPositions = normalizedPositions.filter(posId => {
          const exists = positions.some(p => p._id.toString() === posId);
          if (!exists) {
            console.log(`  - Removing invalid position ID: ${posId}`);
          }
          return exists;
        });
        
        // Check if any positions were removed due to being invalid
        if (validPositions.length !== normalizedPositions.length) {
          console.log(`  - Removed ${normalizedPositions.length - validPositions.length} invalid positions`);
          normalizedPositions = validPositions;
          needsUpdate = true;
        }
        
        // Handle empty positions array - critical fix
        if (normalizedPositions.length === 0) {
          console.log('  - CRITICAL: Employee has no positions!');
          if (defaultPosition) {
            console.log(`  - Adding default position: ${defaultPosition}`);
            normalizedPositions.push(defaultPosition);
            needsUpdate = true;
          } else {
            console.log('  - ERROR: No default position available to add!');
          }
        }
        
        // Fix primaryPosition
        let normalizedPrimaryPosition = null;
        
        if (employee.primaryPosition) {
          // Handle object references
          if (typeof employee.primaryPosition === 'object' && employee.primaryPosition._id) {
            normalizedPrimaryPosition = employee.primaryPosition._id.toString();
          } 
          // Handle string IDs
          else if (typeof employee.primaryPosition === 'string') {
            normalizedPrimaryPosition = employee.primaryPosition;
          }
          
          // Ensure primary position is valid
          const primaryIsValid = positions.some(p => 
            p._id.toString() === normalizedPrimaryPosition
          );
          
          if (!primaryIsValid) {
            console.log(`  - Primary position ${normalizedPrimaryPosition} is invalid`);
            normalizedPrimaryPosition = null;
            needsUpdate = true;
          }
        }
        
        // If no valid primary position, set to first position in normalized array
        if ((!normalizedPrimaryPosition || !normalizedPositions.includes(normalizedPrimaryPosition)) 
            && normalizedPositions.length > 0) {
          normalizedPrimaryPosition = normalizedPositions[0];
          console.log(`  - Setting primary position to: ${normalizedPrimaryPosition}`);
          needsUpdate = true;
        }
        
        // Update employee if needed
        if (needsUpdate) {
          console.log('  - Updating employee with normalized position data:');
          console.log(`    Positions: ${JSON.stringify(normalizedPositions)}`);
          console.log(`    Primary Position: ${normalizedPrimaryPosition}`);
          
          employee.positions = normalizedPositions;
          employee.primaryPosition = normalizedPrimaryPosition;
          
          await employee.save();
          console.log('  - Employee updated successfully');
          fixed++;
        } else {
          // Double-check for empty positions array
          if (normalizedPositions.length === 0) {
            console.log('  - WARNING: Employee still has no positions but no update was marked as needed!');
          } else {
            console.log('  - No updates needed for this employee');
          }
          skipped++;
        }
      } catch (err) {
        console.error(`  - Error processing employee ${employee.name}:`, err);
        errors++;
      }
    }
    
    console.log('\n--------- SUMMARY ---------');
    console.log(`Total employees: ${employees.length}`);
    console.log(`Fixed: ${fixed}`);
    console.log(`Skipped (no changes needed): ${skipped}`);
    console.log(`Errors: ${errors}`);
    
  } catch (err) {
    console.error('Error in fix script:', err);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the fix
fixEmployeePositions()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });