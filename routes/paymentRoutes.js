import express from 'express';
import SSLCommerzPayment from 'sslcommerz-lts';
import Stripe from 'stripe';
import paypal from '@paypal/checkout-server-sdk';
import { verifyJWT, authorizeRoles } from '../middleware/authMiddleware.js';
import Donation from '../models/Donation.js';
import Campaign from '../models/Campaign.js';
import RewardTier from '../models/RewardTier.js';
import Withdrawal from '../models/Withdrawal.js';
import { createNotification } from '../utils/notificationHelper.js';

const router = express.Router();

// Helper: Process Successful Donation (Update stats)
const finalizeDonation = async (donation) => {
    console.log(`[PAYMENT] Finalizing donation: ${donation._id} (Current Status: ${donation.status})`);
    
    if (donation.status === 'charged') {
        console.log(`[PAYMENT] Donation ${donation._id} already charged. Skipping.`);
        return donation;
    }

    donation.payment.status = 'charged';
    donation.payment.paidAt = new Date();
    donation.status = 'charged';
    await donation.save();

    console.log(`[PAYMENT] Updating Campaign ${donation.campaignId} stats: +${donation.amount}`);
    
    // Check if this is the first successful donation from this backer for this campaign
    const previousDonation = await Donation.findOne({
        backerId: donation.backerId,
        campaignId: donation.campaignId,
        status: 'charged',
        _id: { $ne: donation._id }
    });

    const campaignUpdate = { $inc: { totalRaised: donation.amount } };
    if (!previousDonation) {
        campaignUpdate.$inc.backerCount = 1;
    }

    const updatedCampaign = await Campaign.findByIdAndUpdate(donation.campaignId, campaignUpdate, { new: true });

    console.log(`[PAYMENT] Campaign updated. New Total: ${updatedCampaign?.totalRaised}`);

    // Milestone Notifications
    if (updatedCampaign) {
        const fundingGoal = updatedCampaign.fundingGoal;
        const totalRaised = updatedCampaign.totalRaised;
        const percentage = (totalRaised / fundingGoal) * 100;
        const oldPercentage = ((totalRaised - donation.amount) / fundingGoal) * 100;

        // Check for 50% milestone
        if (oldPercentage < 50 && percentage >= 50) {
            await createNotification({
                recipient: updatedCampaign.creatorId,
                type: 'MILESTONE_REACHED',
                title: '50% Funded! 🚀',
                message: `Congratulations! Your campaign "${updatedCampaign.title}" has reached 50% of its funding goal.`,
                link: `/campaign/${updatedCampaign._id}`
            });
        }

        // Check for 100% milestone
        if (oldPercentage < 100 && percentage >= 100) {
            await createNotification({
                recipient: updatedCampaign.creatorId,
                type: 'MILESTONE_REACHED',
                title: '100% Funded! 🎉',
                message: `Amazing! Your campaign "${updatedCampaign.title}" is now fully funded!`,
                link: `/campaign/${updatedCampaign._id}`
            });
        }
    }

    if (donation.rewardTierId) {
        await RewardTier.findByIdAndUpdate(donation.rewardTierId, {
            $inc: { 'availability.claimedSlots': 1 }
        });
    }

    // Trigger Notification for Creator
    if (updatedCampaign) {
        await createNotification({
            recipient: updatedCampaign.creatorId,
            sender: donation.backerId,
            type: 'DONATION_RECEIVED',
            title: 'New Donation!',
            message: `You received a ${donation.currency} ${donation.amount} donation for "${updatedCampaign.title}"`,
            link: `/dashboard?tab=contributions`
        });
    }

    return donation;
};

