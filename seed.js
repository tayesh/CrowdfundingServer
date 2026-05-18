import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';
import Campaign from './models/Campaign.js';
import RewardTier from './models/RewardTier.js';
import SuccessStory from './models/SuccessStory.js';
import fs from 'fs';

dotenv.config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected for advanced seeding with security overhaul fields...');

        // Clear existing data
        await User.deleteMany({});
        await Campaign.deleteMany({});
        await RewardTier.deleteMany({});
        await SuccessStory.deleteMany({});

        const hashedPassword = await bcrypt.hash('password123', 10);
        const credentials = [];

        // 1. Create Admins
        const admins = [
            { name: 'System Admin', email: 'admin@crowdfund.com', role: ['admin'] },
            { name: 'Moderator Sarah', email: 'sarah.mod@example.com', role: ['admin'] }
        ];

        for (const a of admins) {
            const user = new User({ 
                ...a, 
                password: hashedPassword,
                phone: '01711111111',
                approvalStatus: 'approved',
                interests: ['Technology', 'Environment']
            });
            await user.save();
            credentials.push(`${a.name} (${a.role.join(',')}): ${a.email} / password123`);
        }

        // 2. Create Creators
        const creators = [
            { name: 'John Tech', email: 'john@tech.com', bio: 'Building the next gen of gadgets.', role: ['creator', 'backer'], nid: '1990123456789', address: 'Dhaka, Bangladesh' },
            { name: 'Green Earth NGO', email: 'contact@greenearth.org', bio: 'Saving the planet one tree at a time.', role: ['creator'], nid: '1985987654321', address: 'Chittagong, Bangladesh' },
            { name: 'Creative Arts Studio', email: 'studio@art.com', bio: 'Bringing digital art to physical spaces.', role: ['creator'], nid: '1995555566666', address: 'Sylhet, Bangladesh' }
        ];

        const creatorDocs = [];
        for (const c of creators) {
            const user = new User({ 
                name: c.name, 
                email: c.email, 
                password: hashedPassword, 
                role: c.role,
                phone: '01822222222',
                approvalStatus: 'approved',
                nid: c.nid,
                address: c.address,
                interests: ['Technology', 'Arts', 'Design'],
                creatorProfile: { bio: c.bio }
            });
            const saved = await user.save();
            creatorDocs.push(saved);
            credentials.push(`${c.name} (${c.role.join(',')}): ${c.email} / password123`);
        }

        // 3. Create Backers
        const backers = [
            { name: 'Alice Backer', email: 'alice@backer.com' },
            { name: 'Bob Support', email: 'bob@support.com' },
            { name: 'Charlie Fan', email: 'charlie@fan.com' },
            { name: 'Dave Giver', email: 'dave@giver.com' },
            { name: 'Eve Investor', email: 'eve@investor.com' }
        ];

        for (const b of backers) {
            const user = new User({ 
                ...b, 
                password: hashedPassword, 
                role: ['backer'],
                phone: '01933333333',
                approvalStatus: 'approved',
                interests: ['Charity', 'Community', 'Games']
            });
            await user.save();
            credentials.push(`${b.name} (backer): ${b.email} / password123`);
        }

        // 4. Create Diverse Campaigns
        const campaigns = [
            {
                title: 'Solar-Powered Water Purification',
                tagline: 'Clean water for everyone.',
                description: 'A revolutionary system that uses solar energy to purify water in remote areas. We have tested this prototype in 5 villages and it works flawlessly.',
                thumbnail: 'https://greensuccessstories.com/wp-content/uploads/2024/01/Solar-Powered-Water-Purification-System.webp',
                category: 'Environment',
                campaignType: 'reward',
                creatorId: creatorDocs[0]._id,
                fundingGoal: 50000,
                fundingModel: 'all-or-nothing',
                deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'active',
                adminApproval: { isApproved: true, approvedBy: null, approvedAt: new Date() }
            },
            {
                title: 'Urban Vertical Farm',
                tagline: 'Grow fresh food in your apartment.',
                description: 'Our modular vertical farm kits allow anyone to grow organic vegetables in their kitchen with 90% less water.',
                thumbnail: 'https://i.cbc.ca/ais/1.7241115,1718900698000/full/max/0/default.jpg?im=Crop%2Crect%3D%280%2C466%2C4032%2C2268%29%3B',
                category: 'Technology',
                campaignType: 'reward',
                creatorId: creatorDocs[0]._id,
                fundingGoal: 25000,
                fundingModel: 'all-or-nothing',
                deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
                status: 'pending', // Waiting for approval
                adminApproval: { isApproved: false }
            },
            {
                title: 'Flood Relief - Sylhet 2026',
                tagline: 'Emergency support for families.',
                description: 'Families in Sylhet are facing devastating floods. We are providing dry food, medicine, and clean water to those in need.',
                thumbnail: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&q=80&w=800',
                category: 'Social Cause',
                campaignType: 'charity',
                creatorId: creatorDocs[1]._id,
                fundingGoal: 100000,
                fundingModel: 'keep-it-all',
                deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                status: 'active',
                adminApproval: { isApproved: true, approvedBy: null, approvedAt: new Date() }
            },
            {
                title: 'Digital Art VR Gallery',
                tagline: 'Experience art in a new dimension.',
                description: 'A virtual reality platform for digital artists to host immersive exhibitions. Accessible on all major headsets.',
                thumbnail: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=800',
                category: 'Creative',
                campaignType: 'reward',
                creatorId: creatorDocs[2]._id,
                fundingGoal: 15000,
                fundingModel: 'all-or-nothing',
                deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
                status: 'active',
                adminApproval: { isApproved: true, approvedBy: null, approvedAt: new Date() }
            }
        ];

        const savedCampaigns = await Campaign.insertMany(campaigns);

        // 5. Add Tiers to Reward Campaigns
        const tiers = [
            {
                campaignId: savedCampaigns[0]._id,
                title: 'Early Supporter',
                description: 'Get a thank you note and a digital sticker pack.',
                minimumAmount: 10,
                availability: { isLimited: false }
            },
            {
                campaignId: savedCampaigns[0]._id,
                title: 'Solar Pack',
                description: 'One small solar unit for your backyard.',
                minimumAmount: 150,
                availability: { isLimited: true, totalSlots: 20, claimedSlots: 5 }
            },
            {
                campaignId: savedCampaigns[3]._id,
                title: 'Founding Member',
                description: 'Lifetime access to all future VR galleries.',
                minimumAmount: 50,
                availability: { isLimited: true, totalSlots: 100, claimedSlots: 12 }
            }
        ];

        await RewardTier.insertMany(tiers);

        // 6. Create Success Stories
        const successStories = [
            {
                title: "The Eco-Bottle Revolution",
                category: "Technology",
                raised: "$124,500",
                backers: "1,240",
                image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80",
                quote: "This platform gave us the reach we never thought possible. We went from a garage prototype to mass production in 6 months.",
                author: "Sarah Jenkins",
                role: "Founder, GreenFlow"
            },
            {
                title: "Urban Farming Vertical",
                category: "Environment",
                raised: "$89,200",
                backers: "850",
                image: "https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&w=800&q=80",
                quote: "The community support was overwhelming. Beyond the funds, we gained 800+ brand ambassadors for our mission.",
                author: "David Chen",
                role: "Co-founder, SkyGreens"
            },
            {
                title: "Sonic Wireless Headphones",
                category: "Audio",
                raised: "$210,000",
                backers: "2,100",
                image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
                quote: "The feedback from our backers helped us refine the product design before we even started manufacturing.",
                author: "Marcus Thorne",
                role: "Lead Designer, Sonic Labs"
            },
            {
                title: "Empowering Rural Education",
                category: "Education",
                raised: "$45,000",
                backers: "560",
                image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80",
                quote: "Thanks to our backers, 200 children in remote villages now have access to digital learning tools for the first time.",
                author: "Maria Rodriguez",
                role: "Director, EduReach"
            }
        ];

        await SuccessStory.insertMany(successStories);

        // Save credentials to file
        fs.writeFileSync('../credentials.txt', credentials.join('\n'));
        console.log('Seed data inserted and credentials.txt generated successfully');
        process.exit();
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seedData();
