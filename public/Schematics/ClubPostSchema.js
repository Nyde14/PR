const mongoose = require('mongoose');

const clubPostSchema = new mongoose.Schema({
    author: { type: String, required: true },
    authorProfile: String,
    clubname: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    mediaUrl: { type: String },
    mediaType: { type: String, default: 'none' }, // 'image', 'video', 'none'
    timestamp: { type: Date, default: Date.now },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [
        {
            author: String,
            userProfile: String, // Cache avatar for speed
            content: String,
            timestamp: { type: Date, default: Date.now },
            replies: [{
                author: String,
                userProfile: String,
                content: String,
                timestamp: { type: Date, default: Date.now }
            }]
        }
    ],
    visibility: { type: String, default: 'public' },
    
    // --- NEW FIELD FOR ADMIN ANNOUNCEMENTS ---
    isGlobal: { type: Boolean, default: false } 
});

module.exports = mongoose.model('ClubPost', clubPostSchema);