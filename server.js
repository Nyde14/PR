const express = require('express');
const session = require('express-session');
const connectDB = require('./public/modules/connectdb.js');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

// --- ROUTE IMPORTS ---
const authRoutes = require('./public/Login/LoginRoute.js');
const userRoutes = require('./public/User/UserRoute.js');
const clubPostRoutes = require('./public/Post/ClubPostRoute.js');
const reportRoutes = require('./public/Report/ReportRoute.js'); // <--- NEW IMPORT
const notificationRoute = require('./public/Notification/NotificationRoute');

// --- SCHEMATICS ---
const Application = require('./public/Schematics/applicationschema.js'); 
const Message = require('./public/Schematics/MessageSchema.js');
const User = require('./public/Schematics/UserSchema.js');
const Club = require('./public/Schematics/ClubSchema.js');  
 

const app = express();

// Connect to database
connectDB();

// --- MIDDLEWARE CONFIGURATION ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } 
}));
app.use((req, res, next) => {
  console.log(`Incoming: ${req.method} ${req.url}`);
  next();
});
app.use('/api/notifications', notificationRoute);

// --- AUTHENTICATION FUNCTIONS ---
const ensureAuthenticatedHtml = (req, res, next) => {
  const token = req.session.token || req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.redirect('/Login/Login.html');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.redirect('/Login/Login.html');
  }
};

const protectPublicFolders = (req, res, next) => {
    const protectedPaths = [
        '/ClubChat/', 
        '/ChatInbox/', 
        '/ClubPortalFeed/', 
        '/Profile/', 
        '/ApplyClub/', 
        '/AdviserDashboard/',
        '/AdminDashboard/' // Added Admin Dashboard
    ];
    
    const isProtected = protectedPaths.some(path => req.path.includes(path));
    if (isProtected) {
        return ensureAuthenticatedHtml(req, res, next);
    }
    next(); 
};

// --- ROOT REDIRECT ---
app.get('/', async (req, res) => {
    try {
        res.redirect('/Login/Login.html');
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- STATIC FILE SERVING ---
app.use('/public', protectPublicFolders, express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/ClubPortalFeed', express.static(path.join(__dirname, 'public', 'ClubPortalFeed')));

// --- FILE UPLOAD CONFIGURATION ---
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/'); // Ensure this folder exists
    },
    filename: (req, file, cb) => {
        // 1. Check if it is Media (Image or Video)
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            // Use generic name for media to keep URLs clean
            const uniqueName = 'media-' + Date.now() + path.extname(file.originalname);
            cb(null, uniqueName);
        } 
        // 2. It is a Document/File
        else {
            // Keep original name but prepend timestamp to prevent overwriting
            // We also replace spaces with dashes to avoid broken URLs
            const safeName = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
            cb(null, Date.now() + '-' + safeName);
        }
    }
});

// Initialize Upload with Limits
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB Limit (Backend enforcement)
});

// ============================================
// 1. API ROUTES REGISTRATION
// ============================================

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/posts', clubPostRoutes);
app.use('/api/reports', reportRoutes); // <--- REGISTER REPORT ROUTES HERE

// ============================================
// 2. SPECIFIC HELPER ROUTES
// ============================================

