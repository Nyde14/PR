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
        let currentUser = null; 
        try {
            const authRes = await fetch('/api/auth/me');
            if (authRes.ok) {
                currentUser = await authRes.json(); 
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

        // STEP 3: Create Cards
        posts.forEach(post => {
            container.appendChild(createPostCard(post, currentUser));
        });
        
        // STEP 4: Check for Highlight (Run after posts are added)
        checkSharedPost();

    } catch (error) {
        console.error("Error loading feed:", error);
        container.innerHTML = "<p>Error loading posts.</p>";
    }
}

// ==========================================
// CARD GENERATOR
// ==========================================
function createPostCard(post, currentUser) {
    const currentUserName = currentUser ? currentUser.name : "";
    const isAdmin = currentUser && currentUser.usertype === 'Admin';
    const date = new Date(post.timestamp).toLocaleDateString();

    // Fallbacks
    const logoUrl = post.clubLogo || '/uploads/default_pfp.png';
    const fallbackImage = '/uploads/default_pfp.png';
    const profileLink = post.clubSlug ? `/ClubProfile/ClubProfile.html?slug=${post.clubSlug}` : '#';
    const isLiked = post.isLiked;
    
    // Icon Logic
    const heartIconClass = isLiked ? "bx bxs-heart" : "bx bx-heart"; 
    const heartColor = isLiked ? "#fa3737" : "currentColor"; 
    
    const comments = post.comments || [];

    // 1. Generate Comments HTML
    const commentsHTML = comments.map(c => {
        const isMyComment = c.author === currentUserName;
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

    // 2. Action Menu (Report/Hide/Delete)
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
            
            <button class="action-btn" onclick="openShareModal('${post._id}', '${post.title.replace(/'/g, "\\'")}')" title="Share">
                <i class='bx bx-share-alt' style="font-size:1.3rem;"></i>
                <span style="margin-left:5px;">Share</span>
            </button>
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

// ==========================================
// INTERACTIVE FUNCTIONS (Likes, Comments, Sharing)
// ==========================================

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
                icon.className = 'bx bxs-heart'; 
                icon.style.color = '#fa3737'; 
                icon.classList.add('animate-pop');
                setTimeout(() => icon.classList.remove('animate-pop'), 300);
            } else {
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

function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    section.style.display = (section.style.display === 'none') ? 'block' : 'none';
}

// 1. Submit Comment
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
            renderCommentsList(postId, data.comments, currentUserName);
        }
    } catch (e) { console.error(e); } finally { input.disabled = false; input.focus(); }
}

// 2. Submit Reply
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

// 3. Delete Comment
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

