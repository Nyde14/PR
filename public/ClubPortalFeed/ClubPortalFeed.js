document.addEventListener("DOMContentLoaded", async () => {
    // 1. Global Header Logic (User Status)
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error('Not logged in');
        const user = await res.json();

        // Update Name in Header
        const nameEl = document.getElementById('Name');
        if (nameEl && user.name) {
            nameEl.innerHTML = `<a href="/Profile/${user._id}" style="color:white; text-decoration:none;">${user.name}</a>`;
        }

        // Hide "No Club" / "Explore" if user is in a club or pending
        const clubs = user.clubs || [];
        const inClub = clubs.length > 0 || (user.club && user.club !== 'none');
        
        if (inClub || user.club === 'Pending') {
            const noClubCard = document.getElementById('NoClubState');
            if (noClubCard) noClubCard.style.display = 'none';
        }

    } catch (e) {
        console.error('Auth Check Failed:', e);
    }

    // 2. Load the Feed
    loadFeed();
});

// ==========================================
// MAIN FEED LOGIC
// ==========================================

async function loadFeed() {
    const container = document.getElementById('FeedContainer');
    
    try {
        // STEP 1: Get the REAL User (Source of Truth)
        let currentUser = null; // Changed from just 'currentUserName' string
        try {
            const authRes = await fetch('/api/auth/me');
            if (authRes.ok) {
                currentUser = await authRes.json(); // Store full object ({name, usertype, club...})
            }
        } catch (err) {
            console.warn("Could not fetch user info");
        }

        // STEP 2: Fetch Posts
        const response = await fetch('/api/posts/feed');
        const posts = await response.json();

        container.innerHTML = "";

        if (!posts || posts.length === 0) {
            container.innerHTML = "<p style='text-align:center; margin-top:20px; color:#666;'>No announcements yet.</p>";
            return;
        }

        // STEP 3: Create Cards (Passing the FULL user object now)
        posts.forEach(post => {
            container.appendChild(createPostCard(post, currentUser));
        });

    } catch (error) {
        console.error("Error loading feed:", error);
        container.innerHTML = "<p>Error loading posts.</p>";
    }
}

