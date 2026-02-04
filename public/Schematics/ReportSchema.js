const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reporter: { type: String, required: true }, // User Name
    targetType: { type: String, enum: ['Post', 'Message', 'User'], required: true },
    targetId: { type: String, required: true }, // ID of the post/message/user
    reason: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Resolved', 'Dismissed'], default: 'Pending' },
    timestamp: { type: Date, default: Date.now },
    resolvedBy: { type: String, default: null } // Admin Name
});

module.exports = mongoose.model('Report', reportSchema);