// Lazy Stripe initialization
let stripe;
const getStripe = () => {
    if (!stripe) {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return stripe;
};

// PayPal Config
const getPaypalClient = () => {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
    return new paypal.core.PayPalHttpClient(environment);
};

// SSLCommerz: Initialize Payment
router.post('/ssl-request', verifyJWT, async (req, res) => {
    try {
        const { campaignId, rewardTierId, amount, shippingAddress, isAnonymous, note } = req.body;
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
        const tran_id = `SSLC_${Date.now()}`;
        const data = {
            total_amount: amount, currency: 'BDT', tran_id: tran_id,
            success_url: `${process.env.FRONTEND_URL}/payment/success/${tran_id}`,
            fail_url: `${process.env.FRONTEND_URL}/payment/fail/${tran_id}`,
            cancel_url: `${process.env.FRONTEND_URL}/payment/cancel/${tran_id}`,
            ipn_url: `${process.env.SERVER_URL}/api/payment/ssl-ipn`,
            shipping_method: 'Courier', product_name: campaign.title, product_category: campaign.category, product_profile: 'general',
            cus_name: req.user.name, cus_email: req.user.email, cus_add1: shippingAddress?.addressLine || 'N/A', cus_city: shippingAddress?.city || 'N/A',
            cus_country: shippingAddress?.country || 'Bangladesh', cus_phone: shippingAddress?.phone || '01700000000',
            ship_name: shippingAddress?.fullName || req.user.name, ship_add1: shippingAddress?.addressLine || 'N/A',
        };
        const sslcz = new SSLCommerzPayment(process.env.SSL_STORE_ID, process.env.SSL_STORE_PASS, process.env.SSL_IS_LIVE === 'true');
        sslcz.init(data).then(apiResponse => {
            const donation = new Donation({
                backerId: req.user.id, campaignId, rewardTierId, amount, currency: 'BDT',
                payment: { gateway: 'sslcommerz', gatewayTransactionId: tran_id, status: 'pledged' },
                status: 'pledged', rewardDelivery: { shippingAddress }, isAnonymous, note
            });
            donation.save();
            res.send({ url: apiResponse.GatewayPageURL });
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// SSLCommerz: Success Callback
router.post('/ssl-success/:tranId', async (req, res) => {
    try {
        const { tranId } = req.params;
        const donation = await Donation.findOne({ 'payment.gatewayTransactionId': tranId, 'payment.gateway': 'sslcommerz' });
        if (!donation) return res.status(404).json({ message: 'Donation not found' });
        await finalizeDonation(donation);
        res.status(200).json({ message: 'Payment successful', donation });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Stripe: Create Checkout Session
router.post('/stripe-request', verifyJWT, async (req, res) => {
    try {
        const { campaignId, rewardTierId, amount, shippingAddress, isAnonymous, note } = req.body;
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
        const session = await getStripe().checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: { currency: 'usd', product_data: { name: campaign.title, images: [campaign.thumbnail] }, unit_amount: amount * 100 },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/payment/success/STRIPE_{CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/campaign/${campaignId}`,
            metadata: { campaignId: campaignId.toString(), backerId: req.user.id.toString(), rewardTierId: rewardTierId?.toString() || '', shippingAddress: JSON.stringify(shippingAddress), isAnonymous: isAnonymous ? 'true' : 'false' }
        });
        res.status(200).json({ url: session.url });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Stripe: Success Callback
router.post('/stripe-success/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await getStripe().checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') return res.status(400).json({ message: 'Payment not completed' });
        let donation = await Donation.findOne({ 'payment.gatewayTransactionId': sessionId });
        if (donation) {
            await finalizeDonation(donation);
            return res.status(200).json({ message: 'Processed', donation });
        }
        const { campaignId, backerId, rewardTierId, shippingAddress, isAnonymous } = session.metadata;
        donation = new Donation({
            backerId, campaignId, rewardTierId: rewardTierId || null, amount: session.amount_total / 100, currency: 'USD', isAnonymous: isAnonymous === 'true',
            payment: { gateway: 'stripe', gatewayTransactionId: sessionId, status: 'pledged' },
            status: 'pledged', rewardDelivery: { shippingAddress: JSON.parse(shippingAddress) }
        });
        await finalizeDonation(donation);
        res.status(200).json({ message: 'Payment successful', donation });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PayPal: Create Order
router.post('/paypal-request', verifyJWT, async (req, res) => {
    try {
        const { campaignId, rewardTierId, amount, shippingAddress, isAnonymous } = req.body;
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
        if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
            const mockOrderId = `MOCK_PAYPAL_${Date.now()}`;
            const mockDonation = new Donation({
                backerId: req.user.id, campaignId, rewardTierId: rewardTierId || null, amount, currency: 'USD', isAnonymous,
                payment: { gateway: 'paypal', gatewayTransactionId: mockOrderId, status: 'pledged' },
                status: 'pledged', rewardDelivery: { shippingAddress }
            });
            await mockDonation.save();
            return res.status(200).json({ url: `${process.env.FRONTEND_URL}/payment/success/PAYPAL_${mockOrderId}` });
        }
        const client = getPaypalClient();
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: { currency_code: 'USD', value: amount.toString() },
                custom_id: JSON.stringify({ campaignId, backerId: req.user.id, rewardTierId, isAnonymous, shippingAddress })
            }],
            application_context: {
                return_url: `${process.env.FRONTEND_URL}/payment/success/PAYPAL_{ORDER_ID}`,
                cancel_url: `${process.env.FRONTEND_URL}/campaign/${campaignId}`
            }
        });
        const order = await client.execute(request);
        res.status(200).json({ url: order.result.links.find(link => link.rel === 'approve').href });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PayPal: Capture Order
router.post('/paypal-success/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const cleanOrderId = orderId.replace(/^PAYPAL_/, '');
        console.log(`[PAYPAL] Success verify request for ID: ${cleanOrderId}`);

        let donation = await Donation.findOne({ 'payment.gatewayTransactionId': cleanOrderId, 'payment.gateway': 'paypal' });

        if (cleanOrderId.startsWith('MOCK_PAYPAL_')) {
            if (!donation) return res.status(404).json({ message: 'Mock donation not found' });
            await finalizeDonation(donation);
            return res.status(200).json({ message: 'Payment successful (Demo)', donation });
        }

        if (donation && donation.status === 'charged') return res.status(200).json({ message: 'Already processed', donation });

        const client = getPaypalClient();
        const request = new paypal.orders.OrdersCaptureRequest(cleanOrderId);
        const capture = await client.execute(request);
        if (capture.result.status !== 'COMPLETED') return res.status(400).json({ message: 'Payment not completed' });
        const { campaignId, backerId, rewardTierId, shippingAddress, isAnonymous } = JSON.parse(capture.result.purchase_units[0].custom_id);
        if (!donation) {
            donation = new Donation({
                backerId, campaignId, rewardTierId: rewardTierId || null, amount: parseFloat(capture.result.purchase_units[0].payments.captures[0].amount.value), currency: 'USD', isAnonymous,
                payment: { gateway: 'paypal', gatewayTransactionId: cleanOrderId, status: 'pledged' },
                status: 'pledged', rewardDelivery: { shippingAddress }
            });
        }
        await finalizeDonation(donation);
        res.status(200).json({ message: 'Payment successful', donation });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Standard Routes (Populated for Dashboard)
router.get('/my-donations', verifyJWT, async (req, res) => {
    try {
        const donations = await Donation.find({ backerId: req.user.id })
            .populate({
                path: 'campaignId',
                select: 'title thumbnail rewardProgressStatus rewardProgressNote deadline status creatorId rewardTiers fundingGoal totalRaised',
                populate: [
                    { path: 'creatorId', select: 'name' },
                    { path: 'rewardTiers' }
                ]
            })
            .populate('rewardTierId')
            .sort({ createdAt: -1 });
        res.status(200).json(donations);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/project-contributions', verifyJWT, authorizeRoles('creator', 'admin'), async (req, res) => {
    try {
        const myCampaigns = await Campaign.find({ creatorId: req.user.id }).select('_id');
        const donations = await Donation.find({ campaignId: { $in: myCampaigns.map(c => c._id) } }).populate('campaignId', 'title').populate('backerId', 'name email').sort({ createdAt: -1 });
        res.status(200).json(donations);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/my-withdrawals', verifyJWT, async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ creatorId: req.user.id }).populate('campaignId', 'title totalRaised feePercentage').sort({ createdAt: -1 });
        res.status(200).json(withdrawals);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/all-donations', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        const donations = await Donation.find().populate('campaignId', 'title thumbnail totalRaised').populate('backerId', 'name email').sort({ createdAt: -1 });
        res.status(200).json(donations);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/all-withdrawals', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find().populate('campaignId', 'title totalRaised feePercentage').populate('creatorId', 'name email').sort({ createdAt: -1 });
        res.status(200).json(withdrawals);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// Request Payout
router.post('/request-withdrawal', verifyJWT, authorizeRoles('creator', 'admin'), async (req, res) => {
    try {
        const { campaignId, amount, method, accountNumber } = req.body;
        const campaign = await Campaign.findById(campaignId);
        
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
        if (campaign.creatorId.toString() !== req.user.id && !req.user.role.includes('admin')) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Calculate available balance (re-using the logic from campaignRoutes for consistency)
        const Donation = (await import('../models/Donation.js')).default;
        const donations = await Donation.find({ campaignId, status: 'charged' });
        
        const totalRaised = campaign.totalRaised;
        const netFunds = totalRaised * (1 - (campaign.feePercentage / 100));
        
        const isSuccessful = campaign.status === 'successful';
        const stage1Max = netFunds * 0.70;
        
        const totalRewardsCount = donations.length;
        const confirmedRewardsCount = donations.filter(d => d.rewardDelivery.confirmedByBacker).length;
        const confirmationRate = totalRewardsCount > 0 ? (confirmedRewardsCount / totalRewardsCount) : 0;
        
        const stage2Max = netFunds * 0.30;
        const stage2Unlocked = confirmationRate >= 0.80;

        let totalAvailable = isSuccessful ? stage1Max : 0;
        if (stage2Unlocked) totalAvailable += stage2Max;

        const currentAvailable = Math.max(0, totalAvailable - campaign.totalWithdrawn);

        if (amount > currentAvailable) {
            return res.status(400).json({ message: 'Amount exceeds available balance' });
        }

        // Determine Stage: If totalWithdrawn is 0 or less than stage1Max, it's Stage 1
        const stage = campaign.totalWithdrawn < stage1Max ? 1 : 2;

        // The amount requested is from the 'net' available balance
        // We calculate the gross amount and platform fee for record keeping
        // amount (net) = Gross * (1 - fee%) => Gross = amount / (1 - fee%)
        const feeDecimal = campaign.feePercentage / 100;
        const grossAmount = amount / (1 - feeDecimal);
        const platformFee = grossAmount - amount;

        const withdrawal = new Withdrawal({
            creatorId: req.user.id,
            campaignId,
            requestedAmount: grossAmount,
            platformFee: platformFee,
            netAmount: amount,
            method,
            accountNumber,
            status: 'pending',
            stage: stage
        });

        await withdrawal.save();
        
        // Update campaign's totalWithdrawn
        campaign.totalWithdrawn += Number(amount);
        await campaign.save();

        res.status(201).json({ message: 'Withdrawal request submitted successfully', withdrawal });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin: Update Withdrawal Status
router.patch('/withdrawals/:id/status', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        const { status, rejectionReason, paymentProof, adminComment } = req.body;
        const withdrawal = await Withdrawal.findById(req.params.id).populate('campaignId');
        
        if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found' });

        const oldStatus = withdrawal.status;
        withdrawal.status = status;
        
        if (status === 'rejected') {
            if (!rejectionReason) return res.status(400).json({ message: 'Rejection reason is required' });
            withdrawal.rejectionReason = rejectionReason;
            // If rejected, refund the amount back to the campaign's withdrawn balance
            // We use netAmount because that's what was added to totalWithdrawn
            if (oldStatus !== 'rejected') {
                const campaign = await Campaign.findById(withdrawal.campaignId);
                campaign.totalWithdrawn -= withdrawal.netAmount;
                await campaign.save();
            }
        }

        if (status === 'approved' || status === 'completed') {
            if (status === 'completed' && !paymentProof) {
                return res.status(400).json({ message: 'Payment proof is required to mark as completed' });
            }
            if (paymentProof) withdrawal.paymentProof = paymentProof;
            if (adminComment) withdrawal.adminComment = adminComment;
        }

        if (status === 'completed') {
            withdrawal.processedAt = new Date();
        }

        await withdrawal.save();

        // Trigger Notification for Creator
        await createNotification({
            recipient: withdrawal.creatorId,
            type: 'WITHDRAWAL_UPDATE',
            title: `Withdrawal ${status.toUpperCase()}`,
            message: status === 'rejected' 
                ? `Your withdrawal request for "${withdrawal.campaignId.title}" was rejected: ${rejectionReason}`
                : `Your withdrawal request for "${withdrawal.campaignId.title}" is now ${status}.`,
            link: `/dashboard?tab=withdrawals`
        });

        res.status(200).json({ message: `Withdrawal ${status}`, withdrawal });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
