const mongoose = require('mongoose');

const clubPostSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: String, required: true },
    clubname: { type: String, required: true },
    mediaUrl: { type: String }, 
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    visibility: { type: String, enum: ['public', 'club-only'], default: 'public' },
    timestamp: { type: Date, default: Date.now },
    
    // --- UPDATED COMMENT SECTION ---
    comments: [{
        author: String,
        userAvatar: { type: String }, // <--- ADD THIS LINE
        content: String,
        timestamp: { type: Date, default: Date.now },
        replies: [{
            author: String,
            userAvatar: { type: String }, // <--- ADD THIS TOO (Optional for replies)
            content: String,
            timestamp: { type: Date, default: Date.now }
        }]
    }]
});

module.exports = mongoose.model('ClubPost', clubPostSchema);