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
        
        // Validate inputs
        if (!targetType || !targetId || !reason) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        
        const user = await getUser(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        console.log("Submitting report:", { targetType, targetId, reason, reporter: user.name });

        const newReport = new Report({
            reporter: user.name,
            targetType,
            targetId,
            reason,
            status: 'Pending' // Set initial status
        });

        const saved = await newReport.save();
        console.log("Report saved successfully:", saved._id);
        
        res.json({ message: "Report submitted. Admins will review it shortly.", reportId: saved._id });

    } catch (error) {
        console.error("Report Submission Error:", error);
        res.status(500).json({ message: "Failed to submit report", error: error.message });
    }
});

// 2. GET ALL REPORTS (Admin Only)
router.get('/all', async (req, res) => {
    try {
        // Sort by newest first
        const reports = await Report.find().sort({ timestamp: -1 });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
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
                    messageId: msg._id,
                    sender: msg.sender,
                    content: msg.content,
                    mediaUrl: msg.mediaUrl,
                    mediaType: msg.mediaType,
                    timestamp: msg.timestamp,
                    context: msg.clubname ? `Group: ${msg.clubname}` : `Private Message`
                }
            });
        }

        // C. IF COMMENT or REPLY
        if (report.targetType === 'Comment' || report.targetType === 'Reply') {
            // targetId format: "postId|commentId" or "postId|commentId|replyId"
            const parts = report.targetId.split('|');
            const postId = parts[0];
            const commentId = parts[1];
            const replyId = parts[2];

            const post = await ClubPost.findById(postId);
            if (!post) return res.json({ type: 'Deleted', message: "This post/comment has been deleted." });

            const comment = post.comments && post.comments.find(c => c._id.toString() === commentId);
            if (!comment) return res.json({ type: 'Deleted', message: "This comment has been deleted." });

            if (report.targetType === 'Reply' && replyId) {
                const reply = comment.replies && comment.replies.find(r => r._id.toString() === replyId);
                if (!reply) return res.json({ type: 'Deleted', message: "This reply has been deleted." });

                return res.json({
                    type: 'Reply',
                    data: {
                        replyId: reply._id,
                        author: reply.author,
                        content: reply.content,
                        timestamp: reply.timestamp,
                        postTitle: post.title,
                        commentedBy: comment.author,
                        context: `Reply in: "${post.title}"`
                    }
                });
            }

            return res.json({
                type: 'Comment',
                data: {
                    commentId: comment._id,
                    author: comment.author,
                    content: comment.content,
                    timestamp: comment.timestamp,
                    postTitle: post.title,
                    context: `Comment in: "${post.title}"`
                }
            });
        }

        return res.json({ type: 'Unknown', message: "Report type not recognized." });

    } catch (error) {
        console.error("View Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