// ==========================================
/// --- UPDATED CARD GENERATOR (Share Button at Bottom) ---
function createPostCard(post, currentUser) {
    const currentUserName = currentUser ? currentUser.name : "";
    const isAdmin = currentUser && currentUser.usertype === 'Admin';
    const date = new Date(post.timestamp).toLocaleDateString();

    // Fallbacks
    const logoUrl = post.clubLogo || '/uploads/default_pfp.png';
    const fallbackImage = '/uploads/default_pfp.png';

    const profileLink = post.clubSlug ? `/ClubProfile/ClubProfile.html?slug=${post.clubSlug}` : '#';
    const isLiked = post.isLiked;
    
    // ICON LOGIC: Filled Heart if liked, Outline if not
    const heartIconClass = isLiked ? "bx bxs-heart" : "bx bx-heart"; 
    const heartColor = isLiked ? "#fa3737" : "currentColor"; 
    
    const comments = post.comments || [];
    const postLink = `${window.location.origin}/ClubProfile/ClubProfile.html?slug=${post.clubSlug}&postId=${post._id}`;

    // 1. Generate Comments HTML (Updated Delete Icon)
    const commentsHTML = comments.map(c => {
        const isMyComment = c.author === currentUserName;
        // Trash icon for delete
        const deleteBtn = isMyComment ? 
            `<button class="delete-comment-btn" onclick="deleteComment('${post._id}', '${c._id}')" title="Delete">
                <i class='bx bx-trash'></i>
             </button>` : '';
             
        const replies = c.replies || [];
        const repliesHTML = replies.map(r => `
            <div class="reply-item">
                <span class="comment-author" style="font-size:0.8rem;">${r.author}:</span> ${r.content}
            </div>`).join('');
        
        return `
        <div class="comment-item" id="comment-${c._id}">
            <div class="comment-header">
                <span class="comment-author">${c.author}:</span> 
                <div style="display:flex; align-items:center; gap:5px;">
                    <button class="reply-btn" onclick="toggleReplyInput('${c._id}')">Reply</button>
                    ${deleteBtn}
                </div>
            </div>
            <div class="comment-text">${c.content}</div>
            <div class="replies-list">${repliesHTML}</div>
            <div id="reply-input-${c._id}" class="reply-input-container" style="display:none;">
                <input type="text" class="reply-input" placeholder="Reply..." id="input-reply-${c._id}">
                <button onclick="submitReply('${post._id}', '${c._id}')" class="comment-btn">Post</button>
            </div>
        </div>`;
    }).join('');

    // 2. Action Menu (Updated Icons)
    const actionMenu = `
        <div class="post-menu-container" style="position:absolute; top:10px; right:10px;">
            <button onclick="togglePostMenu('${post._id}')" class="menu-dots-btn" title="More Options">
                <i class='bx bx-dots-vertical-rounded'></i>
            </button>
            <div id="post-menu-${post._id}" class="post-dropdown" style="display:none;">
                <div onclick="hidePost('${post._id}')" class="menu-item">
                    <i class='bx bx-hide'></i> Hide Post
                </div>
                <div onclick="reportContent('Post', '${post._id}')" class="menu-item">
                    <i class='bx bx-flag'></i> Report Post
                </div>
                ${isAdmin ? `
                <div onclick="deletePost('${post._id}')" class="menu-item delete-item">
                    <i class='bx bx-trash'></i> Delete (Admin)
                </div>` : ''}
            </div>
        </div>
    `;

    const card = document.createElement('div');
    card.className = 'post-card';
    card.id = `post-${post._id}`;
    
    // 3. Main Card HTML
    card.innerHTML = `
        <div class="post-header" style="position:relative;">
            <a href="${profileLink}" class="header-left">
                <img src="${logoUrl}" 
                     class="club-avatar" 
                     onerror="this.onerror=null; this.src='${fallbackImage}'" 
                     style="width:40px; height:40px; border-radius:50%; margin-right:10px; object-fit:cover;">
                <div class="header-info">
                    <span class="club-name-link">${post.clubname}</span>
                    <span class="post-date">${date} • ${post.author}</span>
                </div>
            </a>
            ${actionMenu}
        </div>
        
        <h3 class="post-title">${post.title}</h3>
        <div class="post-content">${post.content}</div>
        ${post.mediaUrl ? `<img src="${post.mediaUrl}" class="post-image">` : ""}

        <div class="post-actions">
            <button class="action-btn" onclick="toggleLike('${post._id}', this)">
                <i class='${heartIconClass}' style="color:${heartColor}; font-size:1.3rem;"></i>
                <span class="like-count" style="margin-left:5px;">${post.likesCount}</span>
            </button>
            
            <button class="action-btn" onclick="toggleComments('${post._id}')">
                <i class='bx bx-message-rounded-dots' style="font-size:1.3rem;"></i> 
                <span style="margin-left:5px;">${comments.length}</span>
            </button>
            
            <div style="position:relative;">
                <button class="action-btn" onclick="toggleShareMenu('${post._id}')" title="Share">
                    <i class='bx bx-share-alt' style="font-size:1.3rem;"></i>
                    <span style="margin-left:5px;">Share</span>
                </button>
                <div id="share-menu-${post._id}" class="share-dropdown" style="display:none; position:absolute; bottom:100%; left:0; background:white; border:1px solid #ddd; z-index:100; padding:10px; border-radius:5px; box-shadow:0 2px 10px rgba(0,0,0,0.1); width:150px; margin-bottom:10px;">
                    <div class="share-option" onclick="copyLink('${postLink}')" style="cursor:pointer; display:flex; align-items:center; gap:8px;">
                        <i class='bx bx-link'></i> Copy Link
                    </div>
                </div>
            </div>
        </div>

        <div id="comments-${post._id}" class="comments-section" style="display:none;">
            <div id="list-${post._id}" style="max-height:300px; overflow-y:auto; margin-bottom:10px;">${commentsHTML}</div>
            <div class="comment-input-area">
                <textarea id="input-${post._id}" class="comment-input" rows="1" placeholder="Write a comment..."></textarea>
                <button onclick="submitComment('${post._id}')" class="comment-btn">
                    <i class='bx bx-send'></i>
                </button>
            </div>
        </div>
    `;
    return card;
}

