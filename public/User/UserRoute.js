const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../modules/UserSchema');
const TokenValid = require('../modules/sessiontoken');

const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, club, clubrole, bio } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Missing required fields (email, password, name)' });
    }

    const existing = await User.findOne({ email: email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    const hash = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hash, name, club, clubrole, bio });
    await newUser.save();

    res.status(201).json({
      message: 'User created',
      user: { id: newUser._id, name: newUser.name, email: newUser.email },
      profileUrl: `/Profile/${newUser._id}`
    });
  } catch (e) {
    console.error('Register error:', e.message);
    res.status(500).json({ message: 'server error', error: e.message });
  }
});

// Get public profile data
router.get('/:id', TokenValid, async (req, res) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id).select('name bio avatar club clubrole clubs createdAt email').populate('clubs', 'name');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isSelf = req.user && String(req.user.userId) === String(id);

    const clubs = (user.clubs || []).map(c => ({ id: c._id, name: c.name }));

    const profile = {
      id: user._id,
      name: user.name,
      bio: user.bio || '',
      avatar: user.avatar || '',
      club: user.club || '',
      clubrole: user.clubrole || '',
      clubs,
      createdAt: user.createdAt,
      self: !!isSelf
    };
    if (isSelf) profile.email = user.email;

    res.json(profile);
  } catch (e) {
    console.error('Get profile error:', e.message);
    res.status(500).json({ message: 'server error', error: e.message });
  }
});

module.exports = router;
