document.getElementById("login-form").addEventListener('submit', async(e)=>{
    e.preventDefault();
    const email = document.getElementById("EmailInput").value
    const password = document.getElementById("password").value

    try{
        const response = await fetch('/api/auth/login',{
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok){
            localStorage.setItem('token', data.token);
           window.location.href = '/dashboard.html';
        } else {
          console.error(data.message);
          alert(data.message);
        }
      } catch (error) {
         console.error("log in failed please try again", error)
         alert("Login failed — check console for details");
    }
})