// 2. HELPER: Re-render Comments (Used by Submit/Reply/Delete)
// This avoids code duplication and ensures avatars always show up after updates
function renderCommentsList(postId, comments, currentUserName) {
    const listDiv = document.getElementById(`list-${postId}`);
    if (!listDiv) return;

    listDiv.innerHTML = comments.map(c => {
        const isMyComment = c.author === currentUserName;
        const deleteBtn = isMyComment ? `<button class="delete-comment-btn" onclick="deleteComment('${postId}', '${c._id}')">Delete</button>` : '';
        const avatarSrc = c.userAvatar || '/public/images/default-user.png';
        
        const replies = c.replies || [];
        const repliesHTML = replies.map(r => `
            <div class="reply-item">
                <span class="comment-author" style="font-size:0.8rem;">${r.author}:</span> ${r.content}
            </div>
        `).join('');

        return `
        <div class="comment-item" style="display:flex; align-items:start; margin-bottom:10px;">
            <img src="${avatarSrc}" class="comment-avatar" alt="User">
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between;">
                    <span class="comment-author" style="font-weight:bold;">${c.author}</span>
                    ${deleteBtn}
                </div>
                <div class="comment-text" style="white-space: pre-wrap; margin-top:2px;">${c.content}</div>
                <div class="replies-list" style="${replies.length > 0 ? 'margin-top:5px;' : 'display:none;'}">${repliesHTML}</div>
                
                <div style="margin-top:5px;">
                    <button class="reply-btn" onclick="toggleReplyInput('${c._id}')" style="font-size:0.75rem; color:#666; background:none; border:none; cursor:pointer;">Reply</button>
                    <div id="reply-input-${c._id}" class="reply-input-container" style="display:none; margin-top:5px;">
                        <input type="text" class="reply-input" placeholder="Reply..." id="input-reply-${c._id}" style="padding:5px; border-radius:5px; border:1px solid #ddd;">
                        <button onclick="submitReply('${postId}', '${c._id}')" class="comment-btn" style="padding:5px 10px; margin-left:5px;">Post</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

// 3. Updated Submit Comment
async function submitComment(postId) {
    const input = document.getElementById(`input-${postId}`);
    const content = input.value.trim();
    if (!content) return;
    input.disabled = true;

    try {
        const response = await fetch(`/api/posts/comment/${postId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        const data = await response.json();

        if (data.success) {
            input.value = "";
            const authRes = await fetch('/api/auth/me');
            const authData = await authRes.json();
            const currentUserName = authRes.ok ? authData.name : "";
            
            // USE THE HELPER FUNCTION
            renderCommentsList(postId, data.comments, currentUserName);
        }
    } catch (e) { console.error(e); } finally { input.disabled = false; input.focus(); }
}

// 4. Updated Submit Reply
async function submitReply(postId, commentId) {
    const input = document.getElementById(`input-reply-${commentId}`);
    const content = input.value.trim();
    if (!content) return;
    input.disabled = true;

    try {
        const response = await fetch(`/api/posts/comment/reply/${postId}/${commentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        const data = await response.json();

        if (data.success) {
            const authRes = await fetch('/api/auth/me');
            const authData = await authRes.json();
            const currentUserName = authRes.ok ? authData.name : "";
            
            renderCommentsList(postId, data.comments, currentUserName);
        }
    } catch (e) { console.error(e); } finally { input.disabled = false; }
}

// 5. Updated Delete Comment
async function deleteComment(postId, commentId) {
    if (!confirm("Delete this comment?")) return;
    try {
        const response = await fetch(`/api/posts/comment/${postId}/${commentId}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
            const authRes = await fetch('/api/auth/me');
            const authData = await authRes.json();
            const currentUserName = authRes.ok ? authData.name : "";
            
            renderCommentsList(postId, data.comments, currentUserName);
        }
    } catch (error) { console.error(error); }
}

function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => alert("Link copied to clipboard!"));
    document.querySelectorAll('.share-dropdown').forEach(el => el.style.display = 'none');
}

