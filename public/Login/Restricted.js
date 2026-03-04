document.addEventListener("DOMContentLoaded", () => {
    // 1. Get data from URL (e.g., ?reason=Spamming&date=2025-12-01)
    const params = new URLSearchParams(window.location.search);
    
    const reason = params.get('reason');
    const date = params.get('date');

    // 2. Update UI
    if (reason) {
        document.getElementById('ReasonText').innerText = decodeURIComponent(reason);
    }
    
    if (date) {
        if (date === "Indefinite" || date === "undefined") {
            document.getElementById('DateText').innerText = "Indefinite / Permanent";
        } else {
            // Format date nicely (e.g., "Monday, October 25, 2025")
            const dateObj = new Date(date);
            document.getElementById('DateText').innerText = dateObj.toLocaleDateString(undefined, {
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric'
            });
        }
    }
});
// Global.js - ADD TO VERY TOP
(function deterConsoleSnoopers() {
    // 1. Print a massive warning
    console.log("%cSTOP!", "color: red; font-size: 50px; font-weight: bold; text-shadow: 2px 2px 0px black;");
    console.log("%cThis is a browser feature intended for developers. If someone told you to copy-paste something here to enable a feature or 'hack' an account, it is a scam and will give them access to your account.", "font-size: 18px; color: #333;");
    
    // 2. Optional: Clear the console immediately if they aren't quick enough
    // setInterval(() => console.clear(), 2000); 
})();(function(){
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
