document.addEventListener("DOMContentLoaded", async () => {
    // 1. Check Auth
    const authRes = await fetch('/api/auth/me');
    if (!authRes.ok) {
        window.location.href = "/Login/Login.html";
        return;
    }

    // 2. Load Clubs
    loadFollowedClubs();
});

async function loadFollowedClubs() {
    const container = document.getElementById('ClubsGrid');
    
    try {
        const response = await fetch('/api/users/followed-clubs');
        const clubs = await response.json();

        container.innerHTML = "";

        if (!clubs || clubs.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding:40px; color:#888;">
                    <span style="font-size:3rem;">🌟</span>
                    <p>You aren't following any clubs yet.</p>
                    <a href="../ApplyClub/Clublist.html" style="color:#fa3737; font-weight:bold;">Explore Clubs</a>
                </div>
            `;
            return;
        }

        clubs.forEach(club => {
            const logo = (club.branding && club.branding.logo) ? club.branding.logo : '../assets/default_logo.png';
            const banner = (club.branding && club.branding.banner) ? `url('${club.branding.banner}')` : '#fa3737';
            const bannerStyle = banner.startsWith('url') ? `background-image: ${banner};` : `background-color: ${banner};`;

            const card = document.createElement('div');
            card.className = 'club-card';
            card.id = `club-${club._id}`;
            
            card.innerHTML = `
                <div class="card-banner" style="${bannerStyle}"></div>
                <div class="card-logo" style="background-image: url('${logo}');"></div>
                
                <div class="card-name">${club.clubname}</div>
                <div class="card-category">${club.category || 'Club'}</div>
                
                <div class="card-actions">
                    <a href="/ClubProfile/ClubProfile.html?slug=${club.urlSlug}" class="visit-btn">Visit</a>
                    <button onclick="unfollowClub('${club.clubname}', '${club._id}')" class="unfollow-btn">Unfollow</button>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Error:", error);
        container.innerHTML = "<p>Error loading clubs.</p>";
    }
}

async function unfollowClub(clubName, cardId) {
    if (!confirm(`Unfollow ${clubName}?`)) return;

    try {
        const res = await fetch(`/api/users/unfollow/${encodeURIComponent(clubName)}`, { method: 'PUT' });
        
        if (res.ok) {
            // Remove from UI immediately
            const card = document.getElementById(`club-${cardId}`);
            card.style.opacity = '0';
            setTimeout(() => {
                card.remove();
                // Reload if empty
                if (document.getElementById('ClubsGrid').children.length === 0) {
                    loadFollowedClubs();
                }
            }, 300);
        } else {
            alert("Failed to unfollow.");
        }
    } catch (e) {
        console.error(e);
        alert("Network error.");
    }
}   