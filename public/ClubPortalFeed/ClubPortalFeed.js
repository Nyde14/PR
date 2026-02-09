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
        const urlParams = new URLSearchParams(window.location.search);
const announceId = urlParams.get('announceId');
        if (announceId) {
    // Wait for feed to load, then trigger the global modal
    setTimeout(() => {
        if (currentGlobalPost && currentGlobalPost._id === announceId) {
            openGlobalModal();
        }
    }, 1000);
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
let currentGlobalPost = null;
async function loadFeed() {
    const mainContainer = document.getElementById('FeedContainer');
    const globalZone = document.getElementById('GlobalAnnouncementZone');
    
    try {
        const authRes = await fetch('/api/auth/me');
        const currentUser = authRes.ok ? await authRes.json() : null;

        const response = await fetch('/api/posts/feed');
        const posts = await response.json();

        mainContainer.innerHTML = "";
        globalZone.style.display = "none";

        // 1. Handle Global Post (Top Zone)
        const globalPost = posts.find(p => p.isGlobal === true);
        if (globalPost) {
            currentGlobalPost = globalPost;
            document.getElementById('GlobalTitlePreview').innerText = globalPost.title;
            document.getElementById('GlobalSnippet').innerText = globalPost.content.substring(0, 100) + "...";
            globalZone.style.display = "block"; 
        }

        // 2. Render Regular Feed (Filtered)
        posts.filter(p => !p.isGlobal).forEach(post => {
            const card = createPostCard(post, currentUser);
            
            // THE CRITICAL CHECK: Only append if card is NOT null
            if (card) {
                mainContainer.appendChild(card);
            }
        });
        
        checkSharedPost();
    } catch (error) { console.error("Feed Error:", error); }
}
// --- NEW: Global Modal Logic ---

function openGlobalModal() {
    if (!currentGlobalPost) return;

    // 1. Populate Modal Data
    document.getElementById('ModalGlobalTitle').innerText = currentGlobalPost.title;
    document.getElementById('ModalGlobalContent').innerText = currentGlobalPost.content;
    document.getElementById('ModalGlobalDate').innerText = new Date(currentGlobalPost.timestamp).toLocaleString();

    // 2. Handle Media
    const mediaContainer = document.getElementById('ModalGlobalMedia');
    mediaContainer.innerHTML = "";
    if (currentGlobalPost.mediaUrl) {
        if (currentGlobalPost.mediaType === 'video') {
             mediaContainer.innerHTML = `<video src="${currentGlobalPost.mediaUrl}" controls style="width:100%; border-radius:8px;"></video>`;
        } else {
             mediaContainer.innerHTML = `<img src="${currentGlobalPost.mediaUrl}" style="width:100%; border-radius:8px;">`;
        }
    }

    // 3. Setup Share Button
    document.getElementById('ModalGlobalShareBtn').onclick = () => 
        openShareModal(currentGlobalPost._id, currentGlobalPost.title);

    // 4. Show Modal
    const modal = document.getElementById('GlobalPostModal');
    modal.style.display = 'flex';
    
    // Add animation class
    modal.querySelector('.modal-content').classList.add('pop-in');
}

function closeGlobalModal() {
    document.getElementById('GlobalPostModal').style.display = 'none';
}

// Close when clicking outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('GlobalPostModal');
    if (e.target === modal) closeGlobalModal();
});

