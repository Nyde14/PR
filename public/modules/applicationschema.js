const mongoose = require('mongoose');
const { modelName } = require('./UserSchema');

// 1. New Application Schema (The "Waiting Room")
const applicationSchema = new mongoose.Schema({
  name: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  Clubname: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Club', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  appliedAt: { type: Date, default: Date.now }
});

// 2. Update Existing User Schema
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  //Tracks which clubs the user belongs to
  currentClubs: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Club' 
  }]
});

// 3. Update Existing Club Schema
const clubSchema = new mongoose.Schema({
  name: String,
  description: String,
  // ADD THIS FIELD: Tracks the members inside the club
  members: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }]
});

const Application = mongoose.model('Application', applicationSchema);
const User = mongoose.model('User', userSchema);
const Club = mongoose.model('Club', clubSchema);

module.exports = { Application, User, Club };