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
        const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        // --- 1. ADMIN CHECK ---
        const isGlobal = req.body.isGlobal === 'true' && user.usertype === 'Admin';
        
        // If it's a regular post, enforce Adviser check
        if (!isGlobal && user.usertype !== 'Teacher' && user.usertype !== 'Admin') {
            return res.status(403).json({ message: "Only advisers can post." });
        }

        // --- 2. CREATE POST ---
        const { title, content, visibility } = req.body; 
        
        // If Global, force name to "UE Admin" or "University Announcement"
        const targetClubName = isGlobal ? 'UE University Admin' : (req.body.clubname || user.club); 

        let mediaUrl = "";
        let mediaType = 'none'; // Detect type
        if (req.file) {
            mediaUrl = `/uploads/${req.file.filename}`;
            if (req.file.mimetype.startsWith('image/')) mediaType = 'image';
            else if (req.file.mimetype.startsWith('video/')) mediaType = 'video';
        }

        const newPost = new ClubPost({
            title,
            content,
            author: user.name,
            authorProfile: user.profilePicture || '', // Save author's profile picture
            clubname: targetClubName, 
            mediaUrl,
            mediaType,
            visibility: visibility || 'public',
            isGlobal: isGlobal // Save the flag
        });

        await newPost.save();

        // --- 3. NOTIFICATION LOGIC ---
        let recipients = [];

        if (isGlobal) {
            // GLOBAL: Notify EVERYONE
            const allUsers = await User.find({}).select('name');
            recipients = allUsers.map(u => u.name).filter(name => name !== user.name);
        } else {
            // REGULAR: Notify Followers & Members
            const members = await User.find({ club: targetClubName }).select('name');
            const followers = await User.find({ following: targetClubName }).select('name');
            recipients = [...new Set([...members, ...followers].map(u => u.name))]
                .filter(name => name !== user.name);
        }

        if (recipients.length > 0) {
            const alerts = recipients.map(name => ({
                recipient: name, 
                sender: targetClubName, 
                type: isGlobal ? 'alert' : 'info', // 'alert' can be styled red in notif list
                message: isGlobal ? `🚨 GLOBAL ANNOUNCEMENT: ${title}` : `📢 New post from ${targetClubName}`,
                link: `/ClubPortalFeed/ClubPortalFeed.html?postId=${newPost._id}`,
                timestamp: new Date()
            }));
            await Notification.insertMany(alerts);
        }

        res.json({ message: "Post created!" });

    } catch (error) {
        console.error("Create Post Error:", error);
        res.status(500).json({ error: error.message });
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
            { $sort: { isGlobal: -1, timestamp: -1 } },
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
                    author: 1,
        authorProfile: 1,   
                    clubname: 1, author: 1, likes: 1, comments: 1, visibility: 1,
                    clubLogo: "$clubInfo.branding.logo",
                    clubSlug: "$clubInfo.urlSlug",
                    clubCategory: "$clubInfo.category" // Needed for Interest Matching
                }
            }
        ]);

        // 4. Hydrate Avatars (Your existing logic)
        // First, get all authors and commenters
        const allAuthors = new Set();
        const commentAuthors = new Set();
        allPosts.forEach(post => {
            allAuthors.add(post.author);
            if (post.comments) post.comments.forEach(c => commentAuthors.add(c.author));
        });

        // Fetch all users in one query
        const allNamesList = Array.from(new Set([...allAuthors, ...commentAuthors]));
        if (allNamesList.length > 0) {
            const usersData = await User.find({ name: { $in: allNamesList } }).select('name profilePicture');
            const userAvatarMap = {};
            usersData.forEach(u => userAvatarMap[u.name] = u.profilePicture);
            
            // Update post author profiles
            allPosts.forEach(post => {
                if (userAvatarMap[post.author]) {
                    post.authorProfile = userAvatarMap[post.author];
                }
                // Update comment author profiles
                if (post.comments) {
                    post.comments.forEach(c => {
                        if (userAvatarMap[c.author]) c.userProfile = userAvatarMap[c.author];
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
// ClubPostRoute.js - REVISED DELETE ROUTE

// ClubPostRoute.js - FINAL FIXED DELETE ROUTE

router.delete('/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        
        // 1. Find the post using the correct model
        const post = await ClubPost.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        // 2. Identify the person performing the deletion
        const user = await getUser(req); // Uses your helper function
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const isAdmin = user.usertype === 'Admin';
        const isAdviser = user.usertype === 'Teacher' && user.club === post.clubname;
        const isAuthor = post.author === user.name;

        // 3. Permission Check: Only Author, Admin, or the specific Club Adviser can delete
        if (!isAuthor && !isAdmin && !isAdviser) {
            return res.status(403).json({ message: "You do not have permission to delete this post." });
        }

        // 4. Notification Logic: If a Moderator (Admin/Adviser) deletes it
        if (!isAuthor && (isAdmin || isAdviser)) {
            // Notify the Student Author
            const authorNotif = new Notification({
                recipient: post.author,
                sender: "System",
                type: 'alert',
                message: `Your post "${post.title}" was removed by an Admin`,
                link: '#'
            });
            await authorNotif.save();

            // If an Admin deletes it, also notify the Club Adviser
            if (isAdmin) {
                const clubData = await Club.findOne({ clubname: post.clubname });
                if (clubData && clubData.adviser && clubData.adviser !== user.name) {
                    const adviserNotif = new Notification({
                        recipient: clubData.adviser,
                        sender: "System",
                        type: 'alert',
                        message: `An administrator has removed a post ("${post.title}") from your club's feed.`,
                        link: '#'
                    });
                    await adviserNotif.save();
                }
            }
        }

        // 5. Perform the actual deletion
        await ClubPost.findByIdAndDelete(postId);
        res.json({ success: true, message: "Post deleted and notifications sent." });

    } catch (err) {
        console.error("CRITICAL DELETE ERROR:", err);
        res.status(500).json({ error: "Server Error", details: err.message });
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