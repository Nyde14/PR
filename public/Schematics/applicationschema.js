const mongoose = require('mongoose');
const { modelName } = require('./UserSchema');

// 1. New Application Schema (The "Waiting Room")
const ApplicationSchema = new mongoose.Schema({
    studentname: String,
    clubname: String,
    status: { type: String, default: 'pending' },
    appliedat: { type: Date, default: Date.now }
}, { collection: 'applications' }); // Use lowercase collection name as requested

const Application = mongoose.model('Application', ApplicationSchema);

module.exports = Application;