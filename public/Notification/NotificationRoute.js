const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Notification = require('../Schematics/NotificationSchema.js');
const User = require('../Schematics/UserSchema.js');

// Middleware to get current user
const getAuthUser = async (req) => {
    const token = req.session.token || req.headers['authorization']?.split(' ')[1];
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return await User.findById(decoded.userId);
    } catch (e) { return null; }
};

// 1. GET MY NOTIFICATIONS
router.get('/', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        // Get notifications for this user, newest first
        const notifs = await Notification.find({ recipient: user.name })
            .sort({ timestamp: -1 })
            .limit(20); // Only get last 20 to keep it fast

        // Count unread
        const unreadCount = await Notification.countDocuments({ recipient: user.name, isRead: false });

        res.json({ notifications: notifs, unread: unreadCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. MARK AS READ (When user opens the menu)
router.put('/mark-read', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        await Notification.updateMany(
            { recipient: user.name, isRead: false },
            { $set: { isRead: true } }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;