import express from 'express';
import CampaignUpdate from '../models/CampaignUpdate.js';
import Campaign from '../models/Campaign.js';
import Donation from '../models/Donation.js';
import { verifyJWT, authorizeRoles } from '../middleware/authMiddleware.js';
import { createNotification } from '../utils/notificationHelper.js';

const router = express.Router();

// Creator: Post a new update
router.post('/:campaignId', verifyJWT, authorizeRoles('creator', 'admin'), async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { title, content, images, isBackerOnly } = req.body;

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

        // Ensure user is the creator or admin
        if (campaign.creatorId.toString() !== req.user.id && !req.user.role.includes('admin')) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const update = new CampaignUpdate({
            campaignId,
            creatorId: req.user.id,
            title,
            content,
            images,
            isBackerOnly
        });

        await update.save();

        // Trigger Notifications for Backers
        const uniqueBackers = await Donation.distinct('backerId', { campaignId, status: 'charged' });
        
        // We do this asynchronously without waiting to not block the response
        Promise.all(uniqueBackers.map(backerId => 
            createNotification({
                recipient: backerId,
                sender: req.user.id,
                type: 'CAMPAIGN_UPDATE',
                title: `New Update: ${campaign.title}`,
                message: `${req.user.name} posted a new update: "${title}"`,
                link: `/campaign/${campaignId}`
            })
        )).catch(err => console.error('Error broadcasting update notifications:', err));

        res.status(201).json({ message: 'Update posted successfully', update });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get updates for a campaign
router.get('/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const updates = await CampaignUpdate.find({ campaignId }).sort({ createdAt: -1 });

        // If user is logged in, check if they are a backer for private updates
        // This is a simplified check. In a real app, you'd filter out isBackerOnly updates
        // if the user hasn't backed the project.
        
        // For now, we'll return all, but the frontend should handle the "Locked" view
        // if we want to be strict.
        
        res.status(200).json(updates);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Backer-safe check for private updates
router.get('/:campaignId/secure', verifyJWT, async (req, res) => {
    try {
        const { campaignId } = req.params;
        
        // Check if user is creator or admin
        const campaign = await Campaign.findById(campaignId);
        const isOwner = campaign && (campaign.creatorId.toString() === req.user.id || req.user.role.includes('admin'));
        
        // Check if user is a backer
        const donation = await Donation.findOne({ campaignId, backerId: req.user.id, status: 'charged' });
        const isBacker = !!donation;

        let query = { campaignId };
        if (!isOwner && !isBacker) {
            query.isBackerOnly = false;
        }

        const updates = await CampaignUpdate.find(query).sort({ createdAt: -1 });
        res.status(200).json(updates);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete an update
router.delete('/:updateId', verifyJWT, authorizeRoles('creator', 'admin'), async (req, res) => {
    try {
        const update = await CampaignUpdate.findById(req.params.updateId);
        if (!update) return res.status(404).json({ message: 'Update not found' });

        const campaign = await Campaign.findById(update.campaignId);
        if (campaign.creatorId.toString() !== req.user.id && !req.user.role.includes('admin')) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        await CampaignUpdate.findByIdAndDelete(req.params.updateId);
        res.status(200).json({ message: 'Update deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
