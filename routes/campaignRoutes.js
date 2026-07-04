import express from 'express';
import Campaign from '../models/Campaign.js';
import RewardTier from '../models/RewardTier.js';
import { verifyJWT, authorizeRoles } from '../middleware/authMiddleware.js';
import { createNotification } from '../utils/notificationHelper.js';

const router = express.Router();

// Create Campaign
router.post('/', verifyJWT, authorizeRoles('creator', 'admin'), async (req, res) => {
    try {
        const campaignData = {
            ...req.body,
            creatorId: req.user.id,
            status: 'pending' // Set to pending by default for admin review
        };

        const campaign = new Campaign(campaignData);
        await campaign.save();

        res.status(201).json({
            message: 'Campaign created successfully. Waiting for admin approval.',
            campaign
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get All Campaigns (with optional filters)
router.get('/', async (req, res) => {
    try {
        const { category, type, search, status, creatorId } = req.query;
        let query = {};

        // If status is provided, support comma-separated list, otherwise default to 'active' for public listing
        if (status) {
            if (status.includes(',')) {
                query.status = { $in: status.split(',') };
            } else {
                query.status = status;
            }
        } else {
            query.status = 'active';
        }

        if (category) query.category = category;
        if (type) query.campaignType = type;
        if (creatorId) query.creatorId = creatorId;
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        const campaigns = await Campaign.find(query).populate('creatorId', 'name profilePicture');
        res.status(200).json(campaigns);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin: Toggle Campaign Ban
router.patch('/:id/toggle-ban', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

        const isBanning = campaign.status !== 'banned';
        
        if (isBanning) {
            campaign.status = 'banned';
        } else {
            // Restore to active if it was approved, otherwise pending
            campaign.status = campaign.adminApproval.isApproved ? 'active' : 'pending';
        }

        await campaign.save();

        // Trigger Notification for Creator
        await createNotification({
            recipient: campaign.creatorId,
            sender: req.user.id,
            type: 'VERIFICATION_STATUS',
            title: isBanning ? 'Campaign Banned ⚠️' : 'Campaign Restored ✅',
            message: isBanning 
                ? `Your campaign "${campaign.title}" has been banned for violating our terms of service.` 
                : `Your campaign "${campaign.title}" has been restored.`,
            link: '/dashboard?tab=my-projects'
        });

        res.status(200).json({ message: `Campaign ${isBanning ? 'banned' : 'restored'} successfully`, campaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get My Campaigns (Moved up to prevent conflict with /:id)
router.get('/my-campaigns', verifyJWT, authorizeRoles('creator'), async (req, res) => {
    try {
        const campaigns = await Campaign.find({ creatorId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(campaigns);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin: Get Global Fulfillment Stats
router.get('/admin/fulfillment-monitor', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        const Donation = (await import('../models/Donation.js')).default;
        
        const campaigns = await Campaign.find({ status: 'successful' })
            .populate('creatorId', 'name email')
            .select('title totalRaised backerCount rewardProgressStatus updatedAt');

        const campaignStats = await Promise.all(campaigns.map(async (c) => {
            const donations = await Donation.find({ campaignId: c._id, status: 'charged' });
            
            let totalFulfilled = 0;
            let totalConfirmed = 0;
            donations.forEach(d => {
                totalFulfilled += d.rewardDelivery.fulfilledRewardTierIds.length;
                totalConfirmed += d.rewardDelivery.confirmedRewardTierIds.length;
            });

            const totalObligations = donations.length; // Baseline: at least 1 reward per donation
            const confirmationRate = totalFulfilled > 0 ? (totalConfirmed / totalFulfilled) * 100 : 0;
            const deliveryRate = totalObligations > 0 ? (totalFulfilled / totalObligations) * 100 : 0;

            // Fraud Detection: High delivery reported by creator, but low confirmation from backers after some time
            const daysSinceLastUpdate = (new Date() - new Date(c.updatedAt)) / (1000 * 60 * 60 * 24);
            const isHighRisk = deliveryRate > 50 && confirmationRate < 10 && daysSinceLastUpdate > 14;

            return {
                id: c._id,
                title: c.title,
                creator: c.creatorId,
                totalRewards: totalObligations,
                deliveredRewards: totalFulfilled,
                confirmedRewards: totalConfirmed,
                confirmationRate: confirmationRate.toFixed(2),
                deliveryRate: deliveryRate.toFixed(2),
                isHighRisk,
                rewardProgressStatus: c.rewardProgressStatus
            };
        }));

        res.status(200).json(campaignStats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin: Get Global Overview Stats
router.get('/admin/stats', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        let User;
        try {
            User = mongoose.model('User');
        } catch (e) {
            User = (await import('../models/User.js')).default;
        }
        
        const aggregation = await Campaign.aggregate([
            {
                $group: {
                    _id: null,
                    platformTotal: { $sum: "$totalRaised" },
                    totalCampaigns: { $sum: 1 },
                    pendingProjects: {
                        $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                    }
                }
            }
        ]);

        const campaignStats = aggregation[0] || { platformTotal: 0, totalCampaigns: 0, pendingProjects: 0 };
        const totalUsers = await User.countDocuments();
        const pendingCreators = await User.countDocuments({ approvalStatus: 'pending' });

        const stats = {
            platformTotal: campaignStats.platformTotal,
            totalCampaigns: campaignStats.totalCampaigns,
            pendingProjects: campaignStats.pendingProjects,
            totalUsers,
            pendingCreators
        };

        res.status(200).json(stats);
    } catch (error) {
        console.error('Admin Stats Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get Campaign Details
router.get('/:id', async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id)
            .populate('creatorId', 'name bio profilePicture')
            .populate('adminApproval.approvedBy', 'name');

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        const rewardTiers = await RewardTier.find({ campaignId: campaign._id });

        res.status(200).json({ campaign, rewardTiers });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin: Approve/Reject Campaign
router.patch('/:id/approve', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        const { isApproved, rejectionReason } = req.body;
        const campaign = await Campaign.findById(req.params.id);

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        campaign.adminApproval.isApproved = isApproved;
        campaign.adminApproval.approvedBy = req.user.id;
        campaign.adminApproval.approvedAt = new Date();
        campaign.adminApproval.rejectionReason = rejectionReason || null;
        campaign.status = isApproved ? 'active' : 'draft';

        await campaign.save();

        // Trigger Notification for Creator
        await createNotification({
            recipient: campaign.creatorId,
            sender: req.user.id,
            type: 'VERIFICATION_STATUS',
            title: isApproved ? 'Campaign Approved! 🚀' : 'Campaign Rejected ❌',
            message: isApproved 
                ? `Your campaign "${campaign.title}" has been approved by our team. It is now live!` 
                : `Your campaign "${campaign.title}" was not approved. Reason: ${rejectionReason || 'No reason provided.'}`,
            link: '/dashboard?tab=my-projects'
        });

        res.status(200).json({ message: `Campaign ${isApproved ? 'approved' : 'rejected'} successfully`, campaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Campaign
router.patch('/:id', verifyJWT, authorizeRoles('creator', 'admin'), async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
        
        // Only creator or admin can update
        if (campaign.creatorId.toString() !== req.user.id && !req.user.role.includes('admin')) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { title, fundingGoal, ...updateData } = req.body;
        
        // Prevent modification of title and fundingGoal
        const updatedCampaign = await Campaign.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        res.status(200).json({ message: 'Campaign updated successfully', campaign: updatedCampaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add Reward Tier
router.post('/:id/reward-tiers', verifyJWT, authorizeRoles('creator'), async (req, res) => {
    try {
        const campaignDoc = await Campaign.findById(req.params.id);
        if (!campaignDoc) return res.status(404).json({ message: 'Campaign not found' });
        if (campaignDoc.creatorId.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });

        const rewardTier = new RewardTier({
            ...req.body,
            campaignId: campaignDoc._id
        });

        await rewardTier.save();
        res.status(201).json(rewardTier);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get Campaign Backers (Grouped by Reward Tier / Total Contribution)
router.get('/:id/backers', verifyJWT, authorizeRoles('creator', 'admin'), async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
        if (campaign.creatorId.toString() !== req.user.id && !req.user.role.includes('admin')) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const Donation = (await import('../models/Donation.js')).default;
        const RewardTier = (await import('../models/RewardTier.js')).default;

        const donations = await Donation.find({ campaignId: req.params.id, status: 'charged' })
            .populate('backerId', 'name email phone address')
            .populate('rewardTierId');

        const rewardTiers = await RewardTier.find({ campaignId: req.params.id }).sort({ minimumAmount: 1 });

        // Group by backer
        const backerMap = {};
        donations.forEach(d => {
            const backerId = d.backerId._id.toString();
            if (!backerMap[backerId]) {
                backerMap[backerId] = {
                    backer: d.backerId,
                    totalContributed: 0,
                    donations: [],
                    matchedTiers: []
                };
            }
            backerMap[backerId].totalContributed += d.amount;
            backerMap[backerId].donations.push(d);
        });

        // Match tiers for each backer
        Object.values(backerMap).forEach(data => {
            rewardTiers.forEach(tier => {
                if (data.totalContributed >= tier.minimumAmount) {
                    data.matchedTiers.push(tier);
                }
            });
        });

        res.status(200).json({
            backers: Object.values(backerMap),
            rewardTiers
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Campaign Reward Progress Status
router.patch('/:id/reward-progress', verifyJWT, authorizeRoles('creator', 'admin'), async (req, res) => {
    try {
        const { rewardProgressStatus, rewardProgressNote } = req.body;
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
        if (campaign.creatorId.toString() !== req.user.id && !req.user.role.includes('admin')) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        campaign.rewardProgressStatus = rewardProgressStatus;
        campaign.rewardProgressNote = rewardProgressNote;
        await campaign.save();

        res.status(200).json({ message: 'Reward progress updated', campaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Individual Donation Reward Status (Now supports per-tier fulfillment)
router.patch('/donations/:donationId/reward-status', verifyJWT, authorizeRoles('creator', 'admin'), async (req, res) => {
    try {
        const { tierId, status } = req.body; // status is 'fulfilled' or 'pending'
        const Donation = (await import('../models/Donation.js')).default;
        const donation = await Donation.findById(req.params.donationId).populate('campaignId');
        
        if (!donation) return res.status(404).json({ message: 'Donation not found' });
        if (donation.campaignId.creatorId.toString() !== req.user.id && !req.user.role.includes('admin')) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        if (status === 'fulfilled') {
            if (!donation.rewardDelivery.fulfilledRewardTierIds.includes(tierId)) {
                donation.rewardDelivery.fulfilledRewardTierIds.push(tierId);
                
                // Trigger Notification for Backer
                const tier = await RewardTier.findById(tierId);
                await createNotification({
                    recipient: donation.backerId,
                    sender: req.user.id,
                    type: 'CAMPAIGN_UPDATE',
                    title: 'Reward Fulfilled! 🎁',
                    message: `The creator has marked your reward "${tier?.title || 'Reward'}" for "${donation.campaignId.title}" as fulfilled.`,
                    link: `/dashboard?tab=backed-projects`
                });
            }
        } else {
            donation.rewardDelivery.fulfilledRewardTierIds = donation.rewardDelivery.fulfilledRewardTierIds.filter(id => id.toString() !== tierId);
        }

        await donation.save();
        res.status(200).json({ message: 'Reward status updated', donation });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get Withdrawal Stats for a Campaign (70/30 logic)
router.get('/:id/withdrawal-stats', verifyJWT, authorizeRoles('creator', 'admin'), async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
        if (campaign.creatorId.toString() !== req.user.id && !req.user.role.includes('admin')) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const Donation = (await import('../models/Donation.js')).default;
        const donations = await Donation.find({ campaignId: req.params.id, status: 'charged' });
        
        const totalRaised = campaign.totalRaised;
        const netFunds = totalRaised * (1 - (campaign.feePercentage / 100));
        
        // Stage 1: 70% available if successful
        const isSuccessful = campaign.status === 'successful';
        const stage1Max = netFunds * 0.70;
        
        // Stage 2: Remaining 30% available if 80% confirmed
        // Granular calculation: Sum of all confirmed tiers vs all fulfilled tiers
        let totalFulfilledTiers = 0;
        let totalConfirmedTiers = 0;

        donations.forEach(d => {
            totalFulfilledTiers += d.rewardDelivery.fulfilledRewardTierIds.length;
            totalConfirmedTiers += d.rewardDelivery.confirmedRewardTierIds.length;
        });

        // Fallback: If creator hasn't marked any tiers as fulfilled, we can't unlock Stage 2
        // But if they have, we check the confirmation rate of those specific deliveries
        const confirmationRate = totalFulfilledTiers > 0 ? (totalConfirmedTiers / totalFulfilledTiers) : 0;
        
        const stage2Max = netFunds * 0.30;
        const stage2Unlocked = confirmationRate >= 0.80 && totalFulfilledTiers > 0;

        let totalAvailable = isSuccessful ? stage1Max : 0;
        if (stage2Unlocked) totalAvailable += stage2Max;

        const currentAvailable = Math.max(0, totalAvailable - campaign.totalWithdrawn);

        res.status(200).json({
            totalRaised,
            netFunds,
            totalWithdrawn: campaign.totalWithdrawn,
            currentAvailable,
            stage1: {
                total: stage1Max,
                unlocked: isSuccessful
            },
            stage2: {
                total: stage2Max,
                unlocked: stage2Unlocked,
                confirmationRate: (confirmationRate * 100).toFixed(2),
                totalFulfilled: totalFulfilledTiers,
                totalConfirmed: totalConfirmedTiers
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Backer: Confirm Reward Delivery
router.patch('/donations/:donationId/confirm-delivery', verifyJWT, async (req, res) => {
    try {
        const { tierId } = req.body;
        const Donation = (await import('../models/Donation.js')).default;
        const donation = await Donation.findById(req.params.donationId);

        if (!donation) return res.status(404).json({ message: 'Donation not found' });
        if (donation.backerId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        if (tierId) {
            // Granular confirmation
            if (!donation.rewardDelivery.confirmedRewardTierIds.includes(tierId)) {
                donation.rewardDelivery.confirmedRewardTierIds.push(tierId);
            }
            // Update legacy boolean if all fulfilled rewards are confirmed
            const allConfirmed = donation.rewardDelivery.fulfilledRewardTierIds.length > 0 && donation.rewardDelivery.fulfilledRewardTierIds.every(id => 
                donation.rewardDelivery.confirmedRewardTierIds.includes(id)
            );
            if (allConfirmed) donation.rewardDelivery.confirmedByBacker = true;
        } else {
            // Global confirmation (fallback)
            donation.rewardDelivery.confirmedRewardTierIds = [...donation.rewardDelivery.fulfilledRewardTierIds];
            donation.rewardDelivery.confirmedByBacker = true;
        }

        await donation.save();
        res.status(200).json({ message: 'Delivery confirmed!', donation });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// DEV ONLY: Set campaign deadline to now for testing
router.patch('/:id/test/expire-now', verifyJWT, authorizeRoles('creator', 'admin'), async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
        if (campaign.creatorId.toString() !== req.user.id && !req.user.role.includes('admin')) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        campaign.deadline = new Date();
        campaign.status = 'successful'; // Automatically mark as successful for testing
        await campaign.save();

        res.status(200).json({ message: 'Campaign expired successfully for testing', campaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DEV ONLY: Reset campaign deadline to 30 days from now for testing
router.patch('/:id/test/reset-deadline', verifyJWT, authorizeRoles('creator', 'admin'), async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
        if (campaign.creatorId.toString() !== req.user.id && !req.user.role.includes('admin')) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        
        campaign.deadline = futureDate;
        campaign.status = 'active';
        await campaign.save();

        res.status(200).json({ message: 'Campaign deadline reset successfully for testing', campaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
