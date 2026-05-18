import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import successStoryRoutes from './routes/successStoryRoutes.js';
import campaignUpdateRoutes from './routes/campaignUpdateRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { initCronJobs } from './utils/cronJobs.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setIo } from './utils/notificationHelper.js';

const app = express();
const port = process.env.PORT || 5000;
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true
    }
});

setIo(io);

// Socket.io Connection Logic
io.on('connection', (socket) => {
    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User joined room: ${userId}`);
    });

    socket.on('disconnect', () => {
        // Handle disconnect if needed
    });
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.get('/', (req, res) => {
    res.send('Crowdfunding Server is running');
});
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/success-stories', successStoryRoutes);
app.use('/api/updates', campaignUpdateRoutes);
app.use('/api/notifications', notificationRoutes);

// MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

connectDB();

// Init Cron Jobs
initCronJobs();

// Start Server
httpServer.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});
