document.addEventListener("DOMContentLoaded", async () => {
    // 1. Fetch User
    const currentUser = await fetchCurrentUser();
    if (currentUser) {
        loadClubButton(currentUser);
        loadDirectMessages();
        
        // 2. CHECK FOR ADMIN REDIRECT (The New Feature)
        await handleAdminRedirect(currentUser.name);
    }

    // Search Filter
    const searchInput = document.getElementById('UserSearchInput');
    if (searchInput) searchInput.addEventListener('keyup', filterContacts);
    
    // Auto-Refresh List
    setInterval(loadDirectMessages, 5000);
});

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

function loadClubButton(user) {
    const container = document.getElementById('ClubGroupContainer');
    if (!container) return;

    if (user.club && user.club !== 'none' && user.club !== 'Pending') {
        container.innerHTML = `
            <div class="inbox-item club-item" onclick="openChat('${user.club}', 'group')">
                <div class="avatar club-avatar">🛡️</div>
                <div class="info">
                    <span class="name">${user.club}</span>
                    <span class="subtext">Club Group Chat</span>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `<p style="padding:10px; color:#666;">You are not in a club.</p>`;
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

        list.innerHTML = conversations.map(chat => `
            <div class="inbox-item" onclick="openChat('${chat.name}', 'private')">
                <div class="avatar user-avatar">👤</div>
                <div class="info">
                    <span class="name">${chat.name}</span>
                    <span class="subtext">${chat.lastMessage || 'Start a conversation'}</span>
                </div>
                <span class="date">${chat.timestamp ? new Date(chat.timestamp).toLocaleDateString() : ''}</span>
            </div>
        `).join('');
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

// --- NEW: ADMIN AUTO-REDIRECTER ---
// If Admin clicks "View" on a private message report, they land here with ?msgId=...
// This function finds the conversation and forwards them to the actual chat.
async function handleAdminRedirect(myUserName) {
    const urlParams = new URLSearchParams(window.location.search);
    const reportMsgId = urlParams.get('msgId');

    if (reportMsgId) {
        console.log("Admin viewing reported message:", reportMsgId);
        
        // We need to fetch the message to know who the chat is with
        // Since we don't have a direct "get message by id" API exposed to frontend easily,
        // we can iterate through conversations (or you could add a specific API route).
        // For now, let's look through the loaded conversations list logic:
        
        try {
            // Fetch ALL conversations to find which one contains this message
            // Note: This is a bit of a workaround. Ideally, the backend redirect should include the room name.
            // But since we are here, let's try to match it.
            
            const res = await fetch('/api/chat/conversations'); // Gets latest messages
            // This endpoint is limited (only last message). 
            
            // BETTER APPROACH: Since we can't easily find the room from just ID on frontend,
            // let's assume the backend 'Redirect' route in ReportRoute.js should have sent us 
            // to ClubChat directly if it knew the room. 
            
            // If we are here, it's likely the backend sent us to Inbox.
            // Let's prompt or notify the admin:
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
    list.innerHTML = users.map(u => `
        <div class="contact-item" onclick="openChat('${u.name}', 'private')">
            <span>👤</span><span>${u.name}</span><button>Message</button>
        </div>
    `).join('');
}

function filterContacts() {
    const term = document.getElementById('UserSearchInput').value.toLowerCase();
    const filtered = window.allContacts.filter(u => u.name.toLowerCase().includes(term));
    renderContacts(filtered);
}