import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    type: {
        type: String,
        enum: [
            'DONATION_RECEIVED', 
            'WITHDRAWAL_UPDATE', 
            'CAMPAIGN_UPDATE', 
            'VERIFICATION_STATUS', 
            'SYSTEM_ALERT',
            'MILESTONE_REACHED'
        ],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    link: {
        type: String,
        default: ''
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Auto-delete notifications older than 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
