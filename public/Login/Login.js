document.addEventListener('DOMContentLoaded', function() {
    
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

            // --- FIX: DEFINE THE VARIABLE HERE ---
            const msgBox = document.getElementById('LoginMessage'); 
            const btn = document.getElementById('loginbtn');
            
            // 1. Clear previous errors & Disable button
            msgBox.style.display = 'none';
            msgBox.innerText = "";
            
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "Logging in...";

            const email = document.getElementById('EmailInput').value;
            const password = document.getElementById('password').value;

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
                    // SUCCESS
                    localStorage.setItem('token', data.token);
                    
                    msgBox.style.color = "#155724"; 
                    msgBox.style.backgroundColor = "#d4edda";
                    msgBox.style.borderColor = "#c3e6cb";
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
    const email = document.getElementById('ForgotEmail').value;
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
            alert("Password Reset Successful! You can now log in.");
            closeModal();
        } else {
            msgBox.innerText = data.message;
            msgBox.style.color = "red";
        }
    } catch (err) {
        msgBox.innerText = "Error resetting password.";
    }
};