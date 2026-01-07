//The main backend of the log in page
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../modules/UserSchema')
const TokenValid = require('../modules/sessiontoken');

const router = express.Router();

console.log('Loaded LoginRoute.js');

router.post('/login', async(req, res) =>{
    try{
        const { email, password } = req.body;

        if (!email || !password) {
            console.log('Incorrect email or password');
            return res.status(400).json({ message: 'Missing email or password' });
        }

        const rawEmail = email;
        
        // 1. Try exact lookup
        let emailget = await User.findOne({ email: rawEmail });

        // 2. FIX: Implement the case-insensitive fallback (You had this empty before)
        if (!emailget && rawEmail) {
           // This checks for the email ignoring case (e.g., User@Test.com finds user@test.com)
           emailget = await User.findOne({ email: { $regex: new RegExp(`^${rawEmail}$`, 'i') } });
        }

        // 3. CRITICAL FIX: Stop execution if user is still not found
        if (!emailget) {
            console.log('User not found in DB for email:', rawEmail);
            // Return here to prevent crashing on the next lines
            return res.status(400).json({ message: 'Invalid Email or Password' }); 
        }

        // Now it is safe to log details because we know emailget exists
        console.log('Found user:', { 
            email: emailget.email, 
            hasPassword: !!emailget.password 
        });

        const PassMatch = await bcrypt.compare(password, emailget.password );
        console.log('bcrypt compare result:', PassMatch);

        let finalPassMatch = PassMatch;

        // Plaintext password migration logic
        if (!finalPassMatch) {
            const stored = emailget.password;
            // Check if stored password exists properly
            const looksLikeBcrypt = stored && typeof stored === 'string' && stored.startsWith('$2');
            
            // Only compare if stored is actual string
            if (!looksLikeBcrypt && stored === password) {
                if (process.env.NODE_ENV === 'production') {
                    console.log('Plaintext password match in production — automatic migration disabled');
                } else {
                    console.log('Plaintext match — migrating to bcrypt');
                    try {
                        const newHash = await bcrypt.hash(password, 10);
                        emailget.password = newHash;
                        await emailget.save();
                        finalPassMatch = true;
                        console.log('Password migrated');
                    } catch (err) {
                        console.error('Migration failed', err.message);
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
        
        req.session.token = token;

        res.json({
            message: 'logged in successfully',
            token,
            user: {
                id: emailget._id,
                email: emailget.email,
                name: emailget.name
            }
        });
    }
    catch(e){
        console.error("Login Error:", e); // Log the actual error to console
        res.status(500).json({message:'server error', error: e.message});
        
    }
})


// ... rest of your code (GET /me, logout) remains the same
module.exports = router;