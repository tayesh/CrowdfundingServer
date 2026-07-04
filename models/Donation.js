import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema({
    backerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true
    },
    rewardTierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RewardTier',
        default: null
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        required: true
    },
    payment: {
        gateway: {
            type: String,
            enum: ['sslcommerz', 'stripe', 'paypal'],
            required: true
        },
        gatewayTransactionId: {
            type: String,
            unique: true,
            sparse: true
        },
        gatewaySessionKey: String,
        status: {
            type: String,
            enum: ['pledged', 'charged', 'failed', 'cancelled', 'refunded', 'PRE_AUTHORIZED'],
            required: true
        },
        paidAt: Date,
        stripeDetails: {
            paymentIntentId: String,
            clientSecret: String,
            captureStatus: String
        },
        sslcommerzDetails: {
            sessionKey: String,
            transactionId: String,
            validationId: String
        }
    },
    status: {
        type: String,
        enum: ['pledged', 'charged', 'failed', 'cancelled', 'refunded', 'PRE_AUTHORIZED'],
        default: 'pledged'
    },
    rewardDelivery: {
        status: {
            type: String,
            enum: ['pending', 'shipped', 'delivered', 'sent'], // Deprecating global status for multi-reward projects
            default: 'pending'
        },
        fulfilledRewardTierIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'RewardTier'
        }],
        confirmedRewardTierIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'RewardTier'
        }],
        confirmedByBacker: {
            type: Boolean,
            default: false
        },
        shippingAddress: {
            fullName: String,
            phone: String,
            addressLine: String,
            city: String,
            district: String,
            postalCode: String,
            country: String
        },
        trackingNumber: String,
        shippedAt: Date,
        deliveredAt: Date
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    note: String
}, { timestamps: true });

const Donation = mongoose.model('Donation', donationSchema);
export default Donation;