// Auth Me Check
app.get('/api/auth/me', async (req, res) => {
    try {
        const token = req.session.token;
        if (!token) return res.status(401).json({ message: "not logged in" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // CRITICAL: Fetching fresh data from MongoDB on every refresh
        const userdata = await User.findById(decoded.userId); 

        if (!userdata) return res.status(404).json({ message: "user not found" });

        res.json({
            _id: userdata._id,
            name: userdata.name,
            usertype: userdata.usertype,
            club: userdata.club,
            bio: userdata.bio || "", 
            // ENSURE THIS FIELD IS RETURNED
            clubPosition: userdata.clubPosition || 'Member', 
            hiddenPosts: userdata.hiddenPosts || [],
            following: userdata.following || [],
            profilePicture: userdata.profilePicture
        });
    } catch (error) {
        console.error("Auth Me Error:", error);
        res.status(500).json({ message: "server error" });
    }
});

// Get list of valid contacts
app.get('/api/users/contacts', async (req, res) => {
    try {
        const token = req.session.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.userId);

        if (!currentUser) return res.status(404).json({ message: "User not found" });

        let query = {};

        // 1. ADMINS: See Everyone
        if (currentUser.usertype === 'Admin') {
            query = { _id: { $ne: currentUser._id } }; 
        } 
        // 2. CLUB MEMBERS (Advisers & Students)
        else if (currentUser.club && currentUser.club !== 'none' && currentUser.club !== 'Pending') {
            const escapedClub = currentUser.club.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // --- FIX START: Allow Advisers to see Admins ---
            if (currentUser.usertype === 'Teacher') {
                query = { 
                    $or: [
                        { club: { $regex: new RegExp(`^${escapedClub}$`, 'i') } }, // Club Members
                        { usertype: 'Admin' }                                      // AND Admins
                    ],
                    _id: { $ne: currentUser._id } 
                };
            } else {
                // Students still only see their clubmates
                query = { 
                    club: { $regex: new RegExp(`^${escapedClub}$`, 'i') }, 
                    _id: { $ne: currentUser._id } 
                };
            }
            // --- FIX END ---
        } 
        // 3. USERS WITHOUT CLUB (e.g. New Teachers/Students)
        else {
            query = { 
                usertype: { $in: ['Teacher', 'Admin'] }, 
                _id: { $ne: currentUser._id }
            };
        }

        const contacts = await User.find(query).select('name usertype club');
        res.json(contacts);

    } catch (error) {
        console.error("Contacts Error:", error);
        res.status(500).json({ error: error.message });
    }
});
// ============================================
// 3. CHAT ROUTES
// ============================================

app.get('/api/chat/private/:otherUser', async (req, res) => {
    try {
        const { otherUser } = req.params;
        const token = req.session.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.userId);
        const myName = currentUser.name;

        const messages = await Message.find({
            $or: [
                { sender: myName, recipient: otherUser },
                { sender: otherUser, recipient: myName }
            ]
        }).sort({ timestamp: 1 }); 

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/chat/conversations', async (req, res) => {
    try {
        const token = req.session.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.userId);
        const myName = currentUser.name;

        const messages = await Message.find({
            recipient: { $ne: null },
            $or: [
                { sender: myName },
                { recipient: myName }
            ]
        }).sort({ timestamp: -1 });

        const conversations = [];
        const seenUsers = new Set();

        messages.forEach(msg => {
            const otherPerson = (msg.sender === myName) ? msg.recipient : msg.sender;
            if (!seenUsers.has(otherPerson)) {
                seenUsers.add(otherPerson);
                conversations.push({
                    name: otherPerson,
                    lastMessage: msg.content || (msg.mediaUrl ? "Sent an attachment" : "Message"),
                    timestamp: msg.timestamp,
                    isDeleted: msg.isDeleted
                });
            }
        });

        res.json(conversations);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// C. Get Club (Group) Messages (WITH AVATARS)
app.get('/api/chat/:clubname', async (req, res) => {
    try {
        const { clubname } = req.params;
        const token = req.session.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        // (Auth logic remains the same...)
        
        // 1. Fetch Messages
        const messages = await Message.find({ clubname: clubname }).sort({ timestamp: 1 });

        // 2. Find Unique Senders
        const senderNames = [...new Set(messages.map(m => m.sender))];

        // 3. Fetch Profile Pictures for these Senders
        const users = await User.find({ name: { $in: senderNames } }).select('name profilePicture');
        
        // 4. Create a Map (Name -> Picture URL)
        const avatarMap = {};
        users.forEach(u => {
            avatarMap[u.name] = u.profilePicture || '/public/images/default-user.png';
        });

        // 5. Attach Avatars to Messages
        const messagesWithAvatars = messages.map(msg => ({
            ...msg.toObject(),
            senderAvatar: avatarMap[msg.sender] || '/public/images/default-user.png'
        }));

        res.json(messagesWithAvatars);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chat/send', upload.single('media'), async (req, res) => {
    try {
        const token = req.session.token || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        const { clubname, recipient, content } = req.body; 
        
        let mediaUrl = null;
        let mediaType = 'none';

        if (req.file) {
            mediaUrl = `/uploads/${req.file.filename}`;
            if (req.file.mimetype.startsWith('image/')) {
                mediaType = 'image';
            } else if (req.file.mimetype.startsWith('video/')) {
                mediaType = 'video';
            }
        }

        const newMessage = new Message({
            clubname: clubname || null, 
            recipient: recipient || null, 
            sender: user.name,
            clubrole: (user.usertype === 'Teacher' || user.usertype === 'Admin') ? 'Adviser' : 'Student',
            officerRole: user.clubPosition || 'Member', 
            content: content || "",
            mediaUrl,
            mediaType
        });

        await newMessage.save();
        res.json({ message: "Sent" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/chat/delete/:id', async (req, res) => {
    try {
        const messageId = req.params.id;
        const token = req.session.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        const msg = await Message.findById(messageId);

        if (!msg) return res.status(404).json({ message: "Message not found" });

        const isSender = msg.sender === user.name;
        const isAdviser = user.usertype === 'Teacher' || user.usertype === 'Admin';

        if (!isSender && !isAdviser) {
            return res.status(403).json({ message: "You can only delete your own messages." });
        }

        msg.isDeleted = true;
        msg.deletedBy = user.name;
        msg.deletedAt = new Date();
        await msg.save();

        res.json({ message: "Message deleted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/chat/private/:otherUser', async (req, res) => {
    try {
        const { otherUser } = req.params;
        const token = req.session.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.userId);
        const myName = currentUser.name;
        const isAdmin = currentUser.usertype === 'Admin';

        let query = {};

        if (isAdmin) {
            // ADMIN MODE: View ALL DMs involving the target user
            // This ensures the reported message appears regardless of who the other party was.
            query = {
                $or: [
                    { sender: otherUser },
                    { recipient: otherUser }
                ]
            };
        } else {
            // NORMAL MODE: View chat between Me and Them
            query = {
                $or: [
                    { sender: myName, recipient: otherUser },
                    { sender: otherUser, recipient: myName }
                ]
            };
        }

        const messages = await Message.find(query).sort({ timestamp: 1 }); 
        res.json(messages);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// B. Get Conversations List
app.get('/api/chat/conversations', async (req, res) => {
    try {
        const token = req.session.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.userId);
        const myName = currentUser.name;
        const isAdmin = currentUser.usertype === 'Admin';

        let query = { recipient: { $ne: null } }; // Only private messages

        if (isAdmin) {
            // Admin sees ALL conversations in the system (Optional, or just keep own)
            // For now, let's keep it to their own to prevent UI flooding, 
            // relying on the specific 'private/:user' route for investigations.
            query.$or = [{ sender: myName }, { recipient: myName }];
        } else {
            query.$or = [{ sender: myName }, { recipient: myName }];
        }

        const messages = await Message.find(query).sort({ timestamp: -1 });

        const conversations = [];
        const seenUsers = new Set();

        messages.forEach(msg => {
            // If Admin is investigating, this logic still holds for their personal inbox
            const otherPerson = (msg.sender === myName) ? msg.recipient : msg.sender;
            if (!seenUsers.has(otherPerson)) {
                seenUsers.add(otherPerson);
                conversations.push({
                    name: otherPerson,
                    lastMessage: msg.content || (msg.mediaUrl ? "Sent an attachment" : "Message"),
                    timestamp: msg.timestamp,
                    isDeleted: msg.isDeleted
                });
            }
        });

        res.json(conversations);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// C. Get Club (Group) Messages
app.get('/api/chat/:clubname', async (req, res) => {
    try {
        const { clubname } = req.params;
        const token = req.session.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        const isAdviser = user.usertype === 'Teacher';
        const isAdmin = user.usertype === 'Admin'; // <--- NEW CHECK
        const isMember = user.club && (user.club.toLowerCase() === clubname.toLowerCase());

        // ALLOW if Member, Adviser, OR ADMIN
        if (!isAdviser && !isMember && !isAdmin) {
            return res.status(403).json({ message: "Access Denied" });
        }

        const messages = await Message.find({ clubname: clubname }).sort({ timestamp: 1 });
        res.json(messages);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 4. CLUB & APPLICATION ROUTES
// ============================================

app.get('/api/clubs', async (req, res) => {
  try {
    const clubs = await Club.aggregate([
        {
            $lookup: {
                from: "users",
                localField: "clubname",
                foreignField: "club",
                as: "memberList"
            }
        },
        {
            $project: {
                clubname: 1,
                adviser: 1,
                branding: 1, 
                logo: 1, 
                // Use category as-is, fallback to "Organization" if missing
                category: { $ifNull: ["$category", "Organization"] },
                urlSlug: 1, 
                memberCount: { $size: "$memberList" } 
            }
        }
    ]);
    res.json(clubs);
  } catch (e) {
    console.error("Error fetching clubs:", e);
    res.status(500).json({ message: 'Error fetching clubs' });
  }
});

app.get('/api/clubs/search', async (req, res) => {
    try {
        const { name } = req.query;
        const club = await Club.findOne({ clubname: name });
        if (!club) return res.status(404).json({ message: "Club not found by name" });
        res.json(club); 
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/clubs/members', async (req, res) => {
    try {
        const { clubname } = req.query; 
        if (!clubname) return res.status(400).json({ message: "Club name is required" });

        // THE FIX: Add 'clubPosition' to the select list
        const members = await User.find({ club: clubname })
            .select('name email isRestricted restrictionEnds restrictionReason usertype clubPosition'); 
        
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/clubs/:slug', async (req, res) => {
  try {
    const slug = req.params.slug; 
    const club = await Club.findOne({ urlSlug: slug }); // findOne retrieves the full schema
    
    if (!club) return res.status(404).json({ message: "Club not found" });

    const count = await User.countDocuments({ club: club.clubname });
    
    const clubData = club.toObject();
    clubData.memberCount = count; // Ensure camelCase
    
    // Ensure category has a value (fallback to "Organization")
    if (!clubData.category) {
        clubData.category = "Organization";
    }

    res.json(clubData);
  } catch (error) {
    console.error("Error fetching club:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

app.patch('/api/clubs/update-description', async (req, res) => {
    try {
        const { clubname, shortDescription, fullDescription } = req.body;
        const updatedClub = await Club.findOneAndUpdate(
            { clubname: clubname },
            { shortDescription, fullDescription },
            { new: true } 
        );
        res.json({ message: "Description updated", club: updatedClub });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// server.js - Updated Patch Route

app.patch('/api/clubs/update-branding', upload.fields([{ name: 'logo', maxCount: 1 }]), async (req, res) => {
    try {
        const { clubId, clubname, adviser, category } = req.body; 
        
        console.log("Update Branding Request:", { clubId, clubname, adviser, category, hasLogo: !!(req.files && req.files['logo']) });
        
        const updateData = {};
        
        // 1. Handle Club Name
        if (clubname && clubname.trim()) {
            updateData['clubname'] = clubname;
        }
        
        // 2. Handle Logo
        if (req.files && req.files['logo']) {
            updateData['branding.logo'] = `/uploads/${req.files['logo'][0].filename}`;
            console.log("Logo updated to:", updateData['branding.logo']);
        }
        
        // 3. Handle Adviser
        if (adviser && adviser.trim()) {
            updateData['adviser'] = adviser;
        }

        // 4. Handle Category
        if (category && category.trim()) {
            updateData['category'] = category;
        }

        console.log("Update Data:", updateData);

        // Try to find by ID first, then fall back to clubname for backwards compatibility
        let lookupQuery = {};
        if (clubId) {
            lookupQuery = { _id: clubId };
            console.log("Looking up by ID:", clubId);
        } else if (clubname) {
            lookupQuery = { clubname: clubname };
            console.log("Looking up by clubname:", clubname);
        } else {
            return res.status(400).json({ message: "Either clubId or clubname is required" });
        }

        const updatedClub = await Club.findOneAndUpdate(
            lookupQuery, 
            { $set: updateData }, 
            { new: true }
        );

        if (!updatedClub) {
            console.error("Club not found with query:", lookupQuery);
            return res.status(404).json({ message: "Club not found" });
        }
        
        console.log("Club updated successfully:", updatedClub);
        res.json({ message: "Updated successfully", club: updatedClub });
    } catch (error) {
        console.error("Update Branding Error:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// --- APPLICATIONS ---
app.post('/api/applications/apply', async (req, res) => {
    try {
        const { studentname, clubname } = req.body;
        const user = await User.findOne({ name: studentname });
        
        if (user.club === 'Pending') return res.status(400).json({ error: "Pending application exists." });
        if (user.club && user.club !== 'none') return res.status(400).json({ error: "Already a member." });

        const newApplication = new Application({ studentname, clubname, status: 'pending' });
        await newApplication.save();

        user.club = "Pending";
        await user.save();

        res.json({ message: "Application submitted!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/applications/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const updatedApp = await Application.findByIdAndUpdate(id, { status: status }, { new: true });

        if (status === 'approved') {
            await User.findOneAndUpdate({ name: updatedApp.studentname }, { club: updatedApp.clubname });
            await Club.findOneAndUpdate({ clubname: updatedApp.clubname }, { $inc: { membercount: 1 } });
        } else if (status === 'rejected') {
            await User.findOneAndUpdate({ name: updatedApp.studentname }, { club: "none" });
        }
        res.json({ message: `Application ${status}!`, data: updatedApp });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}); 

app.get('/api/applications/pending', async (req, res) => {
    try {
        const { clubname } = req.query;
        const pending = await Application.find({ status: 'pending', clubname: clubname }).sort({ appliedat: -1 });
        res.json(pending);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/applications/check', async (req, res) => {
    try {
        const { studentname, clubname } = req.query;
        const application = await Application.findOne({ studentname, clubname, status: 'pending' });
        res.json({ exists: !!application });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/applications/withdraw', async (req, res) => {
    try {
        const { studentname, clubname } = req.body;
        await Application.findOneAndDelete({ studentname, clubname, status: 'pending' });
        await User.findOneAndUpdate({ name: studentname }, { club: "none" });
        res.json({ message: "Withdrawn." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/clubs/remove-member', async (req, res) => {
    try {
        const { studentname, clubname } = req.body;
        await User.findOneAndUpdate({ name: studentname }, { club: "none" });
        const updatedClub = await Club.findOneAndUpdate({ clubname: clubname }, { $inc: { membercount: -1 } }, { new: true });
        res.json({ message: "Removed", newCount: updatedClub.membercount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.patch('/api/chat/document/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'approved' or 'rejected'
        const token = req.headers['authorization']?.split(' ')[1];
        
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        // Security Check: Only Admins can approve/reject
        if (user.usertype !== 'Admin') {
            return res.status(403).json({ message: "Only Admins can perform this action." });
        }

        const msg = await Message.findByIdAndUpdate(
            id, 
            { approvalStatus: status }, 
            { new: true }
        );

        res.json({ success: true, message: `Document ${status}`, data: msg });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/api/clubs/delete/:id', async (req, res) => {
    try {
        const clubId = req.params.id;

        // 1. Authorization Check
        const token = req.session.token || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminUser = await User.findById(decoded.userId);
        
        if (!adminUser || adminUser.usertype !== 'Admin') {
            return res.status(403).json({ message: "Only Admins can delete organizations." });
        }

        // 2. Execute Delete
        const deletedClub = await Club.findByIdAndDelete(clubId);

        if (!deletedClub) {
            return res.status(404).json({ message: "Club not found." });
        }

        res.json({ message: "Club deleted successfully" });
    } catch (error) {
        console.error("Delete Club Error:", error);
        res.status(500).json({ error: error.message });
    }
}); 
app.get('/api/reports/:id/view', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: "Report not found" });

        // 1. HANDLE POST REPORTS
        if (report.targetType === 'Post') {
            const post = await Post.findById(report.targetId);
            if (!post) return res.json({ type: 'Deleted', message: 'The reported post has already been removed.' });
            
            return res.json({
                type: 'Post',
                url: `/ClubProfile/ClubProfile.html?slug=${post.clubSlug}&postId=${post._id}`
            });
        }

        // 2. HANDLE MESSAGE REPORTS
        if (report.targetType === 'Message') {
            const msg = await Message.findById(report.targetId);
            if (!msg || msg.isDeleted) return res.json({ type: 'Deleted', message: 'This message has already been deleted.' });

            return res.json({
                type: 'Message',
                data: {
                    messageId: msg._id,
                    sender: msg.sender,
                    content: msg.content,
                    timestamp: msg.timestamp,
                    mediaUrl: msg.mediaUrl,
                    mediaType: msg.mediaType,
                    context: msg.clubname ? `Group: ${msg.clubname}` : 'Private DM'
                }
            });
        }

        // 3. HANDLE COMMENT & REPLY REPORTS
        if (report.targetType === 'Comment' || report.targetType === 'Reply') {
            // Split the composite ID (Format: PostID|CommentID|ReplyID)
            const [postId, commentId, replyId] = report.targetId.split('|');
            
            const post = await Post.findById(postId);
            if (!post) return res.json({ type: 'Deleted', message: 'The parent post was deleted.' });

            // Find specific comment within the post's sub-document array
            const comment = post.comments.id(commentId);
            if (!comment) return res.json({ type: 'Deleted', message: 'The comment was deleted.' });

            let reviewData = {
                postId: post._id,
                commentId: comment._id,
                postTitle: post.title,
                author: comment.author,
                content: comment.content,
                timestamp: comment.timestamp
            };

            // If it's a Reply, drill down one more level
            if (report.targetType === 'Reply' && replyId) {
                const reply = comment.replies.id(replyId);
                if (!reply) return res.json({ type: 'Deleted', message: 'The reply was deleted.' });
                
                // Update review data with reply specifics
                reviewData.replyId = reply._id;
                reviewData.author = reply.author;
                reviewData.content = reply.content;
                reviewData.timestamp = reply.timestamp;
            }

            return res.json({
                type: report.targetType,
                data: reviewData
            });
        }

        res.status(400).json({ message: "Unknown report type" });

    } catch (error) {
        console.error("View Report Error:", error);
        res.status(500).json({ error: error.message });
    }
});
// ============================================
// 5. HTML PAGE ROUTES
// ============================================

app.get('/ClubPortalFeed/ClubPortalFeed.html', ensureAuthenticatedHtml, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ClubPortalFeed', 'ClubPortalFeed.html'));
});
app.get('/Profile/:id', ensureAuthenticatedHtml, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Profile', 'Profile.html'));
});
app.get('/ApplyClub/Clublist.html', ensureAuthenticatedHtml, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ApplyClub', 'Clublist.html'));
});
app.get('/ClubProfile/:slug', ensureAuthenticatedHtml, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Clubprofile', 'ClubProfile.html'));
});
app.get('/AdviserDashboard/AdviserDashboard.html', ensureAuthenticatedHtml, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'AdviserDashboard', 'AdviserDashboard.html'));
});
app.get('/AdminDashboard/AdminDashboard.html', ensureAuthenticatedHtml, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'AdminDashboard', 'AdminDashboard.html'));
});
app.get('/ChatInbox/ChatInbox.html', ensureAuthenticatedHtml, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ChatInbox', 'ChatInbox.html'));
});
app.get('/ClubChat/ClubChat.html', ensureAuthenticatedHtml, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ClubChat', 'ClubChat.html'));
});

// Logger


app.listen(3000, '0.0.0.0', () => {
  console.log('Server is running on port 3000');
});