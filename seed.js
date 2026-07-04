import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';

// Model Imports
import User from './models/User.js';
import Campaign from './models/Campaign.js';
import RewardTier from './models/RewardTier.js';
import SuccessStory from './models/SuccessStory.js';
import Donation from './models/Donation.js';
import Withdrawal from './models/Withdrawal.js';
import CampaignUpdate from './models/CampaignUpdate.js';
import Notification from './models/Notification.js';
import Message from './models/Message.js';
import Comment from './models/Comment.js';
import UserLog from './models/UserLog.js';

dotenv.config();

const seedData = async () => {
    try {
        console.log('Establishing connection to MongoDB database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Successfully connected to MongoDB.');

        console.log('Purging existing data from all collections...');
        await Promise.all([
            User.deleteMany({}),
            Campaign.deleteMany({}),
            RewardTier.deleteMany({}),
            SuccessStory.deleteMany({}),
            Donation.deleteMany({}),
            Withdrawal.deleteMany({}),
            CampaignUpdate.deleteMany({}),
            Notification.deleteMany({}),
            Message.deleteMany({}),
            Comment.deleteMany({}),
            UserLog.deleteMany({})
        ]);
        console.log('All collections purged successfully.');

        // 1. Password and Session setup
        const plainPassword = 'password123';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        const credentials = [];

        console.log('Generating system user profiles across standard and administrative roles...');
        
        // Seed Admins
        const adminData = {
            name: 'Platform Super-Admin',
            email: 'admin@crowdfund.com',
            password: hashedPassword,
            phone: '01711111111',
            role: ['admin'],
            approvalStatus: 'approved',
            interests: ['Technology', 'Environment', 'Creative'],
            isEmailVerified: true
        };
        const superAdmin = await new User(adminData).save();
        credentials.push(`Platform Super-Admin (admin): ${adminData.email} / ${plainPassword}`);

        // Seed Creator
        const creatorData = {
            name: 'Jane Innovator',
            email: 'creator@crowdfund.com',
            password: hashedPassword,
            phone: '01822222222',
            role: ['creator', 'backer'],
            approvalStatus: 'approved',
            nid: '1992987654321',
            address: '123 Tech Lane, Karwan Bazar, Dhaka',
            interests: ['Technology', 'Environment', 'Design'],
            creatorProfile: {
                bio: 'Pioneering eco-friendly engineering solutions and sustainable consumer tech. Building hardware that heals the earth.',
                website: 'https://janeinnovator.tech',
                socialLinks: {
                    facebook: 'https://facebook.com/janeinnovator',
                    twitter: 'https://twitter.com/janeinnovator',
                    linkedin: 'https://linkedin.com/in/janeinnovator'
                }
            },
            isEmailVerified: true
        };
        const creator = await new User(creatorData).save();
        credentials.push(`Jane Innovator (creator,backer): ${creatorData.email} / ${plainPassword}`);

        // Seed Backers
        const backerList = [
            { name: 'Alex Backer', email: 'backer@crowdfund.com', phone: '01933333333' },
            { name: 'Bob Support', email: 'bob@support.com', phone: '01944444444' },
            { name: 'Charlie Fan', email: 'charlie@fan.com', phone: '01955555555' },
            { name: 'Dave Giver', email: 'dave@giver.com', phone: '01966666666' },
            { name: 'Eve Investor', email: 'eve@investor.com', phone: '01977777777' }
        ];

        const backers = [];
        for (const b of backerList) {
            const u = await new User({
                ...b,
                password: hashedPassword,
                role: ['backer'],
                approvalStatus: 'approved',
                interests: ['Technology', 'Environment', 'Charity'],
                isEmailVerified: true
            }).save();
            backers.push(u);
            credentials.push(`${b.name} (backer): ${b.email} / ${plainPassword}`);
        }

        console.log('Seeding crowdfunding campaign models with varying progress states...');

        // 2. Seed Campaigns
        const campaignsData = [
            {
                title: 'Haptic Gaming Vest v2',
                tagline: 'Feel the game like never before.',
                description: 'Experience high-fidelity tactical feedback with our next-gen gaming vest. Featuring 16 point localized vibration motors, ultra-low latency Bluetooth 5.3, and a comfortable, adjustable design compatible with PC, consoles, and VR headsets.',
                thumbnail: 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&q=80&w=800',
                category: 'Technology',
                campaignType: 'reward',
                creatorId: creator._id,
                fundingGoal: 100000,
                totalRaised: 15000, // 15% - Early Traction
                backerCount: 3,
                fundingModel: 'all-or-nothing',
                deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days in future
                status: 'active',
                adminApproval: { isApproved: true, approvedBy: superAdmin._id, approvedAt: new Date() }
            },
            {
                title: 'Zero-Waste Home Composter',
                tagline: 'Turn waste into nutrient-rich soil in 24 hours.',
                description: 'An odorless, countertop compost machine that processes food scraps quietly and efficiently. Reduces household waste by up to 90% and produces organic compost at the touch of a button. Built with recycled marine plastics.',
                thumbnail: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
                category: 'Environment',
                campaignType: 'reward',
                creatorId: creator._id,
                fundingGoal: 50000,
                totalRaised: 41000, // 82% - High Momentum
                backerCount: 12,
                fundingModel: 'keep-it-all',
                deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days in future
                status: 'active',
                adminApproval: { isApproved: true, approvedBy: superAdmin._id, approvedAt: new Date() }
            },
            {
                title: 'Modular Mechanical Keyboard Project',
                tagline: 'The ultimate hot-swappable CNC keyboard.',
                description: 'A beautifully crafted, gasket-mounted CNC aluminum mechanical keyboard with hot-swappable sockets, south-facing RGB, custom tuned stabilizers, and a modular OLED auxiliary screen display. Tailor every keystroke to your workflow.',
                thumbnail: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=800',
                category: 'Creative',
                campaignType: 'reward',
                creatorId: creator._id,
                fundingGoal: 200000,
                totalRaised: 208000, // 104% - Successfully Funded
                backerCount: 25,
                fundingModel: 'all-or-nothing',
                deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days in future
                status: 'active',
                adminApproval: { isApproved: true, approvedBy: superAdmin._id, approvedAt: new Date() }
            },
            {
                title: 'All-or-Nothing Eco-Tech Initiative',
                tagline: 'Revolutionizing carbon capture at home.',
                description: 'A residential carbon capture air purifier designed to filter particulate matter and scrub carbon dioxide from indoor environments. Features smart sensor arrays, silent brushless fans, and custom-recyclable natural capture cartridges.',
                thumbnail: 'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?auto=format&fit=crop&w=800&q=80',
                category: 'Environment',
                campaignType: 'reward',
                creatorId: creator._id,
                fundingGoal: 100000,
                totalRaised: 105000, // 105% - Reached goal & past deadline
                backerCount: 5,
                fundingModel: 'all-or-nothing',
                deadline: new Date(Date.now() - 24 * 60 * 60 * 1000), // Reached deadline 1 day ago
                status: 'successful',
                adminApproval: { isApproved: true, approvedBy: superAdmin._id, approvedAt: new Date() }
            }
        ];

        const seededCampaigns = await Campaign.insertMany(campaignsData);
        console.log('Seeded 4 campaigns successfully (15%, 82%, 104%, and 105% Stripe Pre-auth targets).');

        // 3. Seed Reward Tiers
        console.log('Creating reward tiers linked to campaigns...');
        const rewardTiersData = [
            {
                campaignId: seededCampaigns[0]._id,
                title: 'Early Bird - Haptic Vest',
                description: 'Secure one Haptic Gaming Vest v2 at 35% off retail. Includes the tactical vest, custom cables, and desktop configuration suite.',
                minimumAmount: 5000,
                availability: { isLimited: true, totalSlots: 50, claimedSlots: 3 }
            },
            {
                campaignId: seededCampaigns[1]._id,
                title: 'Eco Composter Single Pack',
                description: 'One countertop Home Composter kit with a 3-month supply of natural carbon filters and composting starter pack.',
                minimumAmount: 3000,
                availability: { isLimited: false }
            },
            {
                campaignId: seededCampaigns[2]._id,
                title: 'Founders Edition Keyboard Kit',
                description: 'Includes the gasket keyboard frame, brass plate, south-facing hot-swap PCB, modular OLED screen, and hand-greased stabs.',
                minimumAmount: 8000,
                availability: { isLimited: true, totalSlots: 100, claimedSlots: 26 }
            },
            {
                campaignId: seededCampaigns[3]._id,
                title: 'Carbon Scrubber Core Unit',
                description: 'One Eco-Tech carbon capture air purifier unit plus 4 eco-charcoal replacement filters. Guaranteed clean indoor air.',
                minimumAmount: 21000,
                availability: { isLimited: true, totalSlots: 50, claimedSlots: 5 }
            }
        ];

        const seededTiers = await RewardTier.insertMany(rewardTiersData);
        console.log('Seeded reward tiers.');

        // 4. Seed Stripe Pre-Authorization transactional ledger history
        console.log('Creating transactional ledger (Donations) for Stripe Pre-Auth verification...');
        const preAuthDonations = [];
        
        for (let i = 0; i < 5; i++) {
            const backerUser = backers[i];
            const donation = new Donation({
                backerId: backerUser._id,
                campaignId: seededCampaigns[3]._id,
                rewardTierId: seededTiers[3]._id,
                amount: 21000,
                currency: 'USD',
                payment: {
                    gateway: 'stripe',
                    gatewayTransactionId: `ch_stripe_preauth_mock_${backerUser._id}_${i}`,
                    gatewaySessionKey: `session_stripe_secret_${backerUser._id}_${i}`,
                    status: 'PRE_AUTHORIZED',
                    paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Pledged 2 days ago
                    stripeDetails: {
                        paymentIntentId: `pi_preauth_intent_${backerUser._id}_${i}`,
                        clientSecret: `pi_preauth_secret_${backerUser._id}_${i}`,
                        captureStatus: 'PRE_AUTHORIZED'
                    }
                },
                status: 'PRE_AUTHORIZED',
                rewardDelivery: {
                    status: 'pending',
                    fulfilledRewardTierIds: [],
                    confirmedRewardTierIds: [],
                    confirmedByBacker: false,
                    shippingAddress: {
                        fullName: backerUser.name,
                        phone: backerUser.phone,
                        addressLine: `${100 + i * 20} Eco Boulevard, Block G`,
                        city: 'Dhaka',
                        district: 'Dhaka',
                        postalCode: '1212',
                        country: 'Bangladesh'
                    }
                },
                isAnonymous: false,
                note: `Stripe Pre-Auth Commitment for Carbon Scrubber Unit - Backer ${backerUser.name}`
            });
            preAuthDonations.push(donation);
        }

        await Donation.insertMany(preAuthDonations);
        console.log('Seeded 5 pre-authorized transactional commitments for Stripe.');

        // 5. Seed Cron capture logs
        console.log('Seeding system notifications and background cron capture queue logs...');
        
        await new Notification({
            recipient: superAdmin._id,
            sender: null,
            type: 'SYSTEM_ALERT',
            title: 'Stripe Cron Capture Queue Initialized',
            message: `Cron job detected AON campaign 'All-or-Nothing Eco-Tech Initiative' (${seededCampaigns[3]._id}) successfully met deadline with 105% funding. Batch processing initialized for 5 pending pre-authorized Stripe intents.`,
            link: `/admin/finance`,
            isRead: false
        }).save();

        await new Notification({
            recipient: creator._id,
            sender: null,
            type: 'MILESTONE_REACHED',
            title: 'Campaign Funding Goal Reached!',
            message: `Congratulations! Your campaign 'All-or-Nothing Eco-Tech Initiative' closed successfully at 105% ($105,000/$100,000). The Stripe capture system is now executing the batch transfer.`,
            link: `/dashboard?tab=my-projects`,
            isRead: false
        }).save();

        // 6. Seed Real-Time Communication Logs (Comments and private Messages)
        console.log('Seeding messaging and campaign discussion threads between creator and backer...');
        
        // Comments (Public)
        const commentsData = [
            {
                campaignId: seededCampaigns[0]._id, // Haptic Gaming Vest
                userId: backers[0]._id, // Alex Backer
                comment: 'Hi Jane, regarding the gaming vest: does it support Bluetooth 5.3? Also, what is the estimated shipping timeline for the early bird tiers in South Asia?'
            }
        ];
        const seededComment1 = await new Comment(commentsData[0]).save();

        const replyComment1 = await new Comment({
            campaignId: seededCampaigns[0]._id,
            userId: creator._id, // Jane Innovator
            comment: 'Hello Alex! Yes, the vest is fully compatible with Bluetooth 5.3 and features a wireless latency of under 10ms. For South Asian backers, we are on track to begin shipments in late October 2026. A detailed update with tracking portals will go live next week!',
            parentId: seededComment1._id
        }).save();

        const replyComment2 = await new Comment({
            campaignId: seededCampaigns[0]._id,
            userId: backers[0]._id,
            comment: 'Awesome! Thanks for the quick response. Just pledged for the Early Bird pack. Can\'t wait!',
            parentId: replyComment1._id
        }).save();

        const replyComment3 = await new Comment({
            campaignId: seededCampaigns[0]._id,
            userId: creator._id,
            comment: 'Thank you for the support, Alex! Welcome to the haptic gaming revolution! Let me know if you need anything else.',
            parentId: replyComment2._id
        }).save();

        // Messages (Private 1-on-1 Inbox)
        const privateMessages = [
            {
                campaignId: seededCampaigns[0]._id,
                senderId: backers[0]._id, // Alex
                recipientId: creator._id, // Jane
                message: 'Hi Jane, I just backed the Haptic Vest project, but I think I made a small typo in my shipping address. Can I change it before the campaign closes?',
                isRead: true,
                createdAt: new Date(Date.now() - 3600 * 1000) // 1 hour ago
            },
            {
                campaignId: seededCampaigns[0]._id,
                senderId: creator._id, // Jane
                recipientId: backers[0]._id, // Alex
                message: 'Hi Alex! No worries at all. You can update your shipping details anytime directly from your dashboard under the "Backed Campaigns" tab. Let me know if you run into any issues with the form!',
                isRead: true,
                createdAt: new Date(Date.now() - 1800 * 1000) // 30 mins ago
            },
            {
                campaignId: seededCampaigns[0]._id,
                senderId: backers[0]._id, // Alex
                recipientId: creator._id, // Jane
                message: 'Found it and updated it successfully. Thank you so much for the super fast response! Outstanding creator support.',
                isRead: true,
                createdAt: new Date(Date.now() - 900 * 1000) // 15 mins ago
            },
            {
                campaignId: seededCampaigns[0]._id,
                senderId: creator._id, // Jane
                recipientId: backers[0]._id, // Alex
                message: 'Perfect! Glad to hear that. We appreciate you being part of this journey. Feel free to shoot over any other questions!',
                isRead: false,
                createdAt: new Date(Date.now() - 300 * 1000) // 5 mins ago
            }
        ];
        await Message.insertMany(privateMessages);
        console.log('Discussion comments and private message history seeded.');

        // 7. Seed User Security Grids (Logs and session metadata)
        console.log('Seeding security logs and session metadata with HTTP-Only/SameSite details...');
        const userLogsData = [
            {
                userId: superAdmin._id,
                action: 'ADMIN_SIGN_IN',
                ipAddress: '192.168.1.10',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                sessionMetadata: {
                    cookieAttributes: {
                        httpOnly: true,
                        sameSite: 'strict',
                        secure: true,
                        maxAge: 86400
                    },
                    tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            },
            {
                userId: creator._id,
                action: 'CREATOR_SIGN_IN',
                ipAddress: '192.168.1.12',
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
                sessionMetadata: {
                    cookieAttributes: {
                        httpOnly: true,
                        sameSite: 'strict',
                        secure: true,
                        maxAge: 86400
                    },
                    tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            },
            {
                userId: backers[0]._id,
                action: 'BACKER_SIGN_IN',
                ipAddress: '192.168.1.45',
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
                sessionMetadata: {
                    cookieAttributes: {
                        httpOnly: true,
                        sameSite: 'strict',
                        secure: true,
                        maxAge: 86400
                    },
                    tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            }
        ];
        await UserLog.insertMany(userLogsData);
        console.log('Seeded user security grids.');

        // 8. Seed Withdrawal and Financial Splits (Bonus)
        console.log('Seeding advanced financial splits (Stage 1 Completed / Stage 2 Pending)...');
        
        const keyboardCampaign = seededCampaigns[2]; // Modular Keyboard
        
        // Stage 1: Payout of 70% of funds
        const withdrawalStage1 = new Withdrawal({
            creatorId: creator._id,
            campaignId: keyboardCampaign._id,
            requestedAmount: 145600, // 70% of Net Funds (208000 raised - 10% fee = 187200 net pool)
            platformFee: 20800, // 10% Platform fee of 208000
            netAmount: 124800, // net Stage 1 payout
            method: 'Bank Transfer',
            accountNumber: '1234-5678-9012-00',
            bankDetails: {
                bankName: 'Eastern Bank Limited',
                routingNumber: '010260023'
            },
            status: 'completed',
            stage: 1,
            processedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Processed 5 days ago
            paymentProof: 'https://example.com/proofs/pay_keyboard_stage1.pdf',
            adminComment: 'Stage 1 (70%) payout processed successfully following initial creator audit and milestone verification.'
        });

        // Stage 2: Pending payout of 30% of funds
        const withdrawalStage2 = new Withdrawal({
            creatorId: creator._id,
            campaignId: keyboardCampaign._id,
            requestedAmount: 62400, // 30% of Net Funds
            platformFee: 0, // already charged in Stage 1
            netAmount: 56160, // net Stage 2 payout (30% of 187200 net pool = 56160)
            method: 'Bank Transfer',
            accountNumber: '1234-5678-9012-00',
            bankDetails: {
                bankName: 'Eastern Bank Limited',
                routingNumber: '010260023'
            },
            status: 'pending',
            stage: 2,
            adminComment: 'Awaiting 80% backer delivery/fulfillment confirmations to unlock and release Stage 2 (30%) remaining funds.'
        });

        await Promise.all([
            withdrawalStage1.save(),
            withdrawalStage2.save()
        ]);
        console.log('Seeded stage-split (70/30) withdrawal scenarios.');

        // 9. Seed Success Stories
        console.log('Seeding platform success stories...');
        const successStories = [
            {
                title: 'The Eco-Bottle Revolution',
                category: 'Technology',
                raised: '$124,500',
                backers: '1,240',
                image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
                quote: 'This platform gave us the reach we never thought possible. We went from a garage prototype to mass production in 6 months.',
                author: 'Sarah Jenkins',
                role: 'Founder, GreenFlow'
            },
            {
                title: 'Urban Farming Vertical',
                category: 'Environment',
                raised: '$89,200',
                backers: '850',
                image: 'https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&w=800&q=80',
                quote: 'The community support was overwhelming. Beyond the funds, we gained 800+ brand ambassadors for our mission.',
                author: 'David Chen',
                role: 'Co-founder, SkyGreens'
            }
        ];
        await SuccessStory.insertMany(successStories);
        console.log('Seeded success stories.');

        // Write credentials to file
        fs.writeFileSync('../credentials.txt', credentials.join('\n'));
        console.log('Generated credentials.txt with system logins.');
        
        console.log('All seed data inserted successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Seeding process encountered an error:', error);
        process.exit(1);
    }
};

seedData();
