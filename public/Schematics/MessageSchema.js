const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    // 'clubname' is now optional because Private Messages don't have one
    clubname: { type: String, default: null }, 
    
    // NEW: Who is receiving this message? (If null, it's a group chat)
    recipient: { type: String, default: null }, 
    
    sender: { type: String, required: true },
    clubrole: { type: String, enum: ['student', 'adviser', 'Adviser', 'Student', 'Admin'], default: 'Student' },
    
    content: { type: String, default: "" },
    
    mediaUrl: { type: String, default: null },
    mediaType: { type: String, enum: ['image', 'video', 'none'], default: 'none' },
    
    approvalStatus: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'], 
        default: 'pending' 
    },  

    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: String, default: null },
    deletedAt: { type: Date, default: null },
    
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);