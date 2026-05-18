import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Notification from '../models/Notification.js';
import { createNotification } from '../utils/notificationHelper.js';

dotenv.config();

const testUser = new mongoose.Types.ObjectId();
const testSender = new mongoose.Types.ObjectId();

async function runTests() {
    console.log('🚀 Starting Standalone Notification Tests...');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Test 1: Create Notification
        console.log('\n--- Test 1: Notification Creation ---');
        const notificationData = {
            recipient: testUser,
            sender: testSender,
            type: 'SYSTEM_ALERT',
            title: 'Test Notification',
            message: 'This is a test notification',
            link: '/test-link'
        };

        const created = await createNotification(notificationData);
        if (created && created._id) {
            console.log('✅ Notification created successfully');
        } else {
            throw new Error('❌ Failed to create notification');
        }

        // Test 2: Verify Persistence
        console.log('\n--- Test 2: Verify Persistence ---');
        const found = await Notification.findById(created._id);
        if (found && found.title === notificationData.title) {
            console.log('✅ Notification found in DB with correct title');
        } else {
            throw new Error('❌ Notification not found or data mismatch');
        }

        // Test 3: Unread Count Logic
        console.log('\n--- Test 3: Unread Count Logic ---');
        const count = await Notification.countDocuments({ recipient: testUser, isRead: false });
        if (count >= 1) {
            console.log(`✅ Unread count for test user is correct (${count})`);
        } else {
            throw new Error('❌ Unread count is incorrect');
        }

        // Test 4: Cleanup
        console.log('\n--- Test 4: Cleanup ---');
        await Notification.deleteMany({ recipient: testUser });
        console.log('✅ Test data cleaned up');

    } catch (error) {
        console.error('\n🛑 Test Suite Failed:');
        console.error(error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🏁 Tests Finished. Connection closed.');
    }
}

runTests();
