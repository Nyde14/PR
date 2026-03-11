document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // 0. CUSTOM CAPTCHA SETUP
    // ==========================================
    const reminderModal = document.getElementById('RegisterReminderModal');
    
    if (reminderModal) {
        // Check if the browser remembers seeing this
        const hasSeenReminder = localStorage.getItem('hasSeenRegisterReminder');
        
        if (!hasSeenReminder) {
            // Small 500ms delay so it doesn't jump-scare them the millisecond the page loads
            setTimeout(() => {
                reminderModal.style.display = 'flex';
            }, 500);
        }
    }

    // Function attached to the window so the HTML button can trigger it
    window.closeReminderModal = function() {
        document.getElementById('RegisterReminderModal').style.display = 'none';
        
        // Plant the flag! This browser will never see the modal again.
        localStorage.setItem('hasSeenRegisterReminder', 'true');
    };
    const canvas = document.getElementById('captchaCanvas');
    let generatedCaptcha = '';

    // Function to generate random jumbled characters
    function generateJumbledCharacters() {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Function to draw CAPTCHA on canvas
    function drawCaptcha() {
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw random lines (noise)
        ctx.strokeStyle = '#ddd';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * width, Math.random() * height);
            ctx.lineTo(Math.random() * width, Math.random() * height);
            ctx.stroke();
        }

        // Draw random dots (noise) - lighter
        for (let i = 0; i < 10; i++) {
            ctx.fillStyle = '#e0e0e0';
            ctx.beginPath();
            ctx.arc(Math.random() * width, Math.random() * height, 1.5, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Generate new CAPTCHA text
        generatedCaptcha = generateJumbledCharacters();

        // Draw text with various styles and rotations
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = '#333';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < generatedCaptcha.length; i++) {
            ctx.save();
            
            // Random rotation
            const angle = (Math.random() - 0.5) * 0.4;
            const x = 30 + i * 40;
            const y = height / 2 + (Math.random() - 0.5) * 20;

            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.fillText(generatedCaptcha[i], 0, 0);
            
            ctx.restore();
        }

        // Clear the captcha input field
        document.getElementById('captchaInput').value = '';
    }

    // Draw CAPTCHA on page load
    drawCaptcha();

    // Refresh button event listener
    const refreshBtn = document.getElementById('refreshCaptcha');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            drawCaptcha();
        });
    }

    // ==========================================
    // 1. VIDEO INTRO LOGIC
    // ==========================================
    const video = document.getElementById('IntroVideo');
    const overlay = document.getElementById('IntroOverlay');

    if (video && overlay) {
        video.onended = () => {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 800);
        };
        setTimeout(() => {
            if (document.body.contains(overlay)) {
                overlay.classList.add('fade-out');
                setTimeout(() => overlay.remove(), 800);
            }
        }, 6000);
    }

    // ==========================================
    // 2. LOGIN FORM LOGIC (Fixed Error)
    // ==========================================
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
             localStorage.clear(); 
    sessionStorage.clear();
            // --- FIX: DEFINE THE VARIABLE HERE ---
            const msgBox = document.getElementById('LoginMessage'); 
            const btn = document.getElementById('loginbtn');
            
            // 1. Clear previous errors & Disable button
            msgBox.style.display = 'none';
            msgBox.innerText = "";
            
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "Logging in...";

            const email = document.getElementById('EmailInput').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            const captchaInput = document.getElementById('captchaInput').value.trim().toUpperCase();
            
            // Validate CAPTCHA (case-insensitive)
            if (captchaInput !== generatedCaptcha) {
                msgBox.style.color = "#721c24";
                msgBox.style.backgroundColor = "#f8d7da";
                msgBox.style.borderColor = "#f5c6cb";
                msgBox.innerText = "CAPTCHA verification failed. Please try again.";
                msgBox.style.display = 'block';
                btn.disabled = false;
                btn.innerText = originalText;
                drawCaptcha(); // Refresh CAPTCHA
                return;
            }

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                if (res.status === 403 && data.isRestricted) {
                const reason = encodeURIComponent(data.reason);
                const date = encodeURIComponent(data.date);
                window.location.href = `/Login/Restricted.html?reason=${reason}&date=${date}`;
                return; // Stop here!
            }

                if (res.ok) {
    // 1. CLEAR OLD STATE
    localStorage.clear();
    sessionStorage.clear();

    // 2. SAVE FRESH DATA
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user)); // Save full object
    localStorage.setItem('username', data.user.name);
    localStorage.setItem('usertype', data.user.usertype);
    localStorage.setItem('userclub', data.user.club);
    
    // 3. UI FEEDBACK
    msgBox.style.color = "#155724"; 
    msgBox.style.backgroundColor = "#d4edda";
    msgBox.innerText = "Login Successful! Redirecting...";
    msgBox.style.display = 'block';

    setTimeout(() => {
        window.location.href = '/ClubPortalFeed/ClubPortalFeed.html';
    }, 1000);

                } else {
                    // FAILURE
                    throw new Error(data.message || "Login failed");
                }
            } catch (err) {
                // ERROR DISPLAY
                msgBox.style.color = "#721c24";
                msgBox.style.backgroundColor = "#f8d7da";
                msgBox.style.borderColor = "#f5c6cb";
                msgBox.innerText = err.message;
                msgBox.style.display = 'block';
                
                // Re-enable button
                btn.disabled = false;
                btn.innerText = originalText;
            }
        });
    } else {
        console.error("Error: Login form not found!");
    }
});

