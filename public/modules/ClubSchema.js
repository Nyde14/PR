const mongoose = require('mongoose');

const ClubSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  short: { type: String, required: false },
  description: { type: String, required: false, default: '' },
  avatar: { type: String, required: false, default: '' },
  banner: { type: String, required: false, default: '' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
}, { collection: 'clubs' });

module.exports = mongoose.model('Club', ClubSchema, 'clubs');