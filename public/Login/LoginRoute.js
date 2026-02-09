const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../Schematics/UserSchema.js'); 
const Otp = require('../Schematics/OtpSchema.js'); 
const crypto = require('crypto');
require('dotenv').config();

// EMAIL CONFIG
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS
    }
});

// ==========================================
// 1. SEND OTP (Checks if email exists first)
// ==========================================
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;

        // A. Validate Domain
        if (!email.toLowerCase().endsWith('@ue.edu.ph')) {
            return res.status(400).json({ message: "Must use a @ue.edu.ph email address." });
        }

        // B. Check Duplicates (The feature you requested)
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            // Returns 409 Conflict
            return res.status(409).json({ message: "This UE email is already registered." });
        }

        // C. Generate & Save OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await Otp.deleteMany({ email });
        await new Otp({ email, otp: otpCode }).save();

        // D. Send Email
        await transporter.sendMail({
            from: '"UE Club Portal" <no-reply@ue-club-portal.com>',
            to: email,
            subject: 'UE Club Portal Verification Code',
            text: `Your verification code is: ${otpCode}`
        });

        res.json({ message: "OTP sent successfully." });

    } catch (error) {
        console.error("OTP Error:", error);
        res.status(500).json({ message: "Failed to send email. Check server logs." });
    }
});

// ==========================================
// 2. REGISTER USER (Final Step)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        // We add usertype, club, and skipVerification to the destructuring
        const { name, email, password, otp, usertype, club, skipVerification } = req.body;

        // --- A. CONDITIONAL OTP VERIFICATION ---
        // If skipVerification is NOT true, we enforce the OTP check.
        if (!skipVerification) {
            const validOtp = await Otp.findOne({ email, otp });
            if (!validOtp) {
                return res.status(400).json({ message: "Invalid or expired verification code." });
            }
        } else {
            // SECURITY CHECK: Ensure the person making this request is an Admin
            const requester = await getRequester(req);
            if (!requester || requester.usertype !== 'Admin') {
                return res.status(403).json({ message: "Unauthorized: Only Admins can bypass verification." });
            }
        }

        // B. Double Check Duplicate
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists." });
        }

        // C. Create User
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            // Use provided usertype/club (from Admin form) or default to Student/none
            usertype: usertype || 'Student', 
            club: club || "none",
            isVerified: true // Set to true immediately
        });

        await newUser.save();
        
        // Cleanup OTP if it was a standard registration
        if (!skipVerification) {
            await Otp.deleteMany({ email });
        }

        res.status(201).json({ message: "User registered successfully" });

    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: "Server error during registration" });
    }
});

