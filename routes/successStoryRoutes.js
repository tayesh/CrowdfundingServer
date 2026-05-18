import express from 'express';
import SuccessStory from '../models/SuccessStory.js';
import { verifyJWT, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all success stories
router.get('/', async (req, res) => {
    try {
        const stories = await SuccessStory.find().sort({ createdAt: -1 });
        res.status(200).json(stories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create success story (Admin only)
router.post('/', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        const story = new SuccessStory(req.body);
        await story.save();
        res.status(201).json(story);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update success story (Admin only)
router.patch('/:id', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        const story = await SuccessStory.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!story) return res.status(404).json({ message: 'Success story not found' });
        res.status(200).json(story);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete success story (Admin only)
router.delete('/:id', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        await SuccessStory.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Success story deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