// ==========================================
// 3. FORGOT PASSWORD MODAL LOGIC
// ==========================================

// Ensure button exists before adding listener to prevent null errors
const forgotBtn = document.getElementById('forgotpass');
if (forgotBtn) {
    forgotBtn.addEventListener('click', (e) => {
        e.preventDefault(); 
        document.getElementById('ForgotModal').style.display = 'flex';
        document.getElementById('Step1').style.display = 'block';
        document.getElementById('Step2').style.display = 'none';
        document.getElementById('ModalMessage').innerText = "";
    });
}

window.closeModal = function() {
    document.getElementById('ForgotModal').style.display = 'none';
};

window.requestOTP = async function() {
    const email = document.getElementById('ForgotEmail').value.trim().toLowerCase();
    const msgBox = document.getElementById('ModalMessage');
    const btn = document.getElementById('SendOtpBtn');

    if (!email) {
        msgBox.innerText = "Please enter your email.";
        msgBox.style.color = "red";
        return;
    }

    btn.innerText = "Sending...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById('Step1').style.display = 'none';
            document.getElementById('Step2').style.display = 'block';
            msgBox.innerText = "Code sent! Check your inbox.";
            msgBox.style.color = "green";
        } else {
            throw new Error(data.message);
        }
    } catch (err) {
        msgBox.innerText = err.message || "Failed to send code.";
        msgBox.style.color = "red";
        btn.innerText = "Send Code";
        btn.disabled = false;
    }
};

window.resetPassword = async function() {
    const email = document.getElementById('ForgotEmail').value;
    const otp = document.getElementById('OtpInput').value;
    const newPass = document.getElementById('NewPassInput').value;
    const msgBox = document.getElementById('ModalMessage');

    if (!otp || !newPass) {
        msgBox.innerText = "Please fill in all fields.";
        return;
    }

    try {
        const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, newPassword: newPass })
        });

        const data = await res.json();

        if (res.ok) {
            window.showToast("Password Reset Successful! You can now log in.");
            closeModal();
        } else {
            msgBox.innerText = data.message;
            msgBox.style.color = "red";
        }
    } catch (err) {
        msgBox.innerText = "Error resetting password.";
    }
};
// Global.js - ADD TO VERY TOP
(function deterConsoleSnoopers() {
    // 1. Print a massive warning
    console.log("%cSTOP!", "color: red; font-size: 50px; font-weight: bold; text-shadow: 2px 2px 0px black;");
    console.log("%cThis is a browser feature intended for developers. If someone told you to copy-paste something here to enable a feature or 'hack' an account, it is a scam and will give them access to your account.", "font-size: 18px; color: #333;");
    
    // 2. Optional: Clear the console immediately if they aren't quick enough
    // setInterval(() => console.clear(), 2000); 
})();

(function(){
    window.unlockConsole = function(passcode) {
        // Use a specific developer passcode (Do NOT use your actual admin account password here)
        if (passcode === "MeowMeowhahaha") {
            
            // 3. If correct, attach the dev tools to the window so you can use them
            window.NexusAdmin = devTools;
            
            console.clear();
            console.log("%c🔓 CONSOLE UNLOCKED", "color: #28a745; font-size: 24px; font-weight: bold;");
            console.log("%cDeveloper tools have been mounted to 'NexusAdmin'.", "color: #333; font-size: 14px;");
            console.log("Type %cNexusAdmin.%c to see available commands.", "color: #fa3737; font-weight: bold;", "color: inherit;");
            
            return "Welcome back, Admin.";
        } else {
            console.log("%c❌ ACCESS DENIED", "color: #fa3737; font-size: 24px; font-weight: bold;");
            return "Intruder logged.";
        }
    };
})();
