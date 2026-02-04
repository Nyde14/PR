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

        try {
            // 1. Fetch all clubs to find the matching logo
            // (Since user object doesn't have the logo, we grab it here)
            const res = await fetch('/api/clubs'); 
            if (res.ok) {
                const clubs = await res.json();
                const myClub = clubs.find(c => c.clubname === user.club);
                
                // Get the logo from branding OR main logo field
                if (myClub) {
                    logoUrl = (myClub.branding && myClub.branding.logo) 
                        ? myClub.branding.logo 
                        : myClub.logo;
                }
            }
        } catch (e) {
            console.error("Error fetching club logo:", e);
        }

        // 2. Use the Real Logo (or Fallback if fetch failed)
        const finalLogo = getAvatarUrl(user.club, logoUrl);

        // 3. Render
        container.innerHTML = `
            <div class="inbox-item club-item" onclick="openChat('${user.club}', 'group')">
                <img src="${finalLogo}" class="avatar club-avatar" alt="Club Logo">
                <div class="info">
                    <span class="name">${user.club}</span>
                    <span class="subtext">Tap to open Group Chat</span>
                </div>
                <i class='bx bx-chevron-right' style="color:#ccc; font-size:1.5rem;"></i>
            </div>
        `;
    } else {
        // NO CLUB STATE (Welcome Card)
        container.innerHTML = `
            <div class="empty-state-card">
                <div class="empty-icon"><i class='bx bx-shield-x'></i></div>
                <h4>You haven't joined a club yet</h4>
                <p>Join a club to unlock their exclusive Group Chat.</p>
                <a href="/ApplyClub/Clublist.html" class="inbox-action-btn">
                    Find a Club <i class='bx bx-search'></i>
                </a>
            </div>
        `;
    }
}

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
            // Generate Avatar for Chat Partner
            const avatarUrl = getAvatarUrl(chat.name, chat.avatar);

            return `
            <div class="inbox-item" onclick="openChat('${chat.name}', 'private')">
                <img src="${avatarUrl}" class="avatar user-avatar" alt="${chat.name}">
                <div class="info">
                    <span class="name">${chat.name}</span>
                    <span class="subtext">${chat.lastMessage || 'Start a conversation'}</span>
                </div>
                <span class="date">${chat.timestamp ? new Date(chat.timestamp).toLocaleDateString() : ''}</span>
            </div>
            `;
        }).join('');
    } catch (e) {
        console.error("Inbox Error:", e);
    }
}

// ==========================================
// 2. REDIRECT LOGIC
// ==========================================

function openChat(name, type, msgId = null) {
    let url = `/ClubChat/ClubChat.html?room=${encodeURIComponent(name)}&type=${type}`;
    // Pass the message ID along so it highlights on the next page
    if (msgId) {
        url += `&msgId=${msgId}`;
    }
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