// --- CHAT SHARE MODAL ---
// ==========================================
// NEW SHARE GUI LOGIC
// ==========================================

// 1. OPEN THE MODAL
function openShareModal(link, title) {
    // Close any existing dropdowns
    document.querySelectorAll('.share-dropdown').forEach(el => el.style.display = 'none');

    // Remove existing modal if any
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    // Create Modal HTML Structure
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    // We store the link/title in data attributes so the tab switcher can access them
    modal.innerHTML = `
        <div class="share-modal" id="ShareModal" data-link="${encodeURIComponent(link)}" data-title="${encodeURIComponent(title)}">
            <div class="share-header">
                <span>Send to...</span>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            
            <div class="share-tabs">
                <div class="share-tab active" onclick="switchShareTab('dm', this)">Direct Message</div>
                <div class="share-tab" onclick="switchShareTab('club', this)">Club Chat</div>
            </div>

            <div id="ShareListContainer" class="share-list-container">
                <div style="text-align:center; padding:20px; color:#888;">Loading...</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);

    // Load Default Tab (Direct Messages)
    loadShareContacts(); 
}

// 2. SWITCH TABS
function switchShareTab(type, tabElement) {
    // Update Tab UI
    const tabs = document.querySelectorAll('.share-tab');
    tabs.forEach(t => t.classList.remove('active'));
    tabElement.classList.add('active');

    const container = document.getElementById('ShareListContainer');
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Loading...</div>';

    // Load Data based on type
    if (type === 'dm') {
        loadShareContacts();
    } else {
        loadShareClubs();
    }
}

// 3. FETCH CONTACTS (Direct Messages)
async function loadShareContacts() {
    try {
        const res = await fetch('/api/users/contacts'); // Gets valid contacts
        const contacts = await res.json();
        renderShareList(contacts, 'dm');
    } catch (e) {
        console.error(e);
        document.getElementById('ShareListContainer').innerHTML = "<p style='text-align:center; color:red;'>Failed to load contacts.</p>";
    }
}

// 4. FETCH CLUBS (Group Chats - Restricted)
// 3. FETCH CONTACTS (Direct Messages) - FIXED
async function loadShareContacts() {
    const container = document.getElementById('ShareListContainer');
    try {
        const res = await fetch('/api/users/contacts');
        
        // 1. Check if the Server actually said "OK"
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || `Server Error: ${res.status}`);
        }

        const contacts = await res.json();

        // 2. Ensure we actually got a list (Array), not an error object
        if (!Array.isArray(contacts)) {
            throw new Error("Received invalid data from server");
        }

        renderShareList(contacts, 'dm');

    } catch (e) {
        console.error("Share Contacts Error:", e);
        // Show the ACTUAL error message on the screen so we know what's wrong
        container.innerHTML = `<p style='text-align:center; color:red; padding:20px;'>Error: ${e.message}</p>`;
    }
}
async function loadShareClubs() {
    try {
        const clubsRes = await fetch('/api/clubs'); 
        const allClubs = await clubsRes.json();

        const authRes = await fetch('/api/auth/me');
        const user = await authRes.json();

        let myClubs = [];

        if (user.usertype === 'Admin') {
            myClubs = allClubs; 
        } else {
            if (user.club && user.club !== 'none' && user.club !== 'Pending') {
                myClubs = allClubs.filter(c => c.clubname === user.club);
            }
        }

        if (myClubs.length === 0) {
            document.getElementById('ShareListContainer').innerHTML = 
                "<p style='text-align:center; padding:20px; color:#666;'>You are not a member of any club chat.</p>";
        } else {
            renderShareList(myClubs, 'club');
        }

    } catch (e) {
        console.error(e);
        document.getElementById('ShareListContainer').innerHTML = "<p style='text-align:center; color:red;'>Failed to load clubs.</p>";
    }
}

// 5. RENDER THE LIST (The Missing Function!)
function renderShareList(items, type) {
    const container = document.getElementById('ShareListContainer');
    const modal = document.getElementById('ShareModal');
    
    const link = decodeURIComponent(modal.dataset.link);
    const title = decodeURIComponent(modal.dataset.title);

    container.innerHTML = "";

    if (items.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding:20px; color:#666;'>No results found.</p>";
        return;
    }

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'share-list-item';

        let name, subtext, icon, clickAction;

        if (type === 'dm') {
            name = item.name;
            subtext = item.usertype || "User";
            icon = "👤";
            clickAction = () => executeShare('private', item.name, link, title);
        } else {
            name = item.clubname;
            subtext = "Group Chat";
            icon = "🛡️";
            clickAction = () => executeShare('group', item.clubname, link, title);
        }

        el.innerHTML = `
            <div class="share-avatar">${icon}</div>
            <div class="share-info">
                <span class="share-name">${name}</span>
                <span class="share-subtext">${subtext}</span>
            </div>
            <button style="margin-left:auto; padding:5px 12px; background:#fa3737; color:white; border:none; border-radius:15px; cursor:pointer;">Send</button>
        `;

        el.onclick = clickAction;
        container.appendChild(el);
    });
}

// 6. EXECUTE THE SHARE (API CALL)
async function executeShare(type, recipientName, link, title) {
    // Confirm Action
    const confirmMsg = type === 'private' ? `Send to ${recipientName}?` : `Share to ${recipientName} Group Chat?`;
    if (!confirm(confirmMsg)) return;

    try {
        const payload = {
            sender: "Me", // Backend handles real sender
            content: `Check out this post: "${title}"\n${link}`
        };

        if (type === 'private') {
            payload.recipient = recipientName;
        } else {
            payload.clubname = recipientName;
        }

        const res = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("Sent successfully!");
            document.querySelector('.modal-overlay').remove(); // Close modal
        } else {
            const err = await res.json();
            alert("Failed: " + (err.message || "Unknown error"));
        }

    } catch (e) {
        console.error(e);
        alert("Network error. Failed to send.");
    }
}

async function sendShareMessage(recipient, link, title, modal) {
    if (!confirm(`Send to ${recipient}?`)) return;
    
    try {
        await fetch('/api/chat/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                sender: 'Me', // Backend handles the actual sender name
                recipient: recipient,
                content: `Check out this post: "${title}"\n${link}`
            })
        });
        alert("Sent!");
        modal.remove();
    } catch (e) {
        alert("Failed to send.");
    }
}

// --- SCROLL TO POST LOGIC (Add to end of loadFeed) ---
// Add this INSIDE loadFeed(), right AFTER the posts.forEach loop:

/* // ... inside loadFeed() ...
    posts.forEach(post => container.appendChild(createPostCard(post, currentUserName)));
    
    // CHECK URL FOR POST ID TO HIGHLIGHT
    const urlParams = new URLSearchParams(window.location.search);
    const highlightId = urlParams.get('postId');
    
    if (highlightId) {
        setTimeout(() => {
            const target = document.getElementById(`post-${highlightId}`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.classList.add('highlighted-post');
            }
        }, 500); // Small delay to ensure rendering
    }
*/
// --- NEW REPLY FUNCTIONS ---

function toggleReplyInput(commentId) {
    const div = document.getElementById(`reply-input-${commentId}`);
    if (div) {
        div.style.display = (div.style.display === 'none') ? 'flex' : 'none';
        if (div.style.display === 'flex') {
            const input = document.getElementById(`input-reply-${commentId}`);
            if(input) setTimeout(() => input.focus(), 100);
        }
    }
}

async function submitReply(postId, commentId) {
    const input = document.getElementById(`input-reply-${commentId}`);
    const content = input.value.trim();
    if (!content) return;

    input.disabled = true;

    try {
        const response = await fetch(`/api/posts/comment/reply/${postId}/${commentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        const data = await response.json();

        if (data.success) {
            // Re-fetch User Name to maintain consistency
            const authRes = await fetch('/api/auth/me');
            const authData = await authRes.json();
            const currentUserName = authRes.ok ? authData.name : "";

            // Re-render the comments list
            const listDiv = document.getElementById(`list-${postId}`);
            
            // RE-RENDER LOGIC (Mini version of createPostCard logic)
            listDiv.innerHTML = data.comments.map(c => {
                const isMyComment = c.author === currentUserName;
                const deleteBtn = isMyComment 
                    ? `<button class="delete-comment-btn" onclick="deleteComment('${postId}', '${c._id}')">Delete</button>` 
                    : '';
                
                const replies = c.replies || [];
                const repliesHTML = replies.map(r => `
                    <div class="reply-item">
                        <span class="comment-author" style="font-size:0.8rem;">${r.author}:</span>
                        <span class="comment-text">${r.content}</span>
                    </div>
                `).join('');

                return `
                <div class="comment-item" id="comment-${c._id}">
                    <div class="comment-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <span class="comment-author">${c.author}:</span>
                            ${deleteBtn}
                        </div>
                        <button class="reply-btn" onclick="toggleReplyInput('${c._id}')">Reply</button>
                    </div>
                    <div class="comment-text" style="white-space: pre-wrap;">${c.content}</div>
                    <div class="replies-list" style="${replies.length > 0 ? '' : 'display:none;'}">${repliesHTML}</div>
                    <div id="reply-input-${c._id}" class="reply-input-container" style="display:none;">
                        <input type="text" class="reply-input" placeholder="Write a reply..." id="input-reply-${c._id}">
                        <button onclick="submitReply('${postId}', '${c._id}')" class="comment-btn" style="padding: 4px 10px; font-size: 0.8rem;">Post</button>
                    </div>
                </div>`;
            }).join('');
            
        } else {
            alert(data.message || "Failed to reply");
        }
    } catch (e) {
        console.error(e);
    } finally {
        input.disabled = false;
    }
}

