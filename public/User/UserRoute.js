const express = require('express');
const router = express.Router();
const User = require('../Schematics/UserSchema.js');
const jwt = require('jsonwebtoken')
const ClubPost = require('../Schematics/ClubPostSchema.js');
const Club = require('../Schematics/ClubSchema.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Helper
const getRequester = async (req) => {
    const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return await User.findById(decoded.userId);
    } catch (e) { return null; }
};
router.get('/hidden-posts', async (req, res) => {
    try {
        const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) return res.status(404).json({ message: "User not found" });

        // Fetch the actual post documents for IDs in the hiddenPosts array
        const posts = await ClubPost.find({
            _id: { $in: user.hiddenPosts }
        }).sort({ timestamp: -1 });

        res.json(posts);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server error" });
    }
});

// ==========================================
// UNHIDE POST
// ==========================================
router.put('/unhide-post/:postId', async (req, res) => {
    try {
        const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        await User.findByIdAndUpdate(decoded.userId, {
            $pull: { hiddenPosts: req.params.postId } // Remove from array
        });

        res.json({ success: true, message: "Post unhidden" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server error" });
    }
});
router.get('/followed-clubs', async (req, res) => {
    try {
        const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) return res.status(404).json({ message: "User not found" });

        // Find all clubs whose names are in the user's 'following' list
        const clubs = await Club.find({
            clubname: { $in: user.following }
        });

        res.json(clubs);
    } catch (e) {
        console.error("Followed Clubs Error:", e);
        res.status(500).json({ message: "Server error" });
    }
});

// ==========================================
// FOLLOW CLUB
// ==========================================
router.put('/follow/:clubname', async (req, res) => {
    try {
        const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const clubName = req.params.clubname;

        // Add to array, prevent duplicates ($addToSet)
        await User.findByIdAndUpdate(decoded.userId, {
            $addToSet: { following: clubName } 
        });

        res.json({ success: true, message: `Followed ${clubName}` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server error" });
    }
});

// ==========================================
// UNFOLLOW CLUB
// ==========================================
router.put('/unfollow/:clubname', async (req, res) => {
    try {
        const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const clubName = req.params.clubname;

        // Remove from array ($pull)
        await User.findByIdAndUpdate(decoded.userId, {
            $pull: { following: clubName } 
        });

        res.json({ success: true, message: `Unfollowed ${clubName}` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server error" });
    }
});
// ==========================================
// 1. RESTRICT USER (Ban)
// ==========================================
router.put('/restrict/:id', async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const { duration, reason } = req.body; 

        // 1. Who is asking?
        const requester = await getRequester(req);
        if (!requester) return res.status(401).json({ message: "Unauthorized" });

        // 2. Who is the target?
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        // 3. Permission Check
        const isAdmin = requester.usertype === 'Admin';
        const isAdviser = requester.usertype === 'Teacher';
        
        // Rule: Advisers can ONLY restrict their own club members
        if (isAdviser) {
            if (targetUser.club !== requester.club) {
                return res.status(403).json({ message: "You can only restrict members of your own club." });
            }
            // Prevent banning other staff
            if (targetUser.usertype === 'Teacher' || targetUser.usertype === 'Admin') {
                return res.status(403).json({ message: "You cannot restrict this user." });
            }
        } else if (!isAdmin) {
            return res.status(403).json({ message: "Permission denied." });
        }

        // 4. Calculate End Date
        let endDate = null; // Default to null (Permanent)
        if (duration !== 'permanent') {
            const days = parseInt(duration);
            if (!isNaN(days)) {
                endDate = new Date();
                endDate.setDate(endDate.getDate() + days);
            }
        }

        // 5. Save changes
        targetUser.isRestricted = true;
        targetUser.restrictionEnds = endDate;
        targetUser.restrictionReason = reason || "Violation of community guidelines";
        
        await targetUser.save();

        res.json({ 
            success: true, 
            message: `User restricted ${endDate ? 'until ' + endDate.toLocaleDateString() : 'permanently'}.` 
        });

    } catch (error) {
        console.error("Restriction Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// ==========================================
// 2. UN-RESTRICT USER (Unban)
// ==========================================
router.put('/unrestrict/:id', async (req, res) => {
    try {
        const requester = await getRequester(req);
        const targetUser = await User.findById(req.params.id);

        if (!requester || !targetUser) return res.status(404).json({ message: "Not found" });

        // Permission Logic
        const isAdmin = requester.usertype === 'Admin';
        const isAdviser = requester.usertype === 'Teacher' && requester.club === targetUser.club;

        if (!isAdmin && !isAdviser) {
            return res.status(403).json({ message: "Permission denied." });
        }

        targetUser.isRestricted = false;
        targetUser.restrictionEnds = null;
        targetUser.restrictionReason = "";
        await targetUser.save();

        res.json({ success: true, message: "Restriction lifted." });

    } catch (e) {
        console.error("Unrestrict Error:", e);
        res.status(500).json({ message: "Server error" });
    }
});

// ==========================================
// 3. GET ALL USERS (Admin Only)
// ==========================================
router.get('/all', async (req, res) => {
    try {
        const requester = await getRequester(req);
        if (!requester || requester.usertype !== 'Admin') {
            return res.status(403).json({ message: "Access Denied" });
        }

        // Fetch everyone except other Admins
        const users = await User.find({ usertype: { $ne: 'Admin' } })
            .select('name email usertype club isRestricted restrictionEnds');

        res.json(users);
    } catch (error) {
        console.error("Fetch Users Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// ==========================================
// 4. HIDE POST
// ==========================================
router.put('/hide-post/:postId', async (req, res) => {
    try {
        const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        await User.findByIdAndUpdate(decoded.userId, {
            $addToSet: { hiddenPosts: req.params.postId }
        });

        res.json({ success: true, message: "Post hidden" });
    } catch (e) {
        res.status(500).json({ message: "Server error" });
    }
});
const uploadDir = 'public/uploads/';
// Ensure directory exists
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); 
    },
    filename: (req, file, cb) => {
        // Naming: avatar-USERID-TIMESTAMP.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// --- 2. THE UPLOAD ROUTE ---
router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
    try {
        // A. Auth Check
        const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // B. Validation
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded." });
        }

        // C. Construct URL (Relative path for frontend)
        const newAvatarUrl = `/uploads/${req.file.filename}`;

        // D. Update Database
        await User.findByIdAndUpdate(decoded.userId, { 
            profilePicture: newAvatarUrl 
        });

        // E. Respond
        res.json({ 
            success: true, 
            newUrl: newAvatarUrl, 
            message: "Profile picture updated!" 
        });

    } catch (error) {
        console.error("Avatar Upload Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});
router.put('/interests', async (req, res) => {
    try {
        const token = req.session.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { interests } = req.body; // Expecting an array like ['Tech', 'Sports']

        const user = await User.findByIdAndUpdate(
            decoded.userId,
            { interests: interests },
            { new: true }
        );

        res.json({ message: "Interests updated!", interests: user.interests });
    } catch (error) {
        console.error("Interest Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;