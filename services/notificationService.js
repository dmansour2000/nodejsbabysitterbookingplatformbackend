const Notification = require('../models/Notification');
const User = require('../models/User');

let firebaseAdmin = null;

// Initialize Firebase Admin if FIREBASE_SERVICE_ACCOUNT or credentials provided
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const admin = require('firebase-admin');
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        firebaseAdmin = admin;
        console.log('[NotificationService] Firebase Admin SDK initialized successfully');
    }
} catch (e) {
    console.warn('[NotificationService] Firebase Admin SDK not initialized:', e.message);
}

/**
 * Send a notification to a user (in-app + optional Firebase push notification)
 * @param {Object} options
 * @param {string} options.recipientId - User ObjectId
 * @param {string} options.type - Notification type
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification body
 * @param {Object} [options.data] - Additional payload metadata
 */
async function sendNotification({ recipientId, type, title, message, data = {} }) {
    if (!recipientId || !title || !message) return null;

    try {
        // 1. Create in-app notification record in MongoDB
        const notification = await Notification.create({
            recipientId,
            type,
            title,
            message,
            data,
            read: false,
        });

        // 2. If Firebase Admin is available, dispatch push notification to registered FCM tokens
        if (firebaseAdmin) {
            try {
                const user = await User.findById(recipientId).select('fcmTokens');
                const tokens = (user?.fcmTokens || []).filter(Boolean);

                if (tokens.length > 0) {
                    const stringData = Object.entries(data).reduce((acc, [k, v]) => {
                        acc[k] = String(v);
                        return acc;
                    }, { notificationId: String(notification._id), type });

                    const response = await firebaseAdmin.messaging().sendEachForMulticast({
                        tokens,
                        notification: {
                            title,
                            body: message,
                        },
                        data: stringData,
                    });

                    // Clean up invalid or expired tokens
                    if (response.failureCount > 0) {
                        const failedTokens = [];
                        response.responses.forEach((resp, idx) => {
                            if (!resp.success) {
                                failedTokens.push(tokens[idx]);
                            }
                        });
                        if (failedTokens.length > 0) {
                            await User.updateOne(
                                { _id: recipientId },
                                { $pull: { fcmTokens: { $in: failedTokens } } }
                            );
                        }
                    }
                }
            } catch (fcmErr) {
                console.warn('[NotificationService] Firebase push dispatch warning:', fcmErr.message);
            }
        }

        return notification;
    } catch (err) {
        console.error('[NotificationService] Failed to create notification:', err.message);
        return null;
    }
}

module.exports = {
    sendNotification,
};

