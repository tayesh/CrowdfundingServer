import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Campaign from './models/Campaign.js';
import Withdrawal from './models/Withdrawal.js';

dotenv.config();

const fixData = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('Error: MONGODB_URI not found in .env file');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('--- Database Connected ---');

        const campaigns = await Campaign.find();
        console.log(`Checking ${campaigns.length} campaigns...`);

        for (const campaign of campaigns) {
            // Sum only non-rejected withdrawals
            // We use netAmount because that is what was added to the totalWithdrawn
            const withdrawals = await Withdrawal.find({ 
                campaignId: campaign._id, 
                status: { $ne: 'rejected' } 
            });
            
            const actualTotal = withdrawals.reduce((sum, w) => sum + (Number(w.netAmount) || 0), 0);
            
            if (campaign.totalWithdrawn !== actualTotal) {
                console.log(`\nFixing Campaign: ${campaign.title}`);
                console.log(`  > Current (String-Buggy): ${campaign.totalWithdrawn}`);
                console.log(`  > Correct (Numerical): ${actualTotal}`);
                
                campaign.totalWithdrawn = actualTotal;
                await campaign.save();
                console.log(`  [SUCCESS] Updated.`);
            }
        }

        console.log('\n--- Cleanup complete! ---');
        process.exit(0);
    } catch (error) {
        console.error('An error occurred:', error);
        process.exit(1);
    }
};

fixData();
