const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ClubPost = require('../Schematics/ClubPostSchema.js'); // Updated import
const User = require('../Schematics/UserSchema.js');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const Club = require('../Schematics/ClubSchema.js');
const Notification = require('../Schematics/NotificationSchema.js');
const mongoose = require('mongoose');
require('dotenv').config();

// --- IMAGE UPLOAD CONFIG ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => {
        cb(null, 'clubpost-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- HELPER: GET USER INFO ---
const getUser = async (req) => {
    const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return await User.findById(decoded.userId);
    } catch (e) { return null; }
};

router.post('/create', upload.single('media'), async (req, res) => {
    try {
        // --- A. AUTHENTICATION ---
        const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (user.usertype !== 'Teacher' && user.usertype !== 'Admin') {
            return res.status(403).json({ message: "Only advisers can post." });
        }

        // --- B. DATA PREPARATION ---
        const { title, content, visibility } = req.body; 
        const targetClubName = req.body.clubname || user.club; 

        let mediaUrl = "";
        if (req.file) mediaUrl = `/uploads/${req.file.filename}`;

        const newPost = new ClubPost({
            title,
            content,
            author: user.name,
            clubname: targetClubName, 
            mediaUrl,
            visibility: visibility || 'public'
        });

        // --- C. SAVE POST ---
        await newPost.save();

        // --- D. NOTIFICATION LOGIC (REVISED & ROBUST) ---
        // Instead of checking the Club's list, we find Users who follow this club.
        
        // 1. Find MEMBERS: Users where club == targetClubName
        const members = await User.find({ club: targetClubName }).select('name');

        // 2. Find FOLLOWERS: Users where following array contains targetClubName
        const followers = await User.find({ following: targetClubName }).select('name');

        // 3. Combine Lists
        const allRecipients = [...members, ...followers];

        // 4. Extract Names & Remove Duplicates (and exclude the sender!)
        const uniqueNames = [...new Set(allRecipients.map(u => u.name))]
            .filter(name => name !== user.name); // Don't notify the person who posted

        // 5. Create Alerts
        const alerts = uniqueNames.map(name => ({
            recipient: name, 
            sender: targetClubName, 
            type: 'info',
            message: `📢 New announcement from ${targetClubName}: ${title}`,
            link: `/ClubPortalFeed/ClubPortalFeed.html`,
            timestamp: new Date()
        }));

        // 6. Send them
        if (alerts.length > 0) {
            await Notification.insertMany(alerts);
            console.log(`✅ Sent ${alerts.length} notifications for ${targetClubName}`);
        } else {
            console.log(`⚠️ Post created, but no followers/members found for ${targetClubName}`);
        }

        res.json({ message: "Post created!" });

    } catch (error) {
        console.error("Create Post Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

router.get('/feed', async (req, res) => {
    try {
        const user = await getUser(req);
        const userId = user ? user._id.toString() : null; 
        
        // 1. Get User Context
        const userClub = (user && user.club) ? user.club : "";
        const following = (user && user.following) ? user.following : [];
        const interests = (user && user.interests) ? user.interests : []; // Get Interests
        const hiddenIds = user ? (user.hiddenPosts || []) : []; 

        // 2. Discovery Logic (Fallback for users with NO interests & NO following)
        let discoveryClubNames = [];
        const isNewUser = (!userClub || userClub === 'none' || userClub === 'Pending') && following.length === 0 && interests.length === 0;

        if (isNewUser) {
            // If they have literally nothing, show them the 3 smallest clubs to help them start
            const smallClubs = await Club.find().sort({ membercount: 1 }).limit(3).select('clubname');
            discoveryClubNames = smallClubs.map(c => c.clubname);
        }

        // 3. Fetch All Posts (filtered by hidden)
        const allPosts = await ClubPost.aggregate([
            { $match: { _id: { $nin: hiddenIds.map(id => new mongoose.Types.ObjectId(id)) } } }, 
            { $sort: { timestamp: -1 } },
            {
                $lookup: {
                    from: "Clubs",
                    let: { postClubName: "$clubname" },
                    pipeline: [
                        { $match: { $expr: { $eq: [{ $toLower: "$clubname" }, { $toLower: "$$postClubName" }] } } }
                    ],
                    as: "clubInfo"
                }
            },
            { $unwind: { path: "$clubInfo", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    title: 1, content: 1, mediaUrl: 1, mediaType: 1, timestamp: 1, 
                    clubname: 1, author: 1, likes: 1, comments: 1, visibility: 1,
                    clubLogo: "$clubInfo.branding.logo",
                    clubSlug: "$clubInfo.urlSlug",
                    clubCategory: "$clubInfo.category" // Needed for Interest Matching
                }
            }
        ]);

        // 4. Hydrate Avatars (Your existing logic)
        const commentAuthors = new Set();
        allPosts.forEach(post => {
            if (post.comments) post.comments.forEach(c => commentAuthors.add(c.author));
        });

        if (commentAuthors.size > 0) {
            const authorsData = await User.find({ name: { $in: Array.from(commentAuthors) } }).select('name profilePicture');
            const avatarMap = {};
            authorsData.forEach(u => avatarMap[u.name] = u.profilePicture);
            allPosts.forEach(post => {
                if (post.comments) {
                    post.comments.forEach(c => {
                        if (avatarMap[c.author]) c.userAvatar = avatarMap[c.author];
                    });
                }
            });
        }

        // 5. Buckets for Sorting
        const priorityPosts = [];   // Tier 1: My Club & Following
        const interestPosts = [];   // Tier 2: Matches my Interests
        const discoveryPosts = [];  // Tier 3: Discovery (for new users only)
        const otherPosts = [];      // Tier 4: Everything else

        allPosts.forEach(post => {
            // Visibility Filter
            if (post.visibility === 'club-only' && userClub !== post.clubname) return;

            // Likes
            const likesArray = post.likes || [];
            post.likesCount = likesArray.length;
            post.isLiked = userId ? likesArray.map(id => id.toString()).includes(userId) : false;

            // -- CLASSIFICATION LOGIC --
            
            // 1. My Club or Followed Club
            const isMyClub = userClub && post.clubname === userClub;
            const isFollowed = following.some(f => f.toLowerCase() === (post.clubname || "").toLowerCase());
            
            // 2. Interest Match
            // (Checks if the post's club category exists in the user's interests array)
            const matchesInterest = post.clubCategory && interests.includes(post.clubCategory);

            // 3. Discovery Match (Only if user has no other signals)
            const isDiscovery = discoveryClubNames.includes(post.clubname);

            if (isMyClub || isFollowed) {
                post.priorityReason = isMyClub ? "Member" : "Following";
                priorityPosts.push(post);
            } 
            else if (matchesInterest) {
                post.priorityReason = `Recommended: ${post.clubCategory}`;
                interestPosts.push(post);
            }
            else if (isDiscovery) {
                post.priorityReason = "Suggested for You";
                discoveryPosts.push(post);
            }
            else {
                otherPosts.push(post);
            }
        });

        // 6. Return Final Order
        res.json([...priorityPosts, ...interestPosts, ...discoveryPosts, ...otherPosts]);

    } catch (error) {
        console.error("Feed Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});
// ==========================================
// 4. TOGGLE LIKE (HEART)
// ==========================================
router.put('/like/:id', async (req, res) => {
    try {
        const user = await getUser(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const post = await ClubPost.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });

        const index = post.likes.indexOf(user._id);

        if (index === -1) {
            post.likes.push(user._id);
        } else {
            post.likes.splice(index, 1);
        }

        await post.save();
        
        res.json({ 
            success: true, 
            likesCount: post.likes.length,
            isLiked: index === -1 
        });

    } catch (error) {
        console.error("Like Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// ==========================================
// 5. ADD COMMENT
// ==========================================
router.post('/comment/:id', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ message: "Comment cannot be empty" });

        const user = await getUser(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const post = await ClubPost.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });

        const newComment = {
            author: user.name,
            content: content,
            timestamp: new Date()
        };

        post.comments.push(newComment);
        await post.save();

        res.json({ 
            success: true, 
            comments: post.comments 
        });

    } catch (error) {
        console.error("Comment Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// ==========================================
// 6. DELETE COMMENT
// ==========================================
router.delete('/comment/:postId/:commentId', async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const user = await getUser(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const post = await ClubPost.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: "Comment not found" });

        if (comment.author !== user.name && user.usertype !== 'Admin' && user.usertype !== 'Teacher') {
            return res.status(403).json({ message: "You can only delete your own comments." });
        }

        post.comments.pull(commentId);
        await post.save();

        res.json({ success: true, message: "Comment deleted", comments: post.comments });

    } catch (error) {
        console.error("Delete Comment Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// ==========================================
// 7. REPLY TO COMMENT
// ==========================================
router.post('/comment/reply/:postId/:commentId', async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const { content } = req.body;
        
        if (!content) return res.status(400).json({ message: "Reply cannot be empty" });

        const user = await getUser(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const post = await ClubPost.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: "Comment not found" });

        comment.replies.push({
            author: user.name,
            content: content,
            timestamp: new Date()
        });

        await post.save();
        res.json({ success: true, comments: post.comments });

    } catch (error) {
        console.error("Reply Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// ==========================================
// 8. DELETE POST (FIXED ROUTE & VARIABLE)
// ==========================================
router.delete('/:id', async (req, res) => {  // FIX: Changed from '/api/posts/:id' to '/:id'
    try {
        const postId = req.params.id;

        // 1. Find the post using Correct Model (ClubPost)
        const post = await ClubPost.findById(postId); // FIX: Changed 'Post' to 'ClubPost'
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // 2. Delete the post
        await ClubPost.findByIdAndDelete(postId); // FIX: Changed 'Post' to 'ClubPost'

        res.json({ success: true, message: "Post deleted successfully" });
    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
});
// 2. GET FEED (With "New User" Algorithm)
// ==========================================
// GET RECOMMENDATIONS (Smallest Clubs + Latest Post)
// ==========================================
router.get('/recommendations', async (req, res) => {
    try {
        // 1. Find 3 clubs with lowest member count
        const smallClubs = await Club.find().sort({ membercount: 1 }).limit(3);

        // 2. Fetch the latest post for each of those clubs
        const recommendations = await Promise.all(smallClubs.map(async (club) => {
    const latestPost = await ClubPost.findOne({ clubname: club.clubname })
                                     .sort({ timestamp: -1 });
    
    return {
        club: {
            name: club.clubname,
            logo: club.branding?.logo || club.logo || '/uploads/default_pfp.png',
            slug: club.urlSlug,
            memberCount: club.membercount
        },
        post: latestPost ? {
            title: latestPost.title,      // (Optional)
            content: latestPost.content,
            mediaUrl: latestPost.mediaUrl, // ✅ ADD THIS
            mediaType: latestPost.mediaType // ✅ ADD THIS
        } : null
    };
}));

        res.json(recommendations);

    } catch (error) {
        console.error("Recommendation Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});
router.get('/club/:clubname', async (req, res) => {
    try {
        const { clubname } = req.params;
        const user = await getUser(req); // Get current user for 'isLiked' check
        const userId = user ? user._id.toString() : null;

        // 1. Get Club Details first (We need the logo)
        const club = await Club.findOne({ clubname: { $regex: new RegExp(`^${clubname}$`, 'i') } });
        
        // Default fallbacks
        const clubLogo = (club && club.branding && club.branding.logo) ? club.branding.logo : '/uploads/default_pfp.png';
        const clubSlug = (club && club.urlSlug) ? club.urlSlug : '#';

        // 2. Get Posts
        const posts = await ClubPost.find({ clubname: { $regex: new RegExp(`^${clubname}$`, 'i') } })
                                    .sort({ timestamp: -1 });

        // 3. Attach Logo & Check Likes
        const enhancedPosts = posts.map(post => {
            const postObj = post.toObject();
            
            // Attach Club Branding so the avatar works
            postObj.clubLogo = clubLogo;
            postObj.clubSlug = clubSlug;
            
            // Check if user liked it
            postObj.likesCount = post.likes.length;
            postObj.isLiked = userId ? post.likes.map(id => id.toString()).includes(userId) : false;

            return postObj;
        });

        res.json(enhancedPosts);

    } catch (error) {
        console.error("Club Posts Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});
module.exports = router;