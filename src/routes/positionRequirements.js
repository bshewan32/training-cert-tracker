// src/routes/positionRequirements.js
const express = require('express');
const router = express.Router();
const PositionRequirement = require('../models/PositionRequirement');
const Position = require('../models/Position');
const { authenticateToken } = require('../controllers/middleware/auth');

// Get all position requirements
router.get('/', authenticateToken, async (req, res) => {
  try {
    const requirements = await PositionRequirement.find({ active: true })
      .populate('position')
      .sort({ position: 1, certificateType: 1 });
    
    res.json(requirements);
  } catch (error) {
    console.error('Error fetching position requirements:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get requirements for a specific position
router.get('/position/:positionId', authenticateToken, async (req, res) => {
  try {
    const requirements = await PositionRequirement.find({ 
      position: req.params.positionId,
      active: true 
    }).populate('position');
    
    res.json(requirements);
  } catch (error) {
    console.error('Error fetching position requirements:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create a new position requirement
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Check if position exists
    const position = await Position.findById(req.body.position);
    if (!position) {
      return res.status(404).json({ message: 'Position not found' });
    }
    
    // Create new requirement
    const requirement = new PositionRequirement({
      position: req.body.position,
      certificateType: req.body.certificateType,
      validityPeriod: req.body.validityPeriod || 12,
      isRequired: req.body.isRequired !== undefined ? req.body.isRequired : true,
      notes: req.body.notes
    });
    
    const savedRequirement = await requirement.save();
    
    // Return the saved requirement with position populated
    const populatedRequirement = await PositionRequirement.findById(savedRequirement._id)
      .populate('position');
    
    res.status(201).json(populatedRequirement);
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'This certificate type is already required for this position' 
      });
    }
    
    console.error('Error creating position requirement:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update a position requirement
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const updatedRequirement = await PositionRequirement.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          certificateType: req.body.certificateType,
          validityPeriod: req.body.validityPeriod,
          isRequired: req.body.isRequired,
          notes: req.body.notes
        }
      },
      { new: true }
    ).populate('position');
    
    if (!updatedRequirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }
    
    res.json(updatedRequirement);
  } catch (error) {
    console.error('Error updating position requirement:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete (deactivate) a position requirement
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const requirement = await PositionRequirement.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    
    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }
    
    res.json({ message: 'Requirement deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating position requirement:', error);
    res.status(500).json({ message: error.message });
  }
});

// Endpoint to get required certificates status for an employee
router.get('/employee/:employeeId', authenticateToken, async (req, res) => {
  try {
    // Get the employee with their position
    const Employee = require('../models/Employee');
    const Certificate = require('../models/Certificate');
    
    console.log('Employee ID provided:', req.params.employeeId);
    
    const employee = await Employee.findById(req.params.employeeId)
      .populate('positions')
      .populate('primaryPosition');
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Handle the case where primaryPosition might not be set
    let positionId = null;
    
    if (employee.primaryPosition) {
      // Handle both cases: when it's already populated or when it's just an ID
      positionId = typeof employee.primaryPosition === 'object' 
        ? employee.primaryPosition._id 
        : employee.primaryPosition;
    } else if (employee.positions && employee.positions.length > 0) {
      // Fallback to first position if primary is not set
      const firstPosition = employee.positions[0];
      positionId = typeof firstPosition === 'object' 
        ? firstPosition._id 
        : firstPosition;
    }

    if (!positionId) {
      return res.status(404).json({ message: 'Employee has no assigned positions' });
    }
    
    // Get all requirements for the employee's primary position
    const requirements = await PositionRequirement.find({
      position: positionId,
      active: true
    });
    
    // Get all certificates for this employee
    const certificates = await Certificate.find({
      staffMember: employee.name
    });
    
    // Map requirements to include certificate status
    const requirementsWithStatus = requirements.map(req => {
      // Find matching certificates
      const matchingCerts = certificates.filter(cert => 
        cert.certificateType === req.certificateType
      );
      
      // Find the most recent valid certificate
      let matchingCert = null;
      let isCompliant = false;
      
      if (matchingCerts.length > 0) {
        // Sort by expiration date descending to get the most recent
        matchingCerts.sort((a, b) => 
          new Date(b.expirationDate) - new Date(a.expirationDate)
        );
        
        matchingCert = matchingCerts[0];
        
        // Check if certificate is still valid
        const expirationDate = new Date(matchingCert.expirationDate);
        const now = new Date();
        isCompliant = expirationDate > now;
      }
      
      // Return the requirement with status info
      return {
        requirement: {
          _id: req._id,
          certificateType: req.certificateType,
          validityPeriod: req.validityPeriod,
          isRequired: req.isRequired,
          notes: req.notes
        },
        status: {
          isCompliant,
          certificate: matchingCert,
          expiresIn: matchingCert ? calculateExpiresIn(matchingCert.expirationDate) : null
        }
      };
    });
    
    res.json({
      employee: {
        _id: employee._id,
        name: employee.name,
        primaryPosition: employee.primaryPosition,
        positions: employee.positions
      },
      requirements: requirementsWithStatus
    });
    
  } catch (error) {
    console.error('Error fetching employee requirements:', error);
    res.status(500).json({ message: error.message });
  }
});

// Helper function to calculate days until expiration
function calculateExpiresIn(expirationDate) {
  const expiry = new Date(expirationDate);
  const today = new Date();
  
  // Calculate difference in days
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

module.exports = router;