// AdminClubList.js - Full Integrated Reference

let allClubs = [];

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // 1. Check Auth & Admin Status
        const response = await fetch('/api/auth/me');
        
        if (!response.ok) {
            console.error("Auth check failed with status:", response.status);
            window.location.href = "/Login/Login.html";
            return;
        }
        
        const user = await response.json();
        console.log("User loaded:", user.name, "Type:", user.usertype);

        // 2. Verify Admin Status
        if (!user || user.usertype !== 'Admin') {
            console.error("User is not admin or user data missing");
            window.location.href = "/ClubPortalFeed/ClubPortalFeed.html";
            return;
        }

        // 3. Set user info in header
        const nameElement = document.getElementById('Name');
        if (nameElement) {
            nameElement.innerText = user.name;
            console.log("Set user name to:", user.name);
        } else {
            console.warn("Name element not found in DOM");
        }

        // 4. Load clubs
        loadClubsList();

    } catch (error) {
        console.error("Admin Auth Error:", error);
        window.location.href = "/Login/Login.html";
    }
});

async function loadClubsList() {
    const grid = document.getElementById('ClubsGrid');
    const emptyState = document.getElementById('EmptyState');
    
    try {
        const res = await fetch('/api/clubs');
        if (!res.ok) throw new Error("Failed to fetch clubs");
        
        allClubs = await res.json();
        console.log("Loaded clubs:", allClubs.length);

        if (allClubs.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        grid.style.display = 'grid';

        // THE FIX: Correctly map data while preserving all reference logic
        grid.innerHTML = allClubs.map(club => {
            const logo = (club.branding && club.branding.logo) 
                ? club.branding.logo 
                : (club.logo || '/uploads/default_pfp.png');
            
            const banner = (club.branding && club.branding.banner)
                ? club.branding.banner
                : '/uploads/default_banner.jpg';
            
            const memberCount = club.memberCount || 0;
            
            // Reference logic for category handling
            const categoryText = club.category || 'Organization';
            
            return `
            <div class="club-card" onclick="openClubDashboard('${club.urlSlug}')">
                <div class="club-card-banner">
                    <img src="${banner}" alt="${club.clubname} banner" onerror="this.src='/uploads/default_banner.jpg'">
                    <img class="club-card-logo" src="${logo}" alt="${club.clubname} logo" onerror="this.src='/uploads/default_pfp.png'">
                </div>
                <div class="club-card-content">
                    <div class="club-card-name">${club.clubname}</div>
                    <div class="club-card-adviser">
                         ${club.adviser || 'Unassigned'}
                    </div>
                    <div class="club-card-category">
                        ${escapeHtml(displayCategoryText(categoryText))}
                    </div>
                    <div class="club-card-stats">
                        <div class="club-card-stat">
                            <div class="club-card-stat-number">${memberCount}</div>
                            <div class="club-card-stat-label">Members</div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (error) {
        console.error("Failed to load clubs:", error);
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: red;">
            Error loading clubs: ${error.message}
        </div>`;
    }
}

function openClubDashboard(slugName) {
    // Redirect with slug parameter
    window.location.href = `/AdminDashboard/AdminClubAdviserDashboard.html?slug=${encodeURIComponent(slugName)}`;
}

function displayCategoryText(category) {
    if (!category) return 'Organization';
    if (Array.isArray(category)) {
        return category.join(', ');
    }
    return category;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}