// ==========================================
// CARD GENERATOR
// ==========================================
function createPostCard(post, currentUser) {
    const currentUserName = currentUser ? currentUser.name : "";
    const isAdmin = currentUser && currentUser.usertype === 'Admin';
    const date = new Date(post.timestamp).toLocaleDateString();

    // 1. FILTER: Prevent Global posts from rendering as regular cards
    if (post.isGlobal === true) return null; 

    // 2. Initialize card element
    const card = document.createElement('div');
    card.className = 'post-card';
    card.id = `post-${post._id}`;

    // --- 3. DYNAMIC PROFILE & LOGO LOGIC ---
    const clubLogo = post.clubLogo || '/uploads/default_pfp.png';
    const fallbackImage = '/uploads/default_pfp.png';
    
    // Priority Logic for Author Profile Picture
    let authorPfp;
    if (post.author === currentUserName && currentUser.profilePicture) {
        authorPfp = currentUser.profilePicture;
    } else {
        authorPfp = (post.authorProfile && post.authorProfile.trim() !== "") 
            ? post.authorProfile 
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=random&color=fff`;
    }

    const profileLink = post.clubSlug ? `/ClubProfile/ClubProfile.html?slug=${post.clubSlug}` : '#';
    const isLiked = post.isLiked;
    const heartIconClass = isLiked ? "bx bxs-heart" : "bx bx-heart"; 
    const heartColor = isLiked ? "#fa3737" : "currentColor"; 
    const comments = post.comments || [];

    // --- 4. COMMENT LIST GENERATION (The "Lost" 40 lines) ---
    const commentsHTML = comments.map(c => {
    const isMyComment = c.author === currentUserName;
    const avatarUrl = c.userProfile || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&background=random&color=fff&size=64`;
    
    // Action Buttons: Delete (if mine) OR Report (if not mine)
    const actionBtn = isMyComment 
        ? `<button class="action-link delete-btn" onclick="deleteComment('${post._id}', '${c._id}')" title="Delete"><i class='bx bx-trash'></i></button>` 
        : `<button class="action-link report-btn" onclick="reportContent('Comment', '${post._id}|${c._id}')" title="Report"><i class='bx bx-flag'></i></button>`;

    const repliesHTML = (c.replies || []).map(r => {
        const isMyReply = r.author === currentUserName;
        // Construct ID as "PostID|CommentID|ReplyID" for the backend locator
        const replyTargetId = `${post._id}|${c._id}|${r._id}`;
        
        const replyAction = isMyReply
             ? `` // Optional: Add delete reply logic here if desired
             : `<button class="action-link report-btn" onclick="reportContent('Reply', '${replyTargetId}')" title="Report" style="font-size:0.7rem;"><i class='bx bx-flag'></i></button>`;

        return `
        <div class="reply-item">
            <div style="display:flex; justify-content:space-between; width:100%;">
                <span><span class="comment-author" style="font-size:0.8rem;">${r.author}:</span> ${r.content}</span>
                ${replyAction}
            </div>
        </div>`;
    }).join('');

    return `
    <div class="comment-item" id="comment-${c._id}" style="display:flex; gap:10px; margin-bottom:15px;">
        <img src="${avatarUrl}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
        <div style="flex:1;">
            <div class="comment-bubble"> 
                <div class="comment-header">
                    <span>${c.author}</span>
                    <div class="comment-actions">${actionBtn}</div>
                </div>
                <div class="comment-text">${c.content}</div>
            </div>
            <div class="replies-list">${repliesHTML}</div>
            <div style="margin-top:2px; margin-left:12px; font-size:0.8rem;">
                <button class="reply-btn" onclick="toggleReplyInput('${c._id}')">Reply</button>
            </div>
            <div id="reply-input-${c._id}" class="reply-input-container" style="display:none;">
                <input type="text" class="reply-input" placeholder="Reply..." id="input-reply-${c._id}">
                <button onclick="submitReply('${post._id}', '${c._id}')" class="comment-btn">Post</button>
            </div>
        </div>
    </div>`;
}).join('');
    // --- 5. ASSEMBLE CARD INNER HTML ---
    card.innerHTML = `
        <div class="post-header" style="position:relative;">
            <a href="${profileLink}" class="header-left" style="display:flex; align-items:center; text-decoration:none;">
                <img src="${clubLogo}" class="club-avatar" onerror="this.onerror=null; this.src='${fallbackImage}'" style="width:45px; height:45px; border-radius:50%; margin-right:12px; border:1px solid #eee; object-fit:cover;">
                <div class="header-info">
                    <span class="club-name-link" style="font-weight:bold; color:#333;">${post.clubname}</span>
                    <div style="display:flex; align-items:center; gap:6px; margin-top:3px;">
                        <img src="${authorPfp}" style="width:18px; height:18px; border-radius:50%; object-fit:cover;">
                        <span class="post-author-name" style="font-size:0.8rem; color:#666;">${post.author} • ${date}</span>
                    </div>
                </div>
            </a>
            <div class="post-menu-container" style="position:absolute; top:10px; right:10px;">
                <button onclick="togglePostMenu('${post._id}')" class="menu-dots-btn"><i class='bx bx-dots-vertical-rounded'></i></button>
                <div id="post-menu-${post._id}" class="post-dropdown" style="display:none;">
                    <div onclick="hidePost('${post._id}')" class="menu-item"><i class='bx bx-hide'></i> Hide</div>
                    <div onclick="reportContent('Post', '${post._id}')" class="menu-item"><i class='bx bx-flag'></i> Report</div>
                    ${isAdmin ? `<div onclick="deletePost('${post._id}')" class="menu-item delete-item"><i class='bx bx-trash'></i> Delete</div>` : ''}
                </div>
            </div>
        </div>

        <h3 class="post-title" style="margin:12px 0;">${post.title}</h3>
        <div class="post-content">${post.content}</div>
        
        ${post.mediaUrl ? `<img src="${post.mediaUrl}" class="post-image" style="width:100%; border-radius:8px; margin:10px 0;">` : ""}
        
        <div class="post-actions" style="display:flex; gap:20px; padding-top:15px; border-top:1px solid #eee; margin-top:10px;">
            <button class="action-btn" onclick="toggleLike('${post._id}', this)">
                <i class='${heartIconClass}' style="color:${heartColor};"></i> <span>${post.likesCount}</span>
            </button>
            <button class="action-btn" onclick="toggleComments('${post._id}')">
                <i class='bx bx-message-rounded-dots'></i> ${comments.length}
            </button>
            <button class="action-btn" onclick="openShareModal('${post._id}', '${post.title.replace(/'/g, "\\'")}')">
                <i class='bx bx-share-alt'></i> Share
            </button>
        </div>

        <div id="comments-${post._id}" class="comments-section" style="display:none; padding-top:15px;">
            <div id="list-${post._id}" style="max-height:300px; overflow-y:auto;">${commentsHTML}</div>
            <div class="comment-input-area" style="display:flex; gap:10px; margin-top:10px;">
                <textarea id="input-${post._id}" class="comment-input" rows="1" placeholder="Write a comment..."></textarea>
                <button onclick="submitComment('${post._id}')" class="comment-btn"><i class='bx bx-send'></i></button>
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
    
    if (!sharedId) return;

    // Use a small timeout to ensure all posts have finished rendering
    setTimeout(() => {
        let targetElement = null;

        // 1. Check if the shared ID belongs to the Global Announcement
        if (currentGlobalPost && currentGlobalPost._id === sharedId) {
            targetElement = document.getElementById('GlobalAnnouncementZone');
            // If global, we also trigger the modal for better visibility
            openGlobalModal();
        } else {
            // 2. Otherwise, look for the regular post card
            targetElement = document.getElementById(`post-${sharedId}`);
        }

        if (targetElement) {
            // Smoothly scroll the post into the center of the screen
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Apply the visual highlight class
            targetElement.classList.add('highlight-active');

            // 3. Clean up the URL: Remove the postId so it doesn't re-flash on refresh
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);

            // Remove class after animation finishes to keep DOM clean
            setTimeout(() => {
                targetElement.classList.remove('highlight-active');
            }, 3500);
        }
    }, 700); 
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
        console.log("Reporting:", { type, id, reason });
        
        const res = await fetch('/api/reports/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetType: type, targetId: id, reason })
        });
        
        const data = await res.json();
        console.log("Report response:", data);
        
        if (res.ok) {
            alert("✅ Report submitted successfully.");
        } else {
            alert("❌ Failed to submit report: " + data.message);
        }
    } catch(e) { 
        console.error("Report error:", e);
        alert("❌ Failed to submit report: " + e.message); 
    }
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
function checkGlobalAnchor() {
    if (window.location.hash === "#GlobalAnnouncementZone") {
        const zone = document.getElementById('GlobalAnnouncementZone');
        if (zone) {
            zone.scrollIntoView({ behavior: 'smooth' });
            // Optional: Add a subtle flash effect to the zone
            zone.style.animation = "flashHighlight 2s ease-out";
        }
    }
}