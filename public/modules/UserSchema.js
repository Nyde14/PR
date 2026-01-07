//The schema for the user profile in the database

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
    },
    name:{
        type: String,
        required: true
    },
    bio:{
        type: String,
        required: false,
        default: ''
    },
    avatar:{
        type: String,
        required: false,
        default: ''
    },
    club:{
        type: String,
        required: false
    },
    clubrole:{
        type: String,
        required: false
    },
    /* New: array of joined clubs (references to Club docs). This is additive so existing records remain compatible. */
    clubs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Club' }],
    createdAt:{
        type: Date,
        default: Date.now
    }

}, { collection: 'users' });

module.exports = mongoose.model('User', UserProfile, 'users')