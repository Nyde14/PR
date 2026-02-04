const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: { type: String, required: true }, // The username of who gets the message
    sender: { type: String, default: "System" }, // Who sent it (Club Name or "System")
    type: { type: String, default: 'info' },     // 'alert', 'success', 'info'
    message: { type: String, required: true },   // "You were accepted!"
    link: { type: String, default: '#' },        // Where they go when they click it
    isRead: { type: Boolean, default: false },   // Has the red dot disappeared?
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);