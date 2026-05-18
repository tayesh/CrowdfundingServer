import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import User from '../models/User.js';
import { generateAccessToken } from '../utils/jwt.js';
import { verifyJWT, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Multer Config
const upload = multer({ storage: multer.memoryStorage() }).single('profilePicture');

// Register
router.post('/register', upload, async (req, res) => {
    try {
        const { name, email, password, role, phone, nid, address, interests } = req.body;

        // Check if user already exists by email or NID
        const existingUser = await User.findOne({ 
            $or: [{ email }, { nid: nid || 'none' }] 
        });

        if (existingUser) {
            if (existingUser.approvalStatus === 'pending') {
                return res.status(400).json({ message: 'This registration is under verification check.' });
            }
            return res.status(400).json({ message: 'User already exists with this information.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Determine role and approval status
        const assignedRole = role === 'creator' ? ['creator'] : ['backer'];
        const approvalStatus = role === 'creator' ? 'pending' : 'approved';

        const user = new User({
            name,
            email,
            password: hashedPassword,
            role: assignedRole,
            phone,
            nid,
            address,
            interests: interests ? JSON.parse(interests) : [],
            approvalStatus
        });

        if (req.file) {
            user.profilePicture = {
                data: req.file.buffer,
                contentType: req.file.mimetype
            };
        }

        await user.save();

        if (approvalStatus === 'pending') {
            return res.status(201).json({
                message: 'Your registration is under approval. We will notify you once verified.',
                status: 'pending'
            });
        }

        const token = generateAccessToken(user);

        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (user.approvalStatus === 'pending') {
            return res.status(403).json({ message: 'Your account is under approval. Please wait for verification.' });
        }

        if (user.approvalStatus === 'rejected') {
            return res.status(403).json({ message: 'Your registration was rejected. Please contact support.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        user.lastLoginAt = new Date();
        await user.save();

        const token = generateAccessToken(user);

        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.status(200).json({
            message: 'Logged in successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get Current User
router.get('/me', verifyJWT, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'    });
    res.status(200).json({ message: 'Logged out successfully' });
});

// Public: Get Creator/User Profile
router.get('/creator/:id', async (req, res) => {
    try {
        const userProfile = await User.findById(req.params.id)
            .select('name email profilePicture creatorProfile createdAt role');
        
        if (!userProfile) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        res.status(200).json(userProfile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin: Get Pending Registrations
router.get('/users/pending', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        const users = await User.find({ approvalStatus: 'pending' }).select('-password').sort({ createdAt: -1 });
        
        // Convert Buffer to base64 for frontend display
        const usersWithBase64 = users.map(user => {
            const userObj = user.toObject();
            if (userObj.profilePicture?.data) {
                userObj.profilePicture.data = userObj.profilePicture.data.toString('base64');
            }
            return userObj;
        });

        res.status(200).json(usersWithBase64);
    } catch (error) {
        res.status(500).json(error.message);
    }
});

// Admin: Approve/Reject User Registration
router.patch('/users/:id/approve-registration', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        const { isApproved } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        user.approvalStatus = isApproved ? 'approved' : 'rejected';
        
        // If approved and not already a creator, add the creator role
        if (isApproved && !user.role.includes('creator')) {
            user.role.push('creator');
        }
        
        await user.save();
        
        // Trigger Notification for User
        await createNotification({
            recipient: user._id,
            type: 'VERIFICATION_STATUS',
            title: isApproved ? 'Registration Approved!' : 'Registration Rejected',
            message: isApproved 
                ? 'Congratulations! Your creator registration has been approved. You can now start creating campaigns.'
                : 'Unfortunately, your creator registration was rejected. Please contact support for more details.',
            link: isApproved ? '/create-campaign' : '/dashboard'
        });
        
        res.status(200).json({ message: `User registration ${isApproved ? 'approved' : 'rejected'} successfully`, user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin: Get All Users
router.get('/users', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Apply for Creator Role
router.patch('/apply-creator', verifyJWT, async (req, res) => {
    try {
        const { nid, address, phone } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        user.nid = nid;
        user.address = address;
        if (phone) user.phone = phone;
        user.approvalStatus = 'pending';
        // We don't add the role yet; Admin will do it upon approval
        
        await user.save();
        res.status(200).json({ message: 'Application submitted successfully', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
router.patch('/users/:id/toggle-ban', verifyJWT, authorizeRoles('admin'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        user.isBanned = !user.isBanned;
        await user.save();
        
        res.status(200).json({ message: `User ${user.isBanned ? 'banned' : 'unbanned'} successfully`, user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Profile
router.patch('/update-profile', verifyJWT, async (req, res) => {
    try {
        const { name, bio, website, socialLinks } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (name) user.name = name;
        
        // Use .set() for nested fields to ensure Mongoose tracks changes correctly
        if (bio !== undefined) user.set('creatorProfile.bio', bio);
        if (website !== undefined) user.set('creatorProfile.website', website);
        
        if (socialLinks) {
            if (socialLinks.facebook !== undefined) user.set('creatorProfile.socialLinks.facebook', socialLinks.facebook);
            if (socialLinks.twitter !== undefined) user.set('creatorProfile.socialLinks.twitter', socialLinks.twitter);
            if (socialLinks.linkedin !== undefined) user.set('creatorProfile.socialLinks.linkedin', socialLinks.linkedin);
        }

        await user.save();
        res.status(200).json({ message: 'Profile updated successfully', user });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ message: error.message });
    }
});

export default router;
