const express = require('express');
const router = express.Router();
const Report = require('../Schematics/ReportSchema');
const User = require('../Schematics/UserSchema');
const ClubPost = require('../Schematics/ClubPostSchema');
const Club = require('../Schematics/ClubSchema');
const Message = require('../Schematics/MessageSchema');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Helper: Get Current User
const getUser = async (req) => {
    const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return await User.findById(decoded.userId);
    } catch (e) { return null; }
};

// 1. SUBMIT A REPORT
router.post('/submit', async (req, res) => {
    try {
        const { targetType, targetId, reason } = req.body;
        const user = await getUser(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const newReport = new Report({
            reporter: user.name,
            targetType,
            targetId,
            reason
        });

        await newReport.save();
        res.json({ message: "Report submitted. Admins will review it shortly." });

    } catch (error) {
        console.error("Report Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// 2. GET ALL REPORTS (Admin Only)
router.get('/all', async (req, res) => {
    try {
        const user = await getUser(req);
        if (!user || user.usertype !== 'Admin') {
            return res.status(403).json({ message: "Access Denied" });
        }

        const reports = await Report.find().sort({ timestamp: -1 });
        res.json(reports);
    } catch (e) {
        res.status(500).json({ message: "Server error" });
    }
});

// 3. RESOLVE REPORT (Admin Only)
router.patch('/:id/resolve', async (req, res) => {
    try {
        const { status } = req.body; // 'Resolved' or 'Dismissed'
        const user = await getUser(req);
        
        if (!user || user.usertype !== 'Admin') return res.status(403).json({ message: "Denied" });

        await Report.findByIdAndUpdate(req.params.id, { 
            status: status, 
            resolvedBy: user.name 
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: "Server error" });
    }
});

// 4. GET REDIRECT URL (FIXED FOR DIRECT ACCESS)
router.get('/:id/redirect', async (req, res) => {
    try {
        const user = await getUser(req);
        if (!user || user.usertype !== 'Admin') return res.status(403).json({ message: "Denied" });

        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: "Report not found" });

        let redirectUrl = null;

        if (report.targetType === 'Post') {
            const post = await ClubPost.findById(report.targetId);
            if (!post) return res.status(404).json({ message: "Content deleted" });

            const club = await Club.findOne({ clubname: post.clubname });
            const slug = club ? club.urlSlug : 'general';
            
            redirectUrl = `/ClubProfile/ClubProfile.html?slug=${slug}&postId=${report.targetId}`;

        } else if (report.targetType === 'Message') {
            const msg = await Message.findById(report.targetId);
            if (!msg) return res.status(404).json({ message: "Content deleted" });

            if (msg.clubname) {
                // Group Chat: Link to Club Chat
                redirectUrl = `/public/ClubChat/ClubChat.html?club=${encodeURIComponent(msg.clubname)}&msgId=${report.targetId}`;
            } else {
                // Private Chat: Link DIRECTLY to ClubChat in Private Mode
                // We use msg.sender as the room name. 
                // Since the user is an Admin, server.js allows them to see all messages for this sender.
                redirectUrl = `/public/ClubChat/ClubChat.html?room=${encodeURIComponent(msg.sender)}&type=private&msgId=${report.targetId}`;
            }
        }

        res.json({ url: redirectUrl });

    } catch (error) {
        console.error("Redirect Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});
router.get('/:id/view', async (req, res) => {
    try {
        const user = await getUser(req);
        if (!user || user.usertype !== 'Admin') return res.status(403).json({ message: "Denied" });

        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: "Report not found" });

        // A. IF POST
        if (report.targetType === 'Post') {
            const post = await ClubPost.findById(report.targetId);
            if (!post) return res.json({ type: 'Deleted', message: "This post has been deleted." });

            const club = await Club.findOne({ clubname: post.clubname });
            const slug = club ? club.urlSlug : 'general';
            
            return res.json({ 
                type: 'Post', 
                url: `/ClubProfile/ClubProfile.html?slug=${slug}&postId=${report.targetId}` 
            });
        }

        // B. IF MESSAGE
        if (report.targetType === 'Message') {
            const msg = await Message.findById(report.targetId);
            if (!msg) return res.json({ type: 'Deleted', message: "This message has been deleted." });

            return res.json({
                type: 'Message',
                data: {
                    messageId: msg._id, // <--- ADDED THIS LINE
                    sender: msg.sender,
                    content: msg.content,
                    mediaUrl: msg.mediaUrl,
                    mediaType: msg.mediaType,
                    timestamp: msg.timestamp,
                    context: msg.clubname ? `Group: ${msg.clubname}` : `Private Message`
                }
            });
        }

    } catch (error) {
        console.error("View Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
