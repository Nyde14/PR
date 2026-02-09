document.addEventListener("DOMContentLoaded", async () => {
    // 1. Fetch User
    const currentUser = await fetchCurrentUser();
    if (currentUser) {
        loadClubButton(currentUser);
        loadDirectMessages();
        
        // 2. CHECK FOR ADMIN REDIRECT (Preserved from your file)
        await handleAdminRedirect(currentUser.name);
    }

    // Search Filter
    const searchInput = document.getElementById('UserSearchInput');
    if (searchInput) searchInput.addEventListener('keyup', filterContacts);
    
    // Auto-Refresh List
    setInterval(loadDirectMessages, 5000);
});

// --- HELPER: SMART AVATAR URL (New) ---
// Uses the uploaded picture, or generates initials if missing
function getAvatarUrl(name, path) {
    if (path && path !== "undefined" && path !== "null" && path.trim() !== "") {
        return path;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;
}

// --- USER INFO ---
let currentUserData = null;

async function fetchCurrentUser() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error("Not logged in");
        currentUserData = await res.json();
        if(document.getElementById('Name')) document.getElementById('Name').innerText = currentUserData.name;
        return currentUserData;
    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// 1. INBOX LISTS
// ==========================================


async function loadClubButton(user) {
    const container = document.getElementById('ClubGroupContainer');
    if (!container) return;

    if (user.club && user.club !== 'none' && user.club !== 'Pending') {
        let logoUrl = null;
        let unreadCount = 0;

        try {
            // Parallel Fetch: Club Info AND Unread Count
            // We assume an endpoint '/api/chat/unread/:room' exists or similar
            const [clubsRes, unreadRes] = await Promise.all([
                fetch('/api/clubs'),
                fetch(`/api/chat/unread/${encodeURIComponent(user.club)}`) 
            ]);

            if (clubsRes.ok) {
                const clubs = await clubsRes.json();
                const myClub = clubs.find(c => c.clubname === user.club);
                if (myClub) {
                    logoUrl = (myClub.branding && myClub.branding.logo) ? myClub.branding.logo : myClub.logo;
                }
            }

            if (unreadRes.ok) {
                const unreadData = await unreadRes.json();
                unreadCount = unreadData.count || 0; // Expect { count: 5 }
            }

        } catch (e) {
            console.error("Error loading club data:", e);
        }

        const finalLogo = getAvatarUrl(user.club, logoUrl);
        
        // Render Badge only if count > 0
        const badgeHTML = unreadCount > 0 
            ? `<span id="badge-group-${user.club}" class="unread-badge">${unreadCount}</span>` 
            : '';

        container.innerHTML = `
            <div class="inbox-item club-item" onclick="openChat('${user.club}', 'group', null, 'badge-group-${user.club}')">
                <img src="${finalLogo}" class="avatar club-avatar" alt="Club Logo">
                <div class="info">
                    <span class="name">${user.club}</span>
                    <span class="subtext">Tap to open Group Chat</span>
                </div>
                ${badgeHTML}
                <i class='bx bx-chevron-right' style="color:#ccc; font-size:1.5rem; margin-left:${unreadCount > 0 ? '10px' : 'auto'};"></i>
            </div>
        `;
    } else {
        // ... (Keep existing "No Club" Empty State) ...
        container.innerHTML = `<div class="empty-state-card">...</div>`;
    }
}

// ==========================================
// 2. UPDATED: LOAD DIRECT MESSAGES (With Badge)
// ==========================================
async function loadDirectMessages() {
    const list = document.getElementById('DirectMessagesList');
    if (!list) return;

    try {
        const res = await fetch('/api/chat/conversations');
        const conversations = await res.json();

        if (conversations.length === 0) {
            list.innerHTML = `<p class="empty-text">No private messages yet.</p>`;
            return;
        }

        list.innerHTML = conversations.map(chat => {
            const avatarUrl = getAvatarUrl(chat.name, chat.avatar);
            
            // CHECK UNREAD COUNT (Assumes backend sends 'unread' or 'unreadCount')
            const unread = chat.unread || chat.unreadCount || 0;
            const badgeHTML = unread > 0 
                ? `<span id="badge-dm-${chat.name}" class="unread-badge">${unread}</span>` 
                : '';

            return `
            <div class="inbox-item" onclick="openChat('${chat.name}', 'private', null, 'badge-dm-${chat.name}')">
                <img src="${avatarUrl}" class="avatar user-avatar" alt="${chat.name}">
                <div class="info">
                    <span class="name">${chat.name}</span>
                    <span class="subtext" style="${unread > 0 ? 'font-weight:bold; color:#333;' : ''}">
                        ${chat.lastMessage || 'Start a conversation'}
                    </span>
                </div>
                ${badgeHTML}
            </div>
            `;
        }).join('');
    } catch (e) {
        console.error("Inbox Error:", e);
    }
}

// ==========================================
// 3. UPDATED: OPEN CHAT (Reset Badge Logic)
// ==========================================
// Added 'badgeId' parameter to target the specific badge
function openChat(name, type, msgId = null, badgeId = null) {
    
    // 1. VISUAL RESET: Hide the badge immediately
    if (badgeId) {
        const badge = document.getElementById(badgeId);
        if (badge) {
            badge.style.display = 'none'; // Instant feedback
        }
    }

    // 2. REDIRECT
    let url = `/ClubChat/ClubChat.html?room=${encodeURIComponent(name)}&type=${type}`;
    if (msgId) {
        url += `&msgId=${msgId}`;
    }
    
    // 3. Optional: Mark as read via API before leaving (improves sync)
    // fetch(`/api/chat/mark-read/${encodeURIComponent(name)}`, { method: 'PUT' });

    window.location.href = url;
}

// --- ADMIN AUTO-REDIRECTER (Preserved) ---
async function handleAdminRedirect(myUserName) {
    const urlParams = new URLSearchParams(window.location.search);
    const reportMsgId = urlParams.get('msgId');

    if (reportMsgId) {
        console.log("Admin viewing reported message:", reportMsgId);
        try {
            // Logic to handle highlighting or finding the specific conversation
            // (Kept simple as per your previous file logic)
             alert("Please find the conversation containing the reported message.");
        } catch (e) {
            console.error(e);
        }
    }
}

// ==========================================
// 3. MODAL & CONTACTS
// ==========================================

function openUserList() {
    document.getElementById('UserListModal').style.display = 'block';
    loadContacts();
}

function closeUserList() {
    document.getElementById('UserListModal').style.display = 'none';
}

async function loadContacts() {
    const list = document.getElementById('AvailableUsersList');
    list.innerHTML = "Loading...";
    try {
        const res = await fetch('/api/users/contacts'); 
        const users = await res.json();
        window.allContacts = users;
        renderContacts(users);
    } catch (e) { list.innerHTML = "Failed to load users."; }
}

function renderContacts(users) {
    const list = document.getElementById('AvailableUsersList');
    if (!users || users.length === 0) return list.innerHTML = "<p>No users found.</p>";
    
    list.innerHTML = users.map(u => {
        // Generate Avatar for Contact List
        const avatarUrl = getAvatarUrl(u.name, u.profilePicture);
        
        return `
        <div class="contact-item" onclick="openChat('${u.name}', 'private')">
            <img src="${avatarUrl}" style="width:35px; height:35px; border-radius:50%; margin-right:10px; object-fit:cover;">
            <span>${u.name}</span>
            <button>Message</button>
        </div>
        `;
    }).join('');
}

function filterContacts() {
    const term = document.getElementById('UserSearchInput').value.toLowerCase();
    const filtered = window.allContacts.filter(u => u.name.toLowerCase().includes(term));
    renderContacts(filtered);
}
