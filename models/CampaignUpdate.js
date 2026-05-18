import mongoose from 'mongoose';

const campaignUpdateSchema = new mongoose.Schema({
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true
    },
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    images: {
        type: [String],
        default: []
    },
    isBackerOnly: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Add index for faster querying by campaign
campaignUpdateSchema.index({ campaignId: 1, createdAt: -1 });

const CampaignUpdate = mongoose.model('CampaignUpdate', campaignUpdateSchema);
export default CampaignUpdate;
