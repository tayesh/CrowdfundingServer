import cron from 'node-cron';
import Stripe from 'stripe';
import Campaign from '../models/Campaign.js';
import Donation from '../models/Donation.js';

// Lazy Stripe initialization
let stripe;
const getStripe = () => {
    if (!stripe) {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return stripe;
};

export const initCronJobs = () => {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Running campaign deadline check...');
        
        try {
            const expiredCampaigns = await Campaign.find({
                deadline: { $lte: new Date() },
                status: 'active'
            });

            for (const campaign of expiredCampaigns) {
                if (campaign.fundingModel === 'all-or-nothing') {
                    if (campaign.totalRaised >= campaign.fundingGoal) {
                        // SUCCESS: Charge all pledges
                        await processSuccessfulAON(campaign);
                        campaign.status = 'successful';
                    } else {
                        // FAILURE: Cancel all pledges
                        await processFailedAON(campaign);
                        campaign.status = 'failed';
                    }
                } else {
                    // Keep-it-All: Always successful if deadline passed
                    campaign.status = 'successful';
                }
                await campaign.save();
                console.log(`Campaign ${campaign._id} settled as ${campaign.status}`);
            }
        } catch (error) {
            console.error('Error in cron job:', error);
        }
    });
};

const processSuccessfulAON = async (campaign) => {
    const pledges = await Donation.find({
        campaignId: campaign._id,
        status: 'pledged',
        'payment.gateway': 'stripe'
    });

    const stripeClient = getStripe();

    for (const pledge of pledges) {
        try {
            await stripeClient.paymentIntents.capture(pledge.payment.stripeDetails.paymentIntentId);
            pledge.status = 'charged';
            pledge.payment.status = 'charged';
            pledge.payment.paidAt = new Date();
            await pledge.save();
        } catch (error) {
            console.error(`Failed to capture pledge ${pledge._id}:`, error.message);
            pledge.status = 'failed';
            await pledge.save();
        }
    }
};

const processFailedAON = async (campaign) => {
    const pledges = await Donation.find({
        campaignId: campaign._id,
        status: 'pledged'
    });

    const stripeClient = getStripe();

    for (const pledge of pledges) {
        try {
            if (pledge.payment.gateway === 'stripe') {
                await stripeClient.paymentIntents.cancel(pledge.payment.stripeDetails.paymentIntentId);
            }
            // For SSLCommerz, in a real app we'd call the Refund API here.
            // For this demo/sandbox, we just mark as cancelled.
            
            pledge.status = 'cancelled';
            pledge.payment.status = 'cancelled';
            await pledge.save();
        } catch (error) {
            console.error(`Failed to cancel pledge ${pledge._id}:`, error.message);
        }
    }
};
