//The main backend of the log in page

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../modules/User')

const router = express.Router();

// Debug: confirm the router file is loaded and list any routes attached to the router
console.log('Loaded LoginRoute.js');
if (router && router.stack) {
  console.log('LoginRoute initial routes:', router.stack.filter(s => s.route).map(s => Object.keys(s.route.methods).join(',').toUpperCase() + ' ' + s.route.path));
}

router.post('/login', async(req, res) =>{
    try{
        const { email, password } = req.body;

        // Debug: log incoming request body to verify data from frontend
        console.log('POST /api/auth/login body:', req.body);

        // Basic validation: ensure both email and password are present
        if (!email || !password) {
            console.log('Missing login fields:', { email, passwordPresent: !!password });
            return res.status(400).json({ message: 'Missing email or password' });
        }

        // Normalize incoming email and add diagnostics
        const rawEmail = email;
        const trimmedEmail = rawEmail ? rawEmail.trim() : rawEmail;
        console.log('Normalized email info:', { raw: rawEmail, trimmed: trimmedEmail, rawLen: rawEmail ? rawEmail.length : 0, trimmedLen: trimmedEmail ? trimmedEmail.length : 0 });

        // Try exact lookup with trimmed email first
        let emailget = await User.findOne({ email: trimmedEmail });

        // If not found, try a case-insensitive match (helps when DB stores different case)
        if (!emailget && trimmedEmail) {
            const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp('^' + escapeRegex(trimmedEmail) + '$', 'i');
            console.log('No exact match found; trying case-insensitive regex:', regex);
            emailget = await User.findOne({ email: regex });
        }

        if(!emailget){
            // As an extra diagnostic, list a few sample emails from DB to confirm connection and contents
            let sample = [];
            try {
                sample = await User.find().limit(5).select('email').lean();
            } catch (err) {
                console.log('Error fetching sample users for diagnostics:', err.message);
            }
            console.log('No user found for email:', trimmedEmail, 'DB sample emails:', sample);
            return res.status(400).json({message:'Invalid Email or Password'})

        }

        console.log('Found user for debug:', { email: emailget.email, passwordHashPrefix: emailget.password ? emailget.password.slice(0,4) : null, passwordHashLen: emailget.password ? emailget.password.length : 0 });

        const PassMatch = await bcrypt.compare(password, emailget.password );
        console.log('bcrypt compare result for', email, ':', PassMatch);

        // Handle case where stored password may be plaintext (migration helper)
        let finalPassMatch = PassMatch;
        if (!finalPassMatch) {
            const stored = emailget.password;
            const looksLikeBcrypt = typeof stored === 'string' && stored.startsWith('$2');
            console.log('Stored password diagnostics:', { looksLikeBcrypt, storedLen: stored ? stored.length : 0 });

            // If it doesn't look like a bcrypt hash and equals the provided password, migrate it (only outside production)
            if (!looksLikeBcrypt && stored === password) {
                if (process.env.NODE_ENV === 'production') {
                    console.log('Plaintext password match in production — automatic migration disabled');
                } else {
                    console.log('Plaintext password matches — migrating to bcrypt hash for', email);
                    try {
                        const newHash = await bcrypt.hash(password, 10);
                        emailget.password = newHash;
                        await emailget.save();
                        finalPassMatch = true;
                        console.log('Password migrated to bcrypt for', email);
                    } catch (err) {
                        console.error('Failed to migrate plaintext password for', email, err.message);
                    }
                }
            }
        }

        if(!finalPassMatch){
            return res.status(400).json({message:'Invalid Email or Password'});

        }
        const token = jwt.sign(
            { userId: emailget._id, email: emailget.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        // Store token in session
        req.session.token = token;

        res.json({
            message: 'logged in successfully',
            token,
            user: {
                id: emailget._id,
                email: emailget.email
            }
        });
    }
    catch(e){
        res.status(500).json({message:'server error', error: e.message});
    }
})

router.post('/logout',(req, res)=>{
    req.session.destroy((e)=>{
        if(e){
            return res.status(500).json({message:'log out failed'})
        }
        res.json({message:'log out successful'});
    })
})


module.exports = router