import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    profilePicture: {
        data: Buffer,
        contentType: String
    },
    phone: {
        type: String,
        required: true
    },
    role: {
        type: [String],
        enum: ['backer', 'creator', 'admin'],
        default: ['backer']
    },
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'approved'
    },
    nid: {
        type: String,
        unique: true,
        sparse: true
    },
    address: {
        type: String,
        default: null
    },
    interests: {
        type: [String],
        default: []
    },
    creatorProfile: {
        bio: String,
        website: String,
        socialLinks: {
            facebook: String,
            twitter: String,
            linkedin: String
        },
        withdrawalAccounts: {
            bkash: String,
            nagad: String,
            bankAccount: {
                bankName: String,
                accountNumber: String,
                routingNumber: String
            }
        }
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isBanned: {
        type: Boolean,
        default: false
    },
    bannedReason: {
        type: String,
        default: null
    },
    lastLoginAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;
