const express = require('express');
const session = require('express-session');
const connectDB = require('./public/modules/connectdb.js');
const authRoutes = require('./public/Login/LoginRoute.js');
const authenticateToken = require('./public/modules/sessiontoken.js');
const path = require('path');
require('dotenv').config();

const app = express();

// Connect to databasae
connectDB();

// log in session token given
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve front end files html css and client side js
const jwt = require('jsonwebtoken');

// Middleware for HTML routes that should redirect to login on failure
const ensureAuthenticatedHtml = (req, res, next) => {
  const token = req.session.token || req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.redirect('/Login/Login.html');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.redirect('/Login/Login.html');
  }
};

// Protect ClubPortalFeed static files
app.use('/ClubPortalFeed', ensureAuthenticatedHtml, express.static(path.join(__dirname, 'public', 'ClubPortalFeed')));

// Serve Profile static files (protected)
app.use('/Profile', ensureAuthenticatedHtml, express.static(path.join(__dirname, 'public', 'Profile')));
app.get('/Profile/:id', ensureAuthenticatedHtml, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Profile', 'Profile.html'));
});

// Mount user API routes
const userRoutes = require('./public/User/UserRoute.js');
app.use('/api/users', userRoutes);

// Club-related API routes
const clubRoutes = require('./public/Club/ClubRoute.js');
app.use('/api/clubs', clubRoutes);

// Serve remaining public files
app.use(express.static('public'));

// code use to track requests from users
app.use((req, res, next) => {
  console.log(`Incoming: ${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
// lists api auth routes for debugging
if (authRoutes && authRoutes.stack) {
  console.log('/api/auth mounted. Routes:', authRoutes.stack.filter(s => s.route).map(s => Object.keys(s.route.methods).join(',').toUpperCase() + ' ' + s.route.path));
} else {
  console.log('/api/auth mounted (no router stack available)');
}

app.get('/ClubPortalFeed/ClubPortalFeed.html', ensureAuthenticatedHtml, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ClubPortalFeed', 'ClubPortalFeed.html'));
});

app.get('/ApplyClub/Clublist.html', ensureAuthenticatedHtml, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ApplyClub', 'Clublist.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
