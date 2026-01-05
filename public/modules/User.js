const mongoose = require('mongoose');

const UserProfile = new mongoose.Schema({
    email:{
        type: String,
        required: true,
        unique: true
    },
    password:{
        type: String,
        required: true
    }
}, { collection: 'main' });

module.exports = mongoose.model('User', UserProfile, 'main')