// ==========================================
// 3. LOGIN ROUTE (Updated with Reason)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // 1. Find User
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid email or password" });

        // --- A. CHECK RESTRICTION STATUS ---
        if(user.isRestricted) {
            const now = new Date();
            if (!user.restrictionEnds || user.restrictionEnds > now) {
                return res.status(403).json({ 
                    message: "Account Restricted",
                    isRestricted: true,
                    reason: user.restrictionReason || "Violation of rules",
                    date: user.restrictionEnds || "Indefinite"
                });
            } 
            // Ban Expired -> Auto-Lift
            user.isRestricted = false;
            user.restrictionReason = undefined;
            user.restrictionEnds = undefined;
            await user.save();
        }

        // --- B. CHECK PASSWORD (With Auto-Hash Migration) ---
        let isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            if (user.password === password) {
                console.log(`⚠️ Migrating user ${user.email} to hash...`);
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);
                user.password = hashedPassword;
                await user.save();
                isMatch = true; 
            }
        }

        if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

        // --- C. LOGIN SUCCESS (Persistence Fix) ---
        // We ensure 'clubPosition' is fetched from the DB and put in the token
        const token = jwt.sign(
    { 
        userId: user._id, 
        role: user.usertype, 
        name: user.name,
        clubPosition: user.clubPosition || 'Member' // Sync token
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
);

if (req.session) {
    req.session.token = token;
}

res.json({
    message: "Login successful",
    token,
    user: {
        name: user.name,
        email: user.email,
        usertype: user.usertype,
        club: user.club,
        // MUST BE INCLUDED HERE
        clubPosition: user.clubPosition || 'Member' 
    },
    redirectUrl: '/ClubPortalFeed/ClubPortalFeed.html'
});

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// ==========================================
// RESTRICT USER ROUTE
// ==========================================
router.put('/restrict/:id', async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const { duration, reason } = req.body; // duration in days (or 'permanent')

        // 1. Get Requester (Admin/Adviser)
        const requester = await getRequester(req);
        if (!requester) return res.status(401).json({ message: "Unauthorized" });

        // 2. Get Target User
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        // 3. PERMISSION CHECK
        const isAdmin = requester.usertype === 'Admin';
        const isAdviser = requester.usertype === 'Teacher';
        
        // Rule: Admins can restrict anyone.
        // Rule: Advisers can ONLY restrict members of THEIR club.
        if (isAdviser) {
            if (targetUser.club !== requester.club) {
                return res.status(403).json({ message: "You can only restrict members of your own club." });
            }
            // Optional: Prevent Adviser from banning other Advisers or Admins
            if (targetUser.usertype === 'Teacher' || targetUser.usertype === 'Admin') {
                return res.status(403).json({ message: "You cannot restrict this user." });
            }
        } else if (!isAdmin) {
            return res.status(403).json({ message: "Permission denied." });
        }

        // 4. CALCULATE END DATE
        let endDate = null;
        if (duration !== 'permanent') {
            const days = parseInt(duration);
            if (!isNaN(days)) {
                endDate = new Date();
                endDate.setDate(endDate.getDate() + days);
            }
        }

        // 5. UPDATE USER
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
// UN-RESTRICT USER ROUTE
// ==========================================
router.put('/unrestrict/:id', async (req, res) => {
    try {
        const requester = await getRequester(req);
        const targetUser = await User.findById(req.params.id);

        if (!requester || !targetUser) return res.status(404).json({ message: "Not found" });

        // Same Permission Logic
        const isAdmin = requester.usertype === 'Admin';
        const isAdviser = requester.usertype === 'Teacher' && requester.club === targetUser.club;

        if (!isAdmin && !isAdviser) {
            return res.status(403).json({ message: "Permission denied." });
        }

        targetUser.isRestricted = false;
        targetUser.restrictionEnds = null;
        await targetUser.save();

        res.json({ success: true, message: "Restriction lifted." });

    } catch (e) {
        res.status(500).json({ message: "Server error" });
    }
});
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "No account found with that email." });
        }

        // Generate 6-digit Code
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save to Database (Valid for 15 mins)
        user.resetOTP = otp;
        user.otpExpires = Date.now() + 15 * 60 * 1000; 
        await user.save();

        // Send Email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'your-email@gmail.com', // REPLACE THIS
                pass: 'your-app-password'     // REPLACE THIS
            }
        });

        const mailOptions = {
            from: 'Club Portal Support',
            to: user.email,
            subject: 'Password Reset Code',
            text: `Your password reset code is: ${otp}\n\nIt expires in 15 minutes.`
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: "OTP sent to your email!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to send email" });
    }
});
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ 
            email, 
            resetOTP: otp, 
            otpExpires: { $gt: Date.now() } // Check if not expired
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired OTP." });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        user.password = hashedPassword;
        user.resetOTP = undefined; // Clear OTP
        user.otpExpires = undefined;
        await user.save();

        res.json({ message: "Password reset successful! Please login." });

    } catch (error) {
        res.status(500).json({ message: "Error resetting password" });
    }
});
async function getRequester(req) {
    const token = req.session?.token || req.headers['authorization']?.split(' ')[1];
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return await User.findById(decoded.userId);
    } catch (e) { return null; }
}
module.exports = router;