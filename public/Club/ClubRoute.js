const express = require('express');
const Club = require('../modules/ClubSchema');
const User = require('../modules/UserSchema');
const TokenValid = require('../modules/sessiontoken');

const router = express.Router();

// List clubs (optional ?q=search)
router.get('/', async (req, res) => {
  try {
    const q = req.query.q ? { name: new RegExp(req.query.q, 'i') } : {};
    const clubs = await Club.find(q).select('name short description avatar members').lean();
    res.json({ clubs });
  } catch (e) {
    console.error('List clubs error:', e.message);
    res.status(500).json({ message: 'server error', error: e.message });
  }
});

// Get club details (populate small set of members)
router.get('/:id', async (req, res) => {
  try {
    const club = await Club.findById(req.params.id).populate('members', 'name avatar').lean();
    if (!club) return res.status(404).json({ message: 'Club not found' });
    res.json(club);
  } catch (e) {
    console.error('Get club error:', e.message);
    res.status(500).json({ message: 'server error', error: e.message });
  }
});

// Create a club (logged-in only)
router.post('/', TokenValid, async (req, res) => {
  try {
    const { name, short, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Missing club name' });
    const existing = await Club.findOne({ name });
    if (existing) return res.status(409).json({ message: 'Club already exists' });
    const club = new Club({ name, short, description, members: [req.user.userId] });
    await club.save();
    // add club to user's clubs array
    await User.findByIdAndUpdate(req.user.userId, { $addToSet: { clubs: club._id } });
    res.status(201).json({ message: 'Club created', club });
  } catch (e) {
    console.error('Create club error:', e.message);
    res.status(500).json({ message: 'server error', error: e.message });
  }
});

// Join a club (adds the user to the club and club to user's clubs)
router.post('/:id/join', TokenValid, async (req, res) => {
  try {
    const clubId = req.params.id;
    const userId = req.user.userId;
    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ message: 'Club not found' });

    const alreadyMember = club.members.some(m => String(m) === String(userId));
    if (alreadyMember) return res.status(200).json({ message: 'Already a member' });

    club.members.push(userId);
    await club.save();

    await User.findByIdAndUpdate(userId, { $addToSet: { clubs: club._id } });

    res.json({ message: 'Joined club', clubId, userId });
  } catch (e) {
    console.error('Join club error:', e.message);
    res.status(500).json({ message: 'server error', error: e.message });
  }
});

// Leave a club
router.post('/:id/leave', TokenValid, async (req, res) => {
  try {
    const clubId = req.params.id;
    const userId = req.user.userId;
    await Club.findByIdAndUpdate(clubId, { $pull: { members: userId } });
    await User.findByIdAndUpdate(userId, { $pull: { clubs: clubId } });
    res.json({ message: 'Left club' });
  } catch (e) {
    console.error('Leave club error:', e.message);
    res.status(500).json({ message: 'server error', error: e.message });
  }
});

module.exports = router;