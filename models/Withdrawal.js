import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true
    },
    requestedAmount: {
        type: Number,
        required: true
    },
    platformFee: {
        type: Number,
        required: true
    },
    netAmount: {
        type: Number,
        required: true
    },
    method: {
        type: String,
        enum: ['Bank Transfer', 'Bkash', 'Nagad', 'Paypal', 'bkash', 'nagad', 'bank', 'paypal'],
        required: true
    },
    accountNumber: {
        type: String,
        required: true
    },
    bankDetails: {
        bankName: String,
        routingNumber: String
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'completed', 'rejected'],
        default: 'pending'
    },
    stage: {
        type: Number,
        enum: [1, 2],
        default: 1
    },
    processedAt: Date,
    rejectionReason: String,
    paymentProof: String,
    adminComment: String
}, { timestamps: true });

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
export default Withdrawal;
