
let UEemails =["TestAdmin@ue.edu.ph", "TestEmail@ue.edu.ph"];//temporary examples for testing
let UEpassword = ["pass", "pass1"]


//checks if email is correct
document.getElementById("loginbtn").onclick = function() {
    
    let Email = document.getElementById("EmailInput");
let password = document.getElementById("password");

    console.log(UEpassword[UEemails.indexOf(Email.value)])
    console.log("button is working");
    
    
    if (Email.value === UEemails[UEemails.indexOf(Email.value)] && password.value === UEpassword[UEemails.indexOf(Email.value)]){ 
        window.location.href = '/ClubPortalFeed/ClubPortalFeed.html'; // Redirect to Club Portal Feed page
    }
    else{
        alert("Incorrect UE Gmail or Password. Please try again.");
    }
    

}