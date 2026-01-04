require('dotenv').config();// Load environment variables from .env file 

if (!process.env.MONGO_URI) {
  console.error('Missing MONGO_URI in .env');
  process.exit(1);
}
if (!process.env.SESSION_SECRET) {
  console.error('Missing SESSION_SECRET in .env');
  process.exit(1);
}
import {pre, isValidPassword} from './Login/Login.js';  
const express= require('express');// Import Express framework
const path = require('path');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');               // <- use mongoose here
const MongoStore = require('connect-mongo');       // <- connect-mongo for session store
const session = require('express-session');

let User;
try {
  User = require('./public/Login/Login.js');   // Ensure this exports a Mongoose model
} catch (err) {
  console.error('Error loading User model:', err);
  process.exit(1);
}

const app = express();  
const PORT = process.env.PORT || 3000; // Set port to 3000

//connect to database
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Connected to MongoDB");

    // start server only after DB connection
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });

}).catch((err) => {
    console.error("Error connecting to MongoDB", err);
    process.exit(1);
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// simple auth middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

//session
let sessionStore;
try {
  sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60 // 1 day
  });
} catch (err) {
  console.error('Error creating MongoStore:', err);
  process.exit(1);
}

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { 
      maxAge: 24 * 60 * 60 * 1000,
      secure: false,
      httpOnly: true
    }
}));

//login backend
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({error: 'Email and password are required'});
    }
    try{
      // find user by email
      const user = await User.findOne({ email: email });
      if (!user) {
          return res.status(400).json({ error: 'Invalid email or password' });
      }
      // check password (assuming user.password is hashed)
      const isValid = await bcrypt.compare(password, user.password);
      if(!isValid) {
          return res.status(400).json({ error: 'Invalid email or password' });
      }

      // create login session
      req.session.userId = user._id.toString();
      req.session.name = user.name;

      res.json({ message: 'Login successful', user: user.toJSON()});
    }
    catch (err) {
      console.error("Login error", err);
      res.status(500).json({ error: 'Internal server error' });
    }
});

//logging out
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
      if (err) {
          return res.status(500).json({ error: 'Could not log out. Please try again.' });
      }
      res.json({ message: 'Logout successful' });
  });
});
//check if session is still active
app.get('/api/user', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: user.toJSON() });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
//clubportalfeed route
app.get('/home', (req, res) => {
  res.json({ message: 'Welcome to the Club Portal Feed!' });
});

// static / html routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
  
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Login', 'Login.html'));
});