import express from 'express';
import { verifyJWT } from '../middleware/authMiddleware.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Get all notifications for the current user
router.get('/', verifyJWT, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error: error.message });
    }
});

// Get unread count
router.get('/unread-count', verifyJWT, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ recipient: req.user.id, isRead: false });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching unread count', error: error.message });
    }
});

// Mark a single notification as read
router.patch('/:id/read', verifyJWT, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user.id },
            { isRead: true },
            { new: true }
        );
        if (!notification) return res.status(404).json({ message: 'Notification not found' });
        res.json(notification);
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification', error: error.message });
    }
});

// Mark all as read
router.patch('/read-all', verifyJWT, async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user.id, isRead: false },
            { isRead: true }
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notifications', error: error.message });
    }
});

// Delete a notification
router.delete('/:id', verifyJWT, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user.id });
        if (!notification) return res.status(404).json({ message: 'Notification not found' });
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting notification', error: error.message });
    }
});

export default router;