// ==========================================
// INTERACTIVE FUNCTIONS
// ==========================================

function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    section.style.display = (section.style.display === 'none') ? 'block' : 'none';
}

async function submitComment(postId) {
    const input = document.getElementById(`input-${postId}`);
    const content = input.value.trim();
    if (!content) return;

    input.disabled = true;

    try {
        const response = await fetch(`/api/posts/comment/${postId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        const data = await response.json();

        if (data.success) {
            input.value = ""; 
            
            // Re-fetch Current User to ensure Delete button appears on new comment immediately
            const authRes = await fetch('/api/auth/me');
            const authData = await authRes.json();
            const currentUserName = authRes.ok ? authData.name : "";

            // Re-render list
            const listDiv = document.getElementById(`list-${postId}`);
            listDiv.innerHTML = data.comments.map(c => {
                const isMyComment = c.author === currentUserName;
                const deleteBtn = isMyComment 
                    ? `<button class="delete-comment-btn" onclick="deleteComment('${postId}', '${c._id}')">Delete</button>` 
                    : '';
                
                return `
                <div class="comment-item">
                    <div class="comment-header">
                        <span class="comment-author">${c.author}:</span>
                        ${deleteBtn}
                    </div>
                    <div class="comment-text" style="white-space: pre-wrap;">${c.content}</div>
                </div>`;
            }).join('');
        }
    } catch (e) { 
        console.error(e); 
    } finally { 
        input.disabled = false; 
        input.focus(); 
    }
}

async function deleteComment(postId, commentId) {
    if (!confirm("Delete this comment?")) return;

    try {
        const response = await fetch(`/api/posts/comment/${postId}/${commentId}`, { method: 'DELETE' });
        const data = await response.json();

        if (data.success) {
            // Get User Name again for re-render
            const authRes = await fetch('/api/auth/me');
            const authData = await authRes.json();
            const currentUserName = authRes.ok ? authData.name : "";

            const listDiv = document.getElementById(`list-${postId}`);
            listDiv.innerHTML = data.comments.map(c => {
                const isMyComment = c.author === currentUserName;
                const deleteBtn = isMyComment 
                    ? `<button class="delete-comment-btn" onclick="deleteComment('${postId}', '${c._id}')">Delete</button>` 
                    : '';
                
                return `
                <div class="comment-item">
                    <div class="comment-header">
                        <span class="comment-author">${c.author}:</span>
                        ${deleteBtn}
                    </div>
                    <div class="comment-text" style="white-space: pre-wrap;">${c.content}</div>
                </div>`;
            }).join('');
        } else {
            alert("Could not delete comment.");
        }
    } catch (error) {
        console.error("Delete error:", error);
    }
}

async function toggleLike(postId, btn) {
    if (btn.disabled) return;
    btn.disabled = true;

    try {
        const response = await fetch(`/api/posts/like/${postId}`, { method: 'PUT' });
        const data = await response.json();

        if (data.success) {
            const icon = btn.querySelector('i');
            const countSpan = btn.querySelector('.like-count');

            if (data.isLiked) {
                // 1. SWITCH TO SOLID RED HEART
                icon.className = 'bx bxs-heart'; 
                icon.style.color = '#fa3737'; 

                // 2. TRIGGER ANIMATION
                icon.classList.add('animate-pop');
                
                // 3. CLEANUP (Remove class after 300ms so it can pop again later)
                setTimeout(() => icon.classList.remove('animate-pop'), 300);

            } else {
                // SWITCH BACK TO OUTLINE
                icon.className = 'bx bx-heart';
                icon.style.color = 'currentColor';
            }
            
            countSpan.innerText = data.likesCount;
        }
    } catch (error) {
        console.error("Like failed", error);
    } finally {
        btn.disabled = false;
    }
}
async function deletePost(postId) {
    if (!postId || postId === 'undefined') {
        return alert("Error: Invalid Post ID");
    }
    if (!confirm("Are you sure you want to delete this post? This cannot be undone.")) return;

    try {
        const response = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
        const data = await response.json();

        if (response.ok) {
            // Remove from screen immediately
            const postElement = document.getElementById(`post-${postId}`);
            if (postElement) postElement.remove();
        } else {
            alert("Failed to delete: " + data.message);
        }
    } catch (error) {
        console.error(error);
        alert("Network error.");
    }
}
// ==========================================
// UTILITY: MAKE LINKS CLICKABLE
// ==========================================
function linkify(text) {
    if (!text) return "";

    // 1. Escape HTML first (Prevent XSS attacks)
    const safeText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // 2. Detect URLs and replace with <a> tags
    // Regex looks for http:// or https:// followed by non-space characters
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    return safeText.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#fa3737; text-decoration:underline; word-break:break-all;">${url}</a>`;
    });
}
// TOGGLE MENU
function togglePostMenu(id) {
    const menu = document.getElementById(`post-menu-${id}`);
    // Close others
    document.querySelectorAll('.post-dropdown').forEach(el => {
        if(el.id !== `post-menu-${id}`) el.style.display = 'none';
    });
    menu.style.display = (menu.style.display === 'none') ? 'block' : 'none';
}

// HIDE POST
async function hidePost(postId) {
    if(!confirm("Hide this post? You won't see it again.")) return;
    
    try {
        const res = await fetch(`/api/users/hide-post/${postId}`, { method: 'PUT' });
        if(res.ok) {
            document.getElementById(`post-${postId}`).remove();
            alert("Post hidden.");
        }
    } catch(e) { console.error(e); }
}

// REPORT CONTENT (Generic for Post/Message)
async function reportContent(type, id) {
    const reason = prompt(`Why are you reporting this ${type}?`);
    if(!reason) return;

    try {
        const res = await fetch('/api/reports/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetType: type, targetId: id, reason })
        });
        const data = await res.json();
        alert(data.message);
    } catch(e) {
        alert("Failed to submit report.");
    }
}