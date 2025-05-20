const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const { authenticateToken } = require('../controllers/middleware/auth');

// Get all employees
router.get('/', authenticateToken, async (req, res) => {
  try {
    const employees = await Employee.find({ active: true })
      .populate('positions')
      .populate('primaryPosition');
    
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get employee by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('positions')
      .populate('primaryPosition');
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new employee
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, email, positions, primaryPosition } = req.body;
    
    // Validate required fields
    if (!name || !positions || positions.length === 0) {
      return res.status(400).json({ message: 'Name and at least one position are required' });
    }
    
    // Determine primary position if not provided
    const effectivePrimaryPosition = primaryPosition || positions[0];
    
    // Create new employee
    const employee = new Employee({
      name,
      email,
      positions,
      primaryPosition: effectivePrimaryPosition,
      active: true
    });
    
    // Save to database
    const savedEmployee = await employee.save();
    
    // Return fully populated employee
    const populatedEmployee = await Employee.findById(savedEmployee._id)
      .populate('positions')
      .populate('primaryPosition');
    
    res.status(201).json(populatedEmployee);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update employee
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, email, positions, primaryPosition } = req.body;
    
    // Validate required fields
    if (!name || !positions || positions.length === 0) {
      return res.status(400).json({ message: 'Name and at least one position are required' });
    }
    
    // Find the employee
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Determine primary position if not provided or if previous primary is no longer in positions
    let effectivePrimaryPosition = primaryPosition;
    if (!effectivePrimaryPosition || !positions.includes(effectivePrimaryPosition)) {
      effectivePrimaryPosition = positions[0];
    }
    
    // Update employee fields
    employee.name = name;
    employee.email = email;
    employee.positions = positions;
    employee.primaryPosition = effectivePrimaryPosition;
    
    // Save changes
    const updatedEmployee = await employee.save();
    
    // Return fully populated employee
    const populatedEmployee = await Employee.findById(updatedEmployee._id)
      .populate('positions')
      .populate('primaryPosition');
    
    res.json(populatedEmployee);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(400).json({ message: error.message });
  }
});

// Deactivate employee (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await Employee.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    
    if (!result) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    res.json({ message: 'Employee deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating employee:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add a position to an employee
router.post('/:id/positions', authenticateToken, async (req, res) => {
  try {
    const { positionId } = req.body;
    
    if (!positionId) {
      return res.status(400).json({ message: 'Position ID is required' });
    }
    
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Check if position already exists
    if (employee.positions.includes(positionId)) {
      return res.status(400).json({ message: 'Position already assigned to this employee' });
    }
    
    // Add position
    employee.positions.push(positionId);
    
    // If no primary position, set this as primary
    if (!employee.primaryPosition) {
      employee.primaryPosition = positionId;
    }
    
    // Save changes
    const updatedEmployee = await employee.save();
    
    // Return fully populated employee
    const populatedEmployee = await Employee.findById(updatedEmployee._id)
      .populate('positions')
      .populate('primaryPosition');
    
    res.json(populatedEmployee);
  } catch (error) {
    console.error('Error adding position:', error);
    res.status(400).json({ message: error.message });
  }
});

// Remove a position from an employee
router.delete('/:id/positions/:positionId', authenticateToken, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Check if position exists
    if (!employee.positions.includes(req.params.positionId)) {
      return res.status(400).json({ message: 'Position not assigned to this employee' });
    }
    
    // Remove position
    employee.positions = employee.positions.filter(
      pos => pos.toString() !== req.params.positionId
    );
    
    // If removed position was primary, set a new primary if positions remain
    if (employee.primaryPosition.toString() === req.params.positionId) {
      employee.primaryPosition = employee.positions.length > 0 
        ? employee.positions[0] 
        : null;
    }
    
    // Save changes
    const updatedEmployee = await employee.save();
    
    // Return fully populated employee
    const populatedEmployee = await Employee.findById(updatedEmployee._id)
      .populate('positions')
      .populate('primaryPosition');
    
    res.json(populatedEmployee);
  } catch (error) {
    console.error('Error removing position:', error);
    res.status(400).json({ message: error.message });
  }
});

// Set primary position
router.put('/:id/primary-position', authenticateToken, async (req, res) => {
  try {
    const { positionId } = req.body;
    
    if (!positionId) {
      return res.status(400).json({ message: 'Position ID is required' });
    }
    
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Check if position is assigned to employee
    if (!employee.positions.includes(positionId)) {
      return res.status(400).json({ message: 'Position not assigned to this employee' });
    }
    
    // Set as primary position
    employee.primaryPosition = positionId;
    
    // Save changes
    const updatedEmployee = await employee.save();
    
    // Return fully populated employee
    const populatedEmployee = await Employee.findById(updatedEmployee._id)
      .populate('positions')
      .populate('primaryPosition');
    
    res.json(populatedEmployee);
  } catch (error) {
    console.error('Error setting primary position:', error);
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;