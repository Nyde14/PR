const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    usertype: { type: String, required: true, enum: ['Student', 'Teacher', 'Admin'] },
    club: { type: String, default: "none" },
    interests: { type: [String], default: [] },
    following: [{ type: String }], 
    hiddenPosts: [{ type: String }], 
    profilePicture: { type: String, default: "" }, 
    isRestricted: { type: Boolean, default: false },
    restrictionReason: { type: String, default: "" },
    restrictionEnds: { type: Date },
    resetOTP: { type: String },
    otpExpires: { type: Date }
});

module.exports = mongoose.model('User', userSchema);