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