// Helper: Re-render Comments (Used by Submit/Reply/Delete)
function renderCommentsList(postId, comments, currentUserName) {
    const listDiv = document.getElementById(`list-${postId}`);
    if (!listDiv) return;

    listDiv.innerHTML = comments.map(c => {
        const isMyComment = c.author === currentUserName;
        const deleteBtn = isMyComment ? 
            `<button class="delete-comment-btn" onclick="deleteComment('${postId}', '${c._id}')" title="Delete"><i class='bx bx-trash'></i></button>` 
            : '';
        
        const replies = c.replies || [];
        const repliesHTML = replies.map(r => `
            <div class="reply-item">
                <span class="comment-author" style="font-size:0.8rem;">${r.author}:</span> ${r.content}
            </div>
        `).join('');

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
                <button onclick="submitReply('${postId}', '${c._id}')" class="comment-btn">Post</button>
            </div>
        </div>`;
    }).join('');
}

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

// ==========================================
// SHARE & HIGHLIGHT LOGIC (Fixed)
// ==========================================

function sharePost(postId) {
    // 1. Construct the URL with the postId parameter
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?postId=${postId}`;

    // 2. Copy to Clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert("Link copied! When people open it, this post will be highlighted.");
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

function checkSharedPost() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = urlParams.get('postId');

    if (sharedId) {
        // Wait slightly for DOM to settle
        setTimeout(() => {
            const postElement = document.getElementById(`post-${sharedId}`);
            if (postElement) {
                // 1. Scroll
                postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // 2. Highlight
                postElement.classList.add('highlight-post');
                // 3. Cleanup URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
                // 4. Cleanup Class
                setTimeout(() => {
                    postElement.classList.remove('highlight-post');
                }, 3000);
            }
        }, 500); 
    }
}

// ==========================================
// UTILITY: MENU, DELETE, REPORT, LINKIFY
// ==========================================

function togglePostMenu(id) {
    const menu = document.getElementById(`post-menu-${id}`);
    document.querySelectorAll('.post-dropdown').forEach(el => {
        if(el.id !== `post-menu-${id}`) el.style.display = 'none';
    });
    menu.style.display = (menu.style.display === 'none') ? 'block' : 'none';
}

async function hidePost(postId) {
    if(!confirm("Hide this post?")) return;
    try {
        const res = await fetch(`/api/users/hide-post/${postId}`, { method: 'PUT' });
        if(res.ok) {
            document.getElementById(`post-${postId}`).remove();
        }
    } catch(e) { console.error(e); }
}

async function deletePost(postId) {
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
        const response = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
        if (response.ok) {
            const postElement = document.getElementById(`post-${postId}`);
            if (postElement) postElement.remove();
        } else {
            alert("Failed to delete.");
        }
    } catch (error) { console.error(error); }
}

async function reportContent(type, id) {
    const reason = prompt(`Why are you reporting this ${type}?`);
    if(!reason) return;
    try {
        const res = await fetch('/api/reports/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetType: type, targetId: id, reason })
        });
        alert("Report submitted.");
    } catch(e) { alert("Failed to submit report."); }
}
function openShareModal(postId, title) {
    // Construct the link to share
    const baseUrl = window.location.origin + window.location.pathname;
    const link = `${baseUrl}?postId=${postId}`;
    
    // Remove existing modal if any
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    // Create Modal HTML
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    // Store data in attributes for easy access
    modal.innerHTML = `
        <div class="share-modal" id="ShareModal" data-link="${encodeURIComponent(link)}" data-title="${encodeURIComponent(title)}">
            <div class="share-header">
                <span>Share "${title.substring(0, 20)}..."</span>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            
            <div class="share-tabs">
                <div class="share-tab active" onclick="switchShareTab('dm', this)">Direct Message</div>
                <div class="share-tab" onclick="switchShareTab('club', this)">Club Chat</div>
            </div>

            <div id="ShareListContainer" class="share-list-container">
                <div style="text-align:center; padding:20px; color:#888;">Loading contacts...</div>
            </div>

            <div style="padding:10px; border-top:1px solid #eee; text-align:center;">
                <button onclick="copyToClipboard('${link}')" style="background:none; border:none; color:#fa3737; cursor:pointer; font-weight:bold;">
                    <i class='bx bx-link'></i> Copy Link
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);

    // Load Default Tab (Direct Messages)
    loadShareContacts(); 
}

// 2. SWITCH TABS
function switchShareTab(type, tabElement) {
    document.querySelectorAll('.share-tab').forEach(t => t.classList.remove('active'));
    tabElement.classList.add('active');

    const container = document.getElementById('ShareListContainer');
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">Loading...</div>';

    if (type === 'dm') loadShareContacts();
    else loadShareClubs();
}

// 3. FETCH DATA (Contacts)
async function loadShareContacts() {
    try {
        const res = await fetch('/api/users/contacts');
        if (!res.ok) throw new Error("Failed to load");
        const contacts = await res.json();
        renderShareList(contacts, 'dm');
    } catch (e) {
        document.getElementById('ShareListContainer').innerHTML = "<p style='text-align:center; padding:20px; color:red;'>Error loading contacts.</p>";
    }
}

// 4. FETCH DATA (Clubs)
async function loadShareClubs() {
    try {
        // Fetch all clubs and current user info
        const [clubsRes, authRes] = await Promise.all([
            fetch('/api/clubs'),
            fetch('/api/auth/me')
        ]);
        
        const allClubs = await clubsRes.json();
        const user = await authRes.json();
        
        // Filter: Admin sees all, Students see only their club
        let myClubs = [];
        if (user.usertype === 'Admin') {
            myClubs = allClubs;
        } else if (user.club && user.club !== 'none' && user.club !== 'Pending') {
            myClubs = allClubs.filter(c => c.clubname === user.club);
        }

        renderShareList(myClubs, 'club');

    } catch (e) {
        document.getElementById('ShareListContainer').innerHTML = "<p style='text-align:center; padding:20px; color:red;'>Error loading clubs.</p>";
    }
}

// 5. RENDER LIST
// 5. RENDER LIST (Updated with Club Logos)
function renderShareList(items, type) {
    const container = document.getElementById('ShareListContainer');
    const modal = document.getElementById('ShareModal');
    const link = decodeURIComponent(modal.dataset.link);
    const title = decodeURIComponent(modal.dataset.title);

    container.innerHTML = "";

    if (!items || items.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding:20px; color:#666;'>No results found.</p>";
        return;
    }

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'share-list-item';

        let name, subtext, icon, clickAction;

        if (type === 'dm') {
            // --- DIRECT MESSAGE LOGIC ---
            name = item.name;
            subtext = item.usertype || "User";
            
            const avatarSrc = item.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;
            icon = `<img src="${avatarSrc}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            
            clickAction = () => executeShare('private', item.name, link, title);
        } else {
            // --- CLUB CHAT LOGIC (Updated) ---
            name = item.clubname;
            subtext = "Group Chat";

            // 1. Try to find the logo (Handle different DB structures)
            let logoSrc = item.logo; 
            if (item.branding && item.branding.logo) logoSrc = item.branding.logo;
            
            // 2. Fallback if no logo exists
            if (!logoSrc) {
                logoSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;
            }

            // 3. Render Image instead of Emoji
            icon = `<img src="${logoSrc}" style="width:100%; height:100%; border-radius:50%; object-fit:cover; border:1px solid #eee;">`;
            
            clickAction = () => executeShare('group', item.clubname, link, title);
        }

        el.innerHTML = `
            <div class="share-avatar">${icon}</div>
            <div class="share-info">
                <span class="share-name">${name}</span>
                <span class="share-subtext">${subtext}</span>
            </div>
            <button class="send-btn-small">Send</button>
        `;

        el.onclick = clickAction;
        container.appendChild(el);
    });
}

// 6. EXECUTE SHARE (API CALL)
async function executeShare(type, targetName, link, title) {
    if (!confirm(`Send this post to ${targetName}?`)) return;

    try {
        const payload = {
            sender: "Me", 
            content: `📢 **Shared Post:** "${title}"\n${link}`
        };

        if (type === 'private') {
            payload.recipient = targetName;
            payload.clubname = "";
        } else {
            payload.clubname = targetName;
            payload.recipient = "";
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
            alert("Failed to send.");
        }

    } catch (e) {
        console.error(e);
        alert("Network error.");
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => alert("Link copied!"));
}