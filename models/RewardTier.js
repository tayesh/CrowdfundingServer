import mongoose from 'mongoose';

const rewardTierSchema = new mongoose.Schema({
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        default: null
    },
    minimumAmount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['email', 'physical'],
        default: 'physical'
    },
    availability: {
        isLimited: {
            type: Boolean,
            default: false
        },
        totalSlots: {
            type: Number,
            default: null
        },
        claimedSlots: {
            type: Number,
            default: 0
        },
        isSoldOut: {
            type: Boolean,
            default: false
        }
    },
    delivery: {
        estimatedDelivery: Date,
        isPhysical: {
            type: Boolean,
            default: false
        },
        shipsTo: {
            type: [String],
            default: []
        }
    }
}, { timestamps: true });

const RewardTier = mongoose.model('RewardTier', rewardTierSchema);
export default RewardTier;
