// A. Handle "Send Code" Click
document.getElementById('sendOtpBtn').addEventListener('click', async function() {
    const email = document.getElementById('regEmail').value.trim();
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
            alert(data.message);
            submitBtn.innerText = "Sign Up";
            submitBtn.disabled = false;
        }
    } catch (error) {
        alert("Server error.");
        submitBtn.innerText = "Sign Up";
        submitBtn.disabled = false;
    }
});
