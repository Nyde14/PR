let allClubs = []; // Store clubs globally for filtering
let activeSort = 'az';
let activeTags = new Set()
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Check Auth
    const authRes = await fetch('/api/auth/me');
    if (!authRes.ok) {
        window.location.href = "/Login/Login.html";
        return;
    }

    // 2. Load Clubs
    loadClubs();
    loadRecommendations();
});

async function loadClubs() {
    const container = document.getElementById('ClubsGrid');
    
    try {
        const response = await fetch('/api/clubs'); // Fetches ALL clubs
        allClubs = await response.json(); // Store in global variable

        renderClubs(allClubs); // Render initial list

    } catch (error) {
        console.error("Error:", error);
        container.innerHTML = "<p>Error loading clubs.</p>";
    }
}

function renderClubs(clubs) {
    const container = document.getElementById('ClubsGrid');
    container.innerHTML = "";

    if (!clubs || clubs.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding:40px; color:#888;">
                <p>No clubs found matching your search.</p>
            </div>
        `;
        return;
    }

    clubs.forEach(club => {
        // Fallback for missing images
        const logo = (club.branding && club.branding.logo) ? club.branding.logo : '/uploads/default_pfp.png';
        const banner = (club.branding && club.branding.banner) ? `url('${club.branding.banner}')` : '#fa3737';
        
        // Handle Banner: It can be a URL or a Color
        const bannerStyle = banner.startsWith('url') ? `background-image: ${banner};` : `background-color: ${banner};`;
        
        // Handle category - could be string or array, default to Organization
        let categoryDisplay = 'Organization';
        if (club.category) {
            if (typeof club.category === 'string' && club.category.trim() !== '') {
                categoryDisplay = club.category;
            } else if (Array.isArray(club.category) && club.category.length > 0) {
                categoryDisplay = club.category[0];
            }
        }

        const card = document.createElement('div');
        card.className = 'club-card';
        card.onclick = () => window.location.href = `/ClubProfile/ClubProfile.html?slug=${club.urlSlug}`;
        
        card.innerHTML = `
            <div class="card-banner" style="${bannerStyle}"></div>
            <div class="card-logo" style="background-image: url('${logo}');"></div>
            
            <div class="card-name">${club.clubname}</div>
            <div class="card-category">${categoryDisplay}</div>
            
            <div class="card-actions">
                <span class="visit-btn" style="background:#fa3737; color:white;">View Club</span>
            </div>
        `;
        container.appendChild(card);
    });
}

function filterClubs() {
    const term = document.getElementById('ClubSearchInput').value.toLowerCase();
    
    // Filter the global array based on Name or Category
    const filtered = allClubs.filter(club => {
        const clubNameMatch = club.clubname.toLowerCase().includes(term);
        
        let categoryMatch = false;
        if (club.category) {
            if (typeof club.category === 'string') {
                categoryMatch = club.category.toLowerCase().includes(term);
            } else if (Array.isArray(club.category)) {
                categoryMatch = club.category.some(c => c.toLowerCase().includes(term));
            }
        }
        
        return clubNameMatch || categoryMatch;
    });

    renderClubs(filtered);
}
async function loadRecommendations() {
    const container = document.getElementById('RecommendationList');
    if (!container) return;

    try {
        const response = await fetch('/api/posts/recommendations');
        const data = await response.json();

        if (data.length === 0) {
            container.innerHTML = "<p>No recommendations yet.</p>";
            return;
        }

        container.innerHTML = data.map(item => {
    const club = item.club;
    const post = item.post;
    const logoPath = (club.logo && !club.logo.startsWith('/')) ? '/' + club.logo : club.logo;
    
    // --- 1. POST CONTENT LOGIC ---
    let postContentHTML = `<div style="font-size:0.8rem; color:#999; margin-top:5px;">No recent updates.</div>`;
    let mediaHTML = "";

    if (post) {
        // A. Handle Media (Image or Video)
        if (post.mediaUrl) {
            if (post.mediaType === 'image') {
                mediaHTML = `<div class="mini-media-thumb" style="background-image: url('${post.mediaUrl}');"></div>`;
            } else if (post.mediaType === 'video') {
                mediaHTML = `
                    <div class="mini-video-placeholder">
                        <span>▶ Video Attached</span>
                    </div>`;
            }
        }

        // B. Handle Text Snippet
        const cleanContent = post.content ? post.content.replace(/<[^>]*>?/gm, '') : "";
        if (cleanContent) {
            postContentHTML = `
                <div class="mini-post-snippet">
                    "${cleanContent}"
                </div>
            `;
        } else if (mediaHTML) {
            // If there's media but no text, show a different label
            postContentHTML = `<div style="font-size:0.8rem; color:#666; margin-top:5px;">Posted an update:</div>`;
        }
    }

    // --- 2. RENDER CARD ---
    return `
    <div class="mini-club-card" onclick="window.location.href='/ClubProfile/ClubProfile.html?slug=${club.slug}'">
        <div class="mini-header">
            <img src="${logoPath}" class="mini-logo" onerror="this.src='/uploads/default_pfp.png'">
            <div class="mini-info">
                <h4>${club.name}</h4>
                <span class="mini-members">${club.memberCount} Members</span>
            </div>
        </div>
        
        ${postContentHTML}
        ${mediaHTML} </div>
    `;
}).join('');

    } catch (error) {
        console.error("Recs Error:", error);
        container.innerHTML = "<p style='color:red; font-size:0.8rem;'>Failed to load.</p>";
    }
}
function openFilterModal() {
    document.getElementById('FilterModal').style.display = 'block';
}

function closeFilterModal() {
    document.getElementById('FilterModal').style.display = 'none';
}

// Close modal if clicked outside
window.onclick = function(event) {
    const modal = document.getElementById('FilterModal');
    if (event.target == modal) {
        closeFilterModal();
    }
}

function toggleTag(btn, tagName) {
    if (activeTags.has(tagName)) {
        activeTags.delete(tagName);
        btn.classList.remove('selected');
    } else {
        activeTags.add(tagName);
        btn.classList.add('selected');
    }
}

function clearFilters() {
    // Reset Tags
    activeTags.clear();
    document.querySelectorAll('.filter-tag').forEach(btn => btn.classList.remove('selected'));
    
    // Reset Sort to A-Z
    document.querySelector('input[name="sortOrder"][value="az"]').checked = true;
    activeSort = 'az';

    // Reload
    applyFilters();
}

function applyFilters() {
    // 1. Get current sort and search values
    const sortRadios = document.getElementsByName('sortOrder');
    for (const radio of sortRadios) {
        if (radio.checked) {
            activeSort = radio.value;
            break;
        }
    }
    const searchTerm = document.getElementById('ClubSearchInput').value.toLowerCase();

    // 2. Filter logic
    let filtered = allClubs.filter(club => {
        const matchesSearch = club.clubname.toLowerCase().includes(searchTerm);
        
        // Filter by category (handle both string and array)
        let matchesTags = activeTags.size === 0;
        if (activeTags.size > 0 && club.category) {
            if (typeof club.category === 'string') {
                matchesTags = activeTags.has(club.category);
            } else if (Array.isArray(club.category)) {
                matchesTags = club.category.some(t => activeTags.has(t));
            }
        }
            
        return matchesSearch && matchesTags;
    });

    // 3. Sorting logic using memberCount
    filtered.sort((a, b) => {
        const nameA = a.clubname.toLowerCase();
        const nameB = b.clubname.toLowerCase();
        const membersA = a.memberCount || 0; // CamelCase match
        const membersB = b.memberCount || 0;

        switch (activeSort) {
            case 'az': return nameA.localeCompare(nameB);
            case 'za': return nameB.localeCompare(nameA);
            case 'members_high': return membersB - membersA;
            case 'members_low': return membersA - membersB;
            default: return 0;
        }
    });

    renderClubs(filtered);
    
    // Close modal if it exists on the page
    const modal = document.getElementById('FilterModal');
    if (modal) modal.style.display = 'none';
}

// Override the old filterClubs function so the search bar uses the new pipeline
function filterClubs() {
    applyFilters(); 
}