const mongoose = require('mongoose');

const ClubSchema = new mongoose.Schema({
  urlSlug: String,
    clubname: String,
    category: String,
    shortDescription: String,
    fullDescription: String,
    branding: {
        logo: String,
        banner: String,
        themeColor: String
    },
    membercount: Number
}, { collection: 'Clubs' });

module.exports = mongoose.model('club', ClubSchema, 'Clubs');