const express = require('express');
const router = express.Router();

// Get all Roles
router.get('/', async (req, res) => {
    const Role = req.db.model('Role', require('../models/Role').schema);
    try {
        const roles = await Role.find().sort({ roleName: 1 });
        res.status(200).json(roles);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching roles' });
    }
});

// Add a new Site
router.post('/', async (req, res) => {
    const Role = req.db.model('Role', require('../models/Role').schema);
    const { roleName } = req.body;

    try {
        const newRole = new Role({ roleName });
        await newRole.save();
        res.status(201).json(newRole);
    } catch (error) {
        res.status(500).json({ message: 'Error adding role', error });
    }
});

module.exports = router;