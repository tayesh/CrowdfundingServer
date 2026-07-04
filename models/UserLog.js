import mongoose from 'mongoose';

const userLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        required: true
    },
    ipAddress: {
        type: String,
        default: '127.0.0.1'
    },
    userAgent: {
        type: String,
        default: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    },
    sessionMetadata: {
        cookieAttributes: {
            httpOnly: { type: Boolean, default: true },
            sameSite: { type: String, default: 'strict' },
            secure: { type: Boolean, default: true },
            maxAge: Number
        },
        tokenExpiry: Date
    }
}, { timestamps: true });

const UserLog = mongoose.model('UserLog', userLogSchema);
export default UserLog;
