import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Donation from './models/Donation.js';
import Withdrawal from './models/Withdrawal.js';
import Campaign from './models/Campaign.js';

dotenv.config();

const clearPayments = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB. Clearing payment records...');

        // 1. Delete all donations
        const donationResult = await Donation.deleteMany({});
        console.log(`Deleted ${donationResult.deletedCount} donations.`);

        // 2. Delete all withdrawals
        const withdrawalResult = await Withdrawal.deleteMany({});
        console.log(`Deleted ${withdrawalResult.deletedCount} withdrawals.`);

        // 3. Reset campaign stats (totalRaised and backerCount)
        const campaignResult = await Campaign.updateMany(
            {},
            { 
                $set: { 
                    totalRaised: 0, 
                    backerCount: 0 
                } 
            }
        );
        console.log(`Reset stats for ${campaignResult.modifiedCount} campaigns.`);

        console.log('Payment records cleared and campaigns reset successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error clearing payment records:', error);
        process.exit(1);
    }
};

clearPayments();
