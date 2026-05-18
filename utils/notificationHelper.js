import Notification from '../models/Notification.js';

let ioInstance = null;

export const setIo = (io) => {
    ioInstance = io;
};

/**
 * Creates and saves a notification and emits via Socket.io if available.
 * @param {Object} data - Notification data
 * @param {string} data.recipient - User ID of the recipient
 * @param {string} [data.sender] - User ID of the sender
 * @param {string} data.type - Notification type (enum)
 * @param {string} data.title - Notification title
 * @param {string} data.message - Notification message
 * @param {string} [data.link] - Redirect link
 * @returns {Promise<Object>} - The created notification
 */
export const createNotification = async ({ recipient, sender, type, title, message, link }) => {
    try {
        const notification = new Notification({
            recipient,
            sender,
            type,
            title,
            message,
            link
        });
        await notification.save();
        
        if (ioInstance) {
            ioInstance.to(recipient.toString()).emit('new_notification', notification);
        }
        
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};
