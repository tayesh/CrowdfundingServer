import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    tagline: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    thumbnail: {
        type: String,
        required: true
    },
    gallery: {
        type: [String],
        default: []
    },
    videoUrl: {
        type: String,
        default: null
    },
    category: {
        type: String,
        required: true
    },
    campaignType: {
        type: String,
        enum: ['reward', 'charity'],
        required: true
    },
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fundingGoal: {
        type: Number,
        required: true
    },
    totalRaised: {
        type: Number,
        default: 0
    },
    backerCount: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'BDT'
    },
    fundingModel: {
        type: String,
        enum: ['all-or-nothing', 'keep-it-all'],
        required: true
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    deadline: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'pending', 'active', 'successful', 'failed', 'cancelled', 'banned'],
        default: 'draft'
    },
    rewardProgressStatus: {
        type: String,
        enum: ['not_started', 'manufacturing', 'warehouse', 'transported', 'delivered'],
        default: 'not_started'
    },
    rewardProgressNote: {
        type: String,
        default: null
    },
    totalWithdrawn: {
        type: Number,
        default: 0
    },
    feePercentage: {
        type: Number,
        default: 10 // Default 10% platform fee
    },
    adminApproval: {
        isApproved: {
            type: Boolean,
            default: false
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        approvedAt: {
            type: Date,
            default: null
        },
        isFeatured: {
            type: Boolean,
            default: false
        },
        isFlagged: {
            type: Boolean,
            default: false
        },
        rejectionReason: {
            type: String,
            default: null
        }
    },
    charityDetails: {
        organizationName: String,
        registrationNumber: String
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

campaignSchema.virtual('rewardTiers', {
    ref: 'RewardTier',
    localField: '_id',
    foreignField: 'campaignId'
});

const Campaign = mongoose.model('Campaign', campaignSchema);
export default Campaign;
