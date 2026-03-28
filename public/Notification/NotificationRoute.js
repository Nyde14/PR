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

        const notifs = await Notification.find({ recipient: user.name })
            .sort({ timestamp: -1 })
            .limit(10); 

        // UPDATED: Count UNSEEN instead of UNREAD for the notification bell badge
        const unseenCount = await Notification.countDocuments({ recipient: user.name, isSeen: false });

        res.json({ notifications: notifs, unseen: unseenCount });
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
router.put('/mark-seen', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        await Notification.updateMany(
            { recipient: user.name, isSeen: false },
            { $set: { isSeen: true } }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/test-live', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const newNotif = new Notification({
            recipient: user.name,
            message: "This is a live test notification!",
            type: "success"
        });
        await newNotif.save();

        // --- WEBSOCKET MAGIC: Fire the live event! ---
        const io = req.app.get('io');
        const activeUsers = req.app.get('activeUsers');
        const socketId = activeUsers.get(user.name);

        if (socketId) {
            io.to(socketId).emit('new_notification', newNotif);
        }

        res.json({ success: true, message: "Live notification sent!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;