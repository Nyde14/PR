// ==========================================
// 0. CUSTOM CAPTCHA SETUP
// ==========================================
let regAttempts = parseInt(localStorage.getItem('regAttempts')) || 0;
const MAX_ATTEMPTS = 5;
document.addEventListener('DOMContentLoaded', function() {
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

    // Store reference to generatedCaptcha in window so form can access it
    window.generatedCaptcha = () => generatedCaptcha;
    window.drawCaptcha = drawCaptcha;
});

// A. Handle "Send Code" Click
document.getElementById('sendOtpBtn').addEventListener('click', async function() {
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const btn = this;

    // Basic check
    if (!email || !email.includes('@ue.edu.ph')) {
        alert("Please enter a valid UE email first.");
        return;
    }

    btn.innerText = "Sending...";
    btn.disabled = true;

    try {
        const response = await fetch('/api/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            alert("Code sent! Check your email.");
            document.getElementById('otpGroup').style.display = 'block'; // Show OTP box
            btn.innerText = "Resend";
            setTimeout(() => btn.disabled = false, 30000); // Cooldown 30s
        } else {
            alert(data.message);
            btn.innerText = "Send Code";
            btn.disabled = false;
        }
    } catch (error) {
        console.error("OTP Error:", error);
        btn.innerText = "Send Code";
        btn.disabled = false;
    }
});

// B. Handle Form Submit (Registration)
document.getElementById('RegisterForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (regAttempts >= MAX_ATTEMPTS) {
        alert("Too many failed attempts. Please wait 15 minutes.");
        return;
    }
    // Validate custom CAPTCHA (case-insensitive)
    const captchaInput = document.getElementById('captchaInput').value.trim().toUpperCase();
    const generatedCaptcha = window.generatedCaptcha();
    if (captchaInput !== generatedCaptcha) {
        alert("CAPTCHA verification failed. Please try again.");
        window.drawCaptcha();
        return;
    }

    const role = document.getElementById('regRole').value; // Get the selected role
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const otp = document.getElementById('regOtp').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    if (!otp) {
        alert("Please enter the verification code sent to your email.");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    const submitBtn = document.querySelector('.register-btn');
    submitBtn.innerText = "Verifying...";
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Include 'usertype' in the body
            body: JSON.stringify({ 
                name, 
                email, 
                password, 
                otp, 
                usertype: role
            }) 
        });

        const data = await response.json();

        if (response.ok) {
            alert("Registration Successful! Please log in.");
            window.location.href = "/Login/Login.html";
        } else {
            regAttempts++;
            alert(data.message);
            submitBtn.innerText = "Sign Up";
            submitBtn.disabled = false;
            window.drawCaptcha(); // Reset CAPTCHA on error
            if (regAttempts >= MAX_ATTEMPTS) {
                const submitBtn = document.querySelector('.register-btn');
                submitBtn.disabled = true;
                submitBtn.innerText = "Blocked (Too many attempts)";
            }
        }

    } catch (error) {
        alert("Server error.");
        regAttempts++;
        submitBtn.innerText = "Sign Up";
        submitBtn.disabled = false;
        window.drawCaptcha(); // Reset CAPTCHA on error
    }
});
function checkRegBlock() {
    const blockExpiry = localStorage.getItem('regBlockExpiry');
    if (blockExpiry && Date.now() < blockExpiry) {
        startRegTimer(Math.ceil((blockExpiry - Date.now()) / 1000));
    }
}

function startRegTimer(seconds) {
    const btn = document.querySelector('.register-btn');
    btn.disabled = true;
    
    const interval = setInterval(() => {
        const remaining = Math.ceil((localStorage.getItem('regBlockExpiry') - Date.now()) / 1000);
        if (remaining <= 0) {
            clearInterval(interval);
            btn.disabled = false;
            btn.innerText = "Sign Up";
            localStorage.removeItem('regBlockExpiry');
            localStorage.setItem('regAttempts', 0);
            regAttempts = 0;
        } else {
            btn.innerText = `Blocked (${remaining}s)`;
        }
    }, 1000);
}

// In your form submit listener's failure block:
if (response.status === 429 || regAttempts >= MAX_ATTEMPTS) {
    const expiry = Date.now() + (15 * 60 * 1000); // 15 mins
    localStorage.setItem('regBlockExpiry', expiry);
    startRegTimer(15 * 60);
}