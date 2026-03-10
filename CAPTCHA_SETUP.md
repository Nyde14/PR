# CAPTCHA Integration Setup Guide

## Overview
CAPTCHA has been successfully integrated into both the Login and Register pages using Google reCAPTCHA v2 (Checkbox).

## Current Configuration

### Test/Development Mode
The system is currently configured with **Google's official test keys** that will **always pass verification**. This is useful for development and testing.

**Test Keys (in `.env`):**
```
RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
```

These test keys are used in:
- `public/Login/Login.html` - Login page
- `public/Register/Register.html` - Register page

## How It Works

### Frontend
1. Both Login and Register pages now include Google's reCAPTCHA script
2. A CAPTCHA checkbox widget appears on each form
3. User must check the "I'm not a robot" box before submission
4. The CAPTCHA token is automatically captured and sent with the form data

### Backend
1. `public/Login/LoginRoute.js` now includes a `verifyCaptcha()` function
2. Both login and register endpoints verify the CAPTCHA token
3. If verification fails, the request is rejected with an error message

## For Production Use

To use real reCAPTCHA keys in production:

### Step 1: Get Your Keys
1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Sign in with your Google account
3. Click "+" to create a new site
4. Fill in the details:
   - **Label:** UE Club Portal
   - **reCAPTCHA Type:** reCAPTCHA v2 (Checkbox)
   - **Domains:** Add your domain (e.g., yourdomain.com)
5. Click "Create"
6. Copy your **Site Key** and **Secret Key**

### Step 2: Update Files
1. Update `.env` with your actual keys:
   ```
   RECAPTCHA_SITE_KEY=your_actual_site_key_here
   RECAPTCHA_SECRET_KEY=your_actual_secret_key_here
   ```

2. Update the CAPTCHA widget in HTML files:
   - `public/Login/Login.html` - Change `data-sitekey` value
   - `public/Register/Register.html` - Change `data-sitekey` value

### Step 3: Restart Server
```bash
npm run start
```

## Files Modified

- ✅ `public/Login/Login.html` - Added reCAPTCHA script and widget
- ✅ `public/Login/Login.js` - Added CAPTCHA token validation
- ✅ `public/Register/Register.html` - Added reCAPTCHA script and widget
- ✅ `public/Register/Register.js` - Added CAPTCHA token validation
- ✅ `public/Login/LoginRoute.js` - Added backend CAPTCHA verification
- ✅ `.env` - Added RECAPTCHA keys

## Features

### Security Features
- ✅ Prevents automated bot attacks on login/registration
- ✅ Server-side verification of CAPTCHA tokens
- ✅ Invalid tokens are rejected
- ✅ Works with both test and production keys

### User Experience
- ✅ Simple checkbox interface (reCAPTCHA v2)
- ✅ Clear error messages if CAPTCHA fails
- ✅ CAPTCHA is reset automatically on registration errors
- ✅ Non-intrusive and user-friendly

## Testing

### Test with Google's Test Keys
1. Run the application with current keys
2. On Login/Register page, you'll see a CAPTCHA checkbox
3. Check the "I'm not a robot" box
4. Submit the form - it will always pass verification

### Basic Test Cases
- ✔️ Login without checking CAPTCHA - shows error message
- ✔️ Login with CAPTCHA checked - allows login
- ✔️ Register without checking CAPTCHA - shows error message
- ✔️ Register with CAPTCHA checked - allows registration
- ✔️ Failed registration - CAPTCHA resets automatically

## Troubleshooting

### CAPTCHA widget not appearing
- Check if the reCAPTCHA script is loaded: `<script src="https://www.google.com/recaptcha/api.js"></script>`
- Verify the `data-sitekey` attribute matches your configuration

### "CAPTCHA verification failed" error
- Verify your `RECAPTCHA_SECRET_KEY` in `.env` is correct
- For test keys, ensure you're using the exact keys provided above
- Check server logs for verification details

### CAPTCHA always passes (using test keys)
- This is expected! Test keys are designed to always pass
- Replace with production keys when ready

## Alternative CAPTCHA Options

If you want to switch to different CAPTCHA providers:
- **reCAPTCHA v3:** More invisible, scores user behavior (0-1)
- **hCaptcha:** Privacy-focused alternative
- **Custom CAPTCHA:** DIY solution (requires additional development)

Contact your administrator if you want to switch providers.

## Security Reminder

⚠️ **Never commit `.env` file with real secret keys to version control!**
- Add `.env` to `.gitignore`
- Use environment variables in production
- Keep your secret keys private
