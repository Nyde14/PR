const express = require('express');
const session = require('express-session');
const connectDB = require('./public/modules/connectdb.js');
const authRoutes = require('./public/Login/LoginRoute.js');
const authenticateToken = require('./public/modules/sessiontoken.js');
require('dotenv').config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files (your HTML, CSS, JS)
app.use(express.static('public'));

// Debugging: log every incoming request to help trace 404s
app.use((req, res, next) => {
  console.log(`Incoming: ${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
// Debugging: list routes mounted by the auth router (if available)
if (authRoutes && authRoutes.stack) {
  console.log('/api/auth mounted. Routes:', authRoutes.stack.filter(s => s.route).map(s => Object.keys(s.route.methods).join(',').toUpperCase() + ' ' + s.route.path));
} else {
  console.log('/api/auth mounted (no router stack available)');
}

app.get('/api/dashboard', authenticateToken, (req, res) => {
  res.json({ message: 'Welcome', user: req.user });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
