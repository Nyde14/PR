document.addEventListener("DOMContentLoaded", async () => {
    try {
        // 1. DETECT SLUG
        const urlParams = new URLSearchParams(window.location.search);
        let clubSlug = urlParams.get('slug');

        if (!clubSlug) {
            const pathSegments = window.location.pathname.split('/');
            const lastSegment = pathSegments[pathSegments.length - 1];
            if (lastSegment && !lastSegment.toLowerCase().endsWith('.html')) {
                clubSlug = lastSegment;
            }
        }

        if (!clubSlug) return console.error("No club slug found");

        // 2. FETCH USER
        const authResponse = await fetch('/api/auth/me');
        if (!authResponse.ok) {
            window.location.href = "/Login/Login.html";
            return;
        }
        const user = await authResponse.json();
        
        // 3. POPULATE USER HEADER
        if (user) {
            setText('Name', user.name);
            const userPic = document.getElementById('ProfilePicture');
            if (userPic) {
                const avatarUrl = user.profilePicture || '/uploads/default_pfp.png';
                if (userPic.tagName === 'IMG') {
                    userPic.src = avatarUrl;
                } else {
                    userPic.style.backgroundImage = `url('${avatarUrl}')`;
                    userPic.style.backgroundSize = 'cover';
                    userPic.style.backgroundPosition = 'center';
                }
            }
            const badge = document.getElementById('StatusBadge');
            if(badge) badge.innerText = user.usertype || 'User';
        }

        // 4. FETCH CLUB & LOAD POSTS
        await fetchClubDetails(clubSlug, user);

    } catch (error) {
        console.error("Init Error:", error);
    }
});

// ==========================================
// 1. DATA LOADING
// ==========================================

// ClubProfile.js - FULL UPDATED FUNCTION

async function fetchClubDetails(slug, user) {
    try {
        const response = await fetch(`/api/clubs/${slug}`);
        if (!response.ok) throw new Error("Club not found");

        const data = await response.json();
        
        // 1. SET NAMES & CATEGORIES
        setText('club-name', data.clubname); 
        
        // Handle category display - could be string or array, default to Organization
        let displayCategory = 'Organization';
        if (data.category) {
            if (Array.isArray(data.category) && data.category.length > 0) {
                displayCategory = data.category[0]; // Take first element if array
            } else if (typeof data.category === 'string' && data.category.trim() !== '') {
                displayCategory = data.category; // Use directly if string
            }
        }
        setText('ClubCategory', displayCategory);

        // 2. SET DESCRIPTIONS & STATS
        setText('ClubDescription', data.description || data.fullDescription || "No description available.");
        
        // Use memberCount (Matching server aggregation)
        setText('MemberCount', data.memberCount || 0);

        // 3. HANDLE IMAGES
        // Check branding object first, then fallback to top-level fields
        const rawLogo = (data.branding && data.branding.logo) ? data.branding.logo : data.logo;
        const rawBanner = (data.branding && data.branding.banner) ? data.branding.banner : data.banner;
        
        const logoUrl = fixPath(rawLogo, '/uploads/default_pfp.png');
        const bannerUrl = fixPath(rawBanner, '/uploads/default_banner.jpg');
        
        const logoDiv = document.getElementById('ClubLogo');
        const bannerDiv = document.getElementById('ClubBanner');

        if (logoDiv) {
            logoDiv.style.backgroundImage = `url('${logoUrl}')`;
            logoDiv.style.backgroundSize = 'cover';
            logoDiv.style.backgroundPosition = 'center';
        }

        if (bannerDiv) {
            bannerDiv.style.backgroundImage = `url('${bannerUrl}')`;
            bannerDiv.style.backgroundSize = 'cover';
            bannerDiv.style.backgroundPosition = 'center';
        }

        // 4. UPDATE BUTTONS & FEED
        updateButtonState(user, data.clubname);
        loadClubPosts(data.clubname);

    } catch (error) {
        console.error("Error loading details:", error);
        setText('club-name', "Club Not Found");
        setText('ClubCategory', "N/A");
    }
}
async function loadClubPosts(clubName) {
    const container = document.getElementById('ClubPostsContainer');
    if (!container) return;

    try {
        const response = await fetch(`/api/posts/club/${encodeURIComponent(clubName)}`);
        const posts = await response.json();
        const authRes = await fetch('/api/auth/me');
        const currentUser = await authRes.json();

        container.innerHTML = "";
        if (!posts || posts.length === 0) {
            container.innerHTML = "<p style='padding:20px; text-align:center; color:#666;'>No announcements yet.</p>";
            return;
        }

        posts.forEach(post => {
            container.appendChild(createPostCard(post, currentUser));
        });
    } catch (error) {
        console.error("Error loading posts:", error);
    }
}

// ==========================================
// 2. BUTTON LOGIC
// ==========================================

function updateButtonState(user, currentClubName) {
    const joinBtn = document.getElementById('JoinButton');
    let container = joinBtn ? joinBtn.parentNode : document.querySelector('.action-buttons');
    
    if (!joinBtn && !container) return;
    if (!container) container = joinBtn.parentNode;

    container.style.display = 'flex';
    container.style.gap = '10px';
    container.style.alignItems = 'center';

    setupFollowButton(user, currentClubName, container, joinBtn);

    if (!joinBtn) return;

    if (user.club === currentClubName) {
        joinBtn.style.display = 'none';
        if (!document.getElementById('MemberStatus')) {
            const status = document.createElement('span');
            status.id = 'MemberStatus';
            status.innerText = "✅ Member";
            status.style.color = "green";
            status.style.fontWeight = "bold";
            container.appendChild(status);
        }
        return;
    }

    if (user.club === 'Pending') {
        checkSpecificApplication(user.name, currentClubName, joinBtn, container);
        return;
    }

    if (user.club && user.club !== "none") {
        joinBtn.style.display = 'none';
        return;
    }

    setupJoinButton(joinBtn, user.name, currentClubName);
}

function setupFollowButton(user, clubName, container, joinBtn) {
    const followingList = user.following || [];
    let isFollowing = followingList.includes(clubName);

    let followBtn = document.getElementById('FollowButton');
    if (!followBtn) {
        followBtn = document.createElement('button');
        followBtn.id = 'FollowButton';
        if (joinBtn && joinBtn.parentNode === container) {
            container.insertBefore(followBtn, joinBtn);
        } else {
            container.appendChild(followBtn);
        }
    }

    updateFollowVisuals(followBtn, isFollowing);

    followBtn.onclick = async function() {
        isFollowing = !isFollowing;
        updateFollowVisuals(followBtn, isFollowing);
        followBtn.disabled = true;

        const action = isFollowing ? 'follow' : 'unfollow';

        try {
            const res = await fetch(`/api/users/${action}/${encodeURIComponent(clubName)}`, { method: 'PUT' });
            if (!res.ok) {
                isFollowing = !isFollowing;
                updateFollowVisuals(followBtn, isFollowing);
            }
        } catch (e) {
            isFollowing = !isFollowing;
            updateFollowVisuals(followBtn, isFollowing);
        } finally {
            followBtn.disabled = false;
        }
    };
}

function updateFollowVisuals(btn, isFollowing) {
    if (isFollowing) {
        btn.innerText = "Following ✓";
        btn.style.backgroundColor = "white";
        btn.style.color = "#fa3737";
        btn.style.border = "2px solid #fa3737";
    } else {
        btn.innerText = "Follow";
        btn.style.backgroundColor = "#fa3737";
        btn.style.color = "white";
        btn.style.border = "2px solid #fa3737";
    }
    btn.style.padding = "10px 20px";
    btn.style.borderRadius = "20px";
    btn.style.cursor = "pointer";
    btn.style.fontWeight = "bold";
    btn.style.marginRight = "10px";
}

// ==========================================
// 3. FULL POST CARD GENERATOR
// ==========================================

function createPostCard(post, currentUser) {
    const currentUserName = currentUser ? currentUser.name : "";
    const isAdmin = currentUser && currentUser.usertype === 'Admin';
    const date = new Date(post.timestamp).toLocaleDateString();

    const logoUrl = fixPath(post.clubLogo, '/uploads/default_pfp.png');
    const fallbackImage = '/uploads/default_pfp.png';
    const profileLink = post.clubSlug ? `/ClubProfile/ClubProfile.html?slug=${post.clubSlug}` : '#';
    const isLiked = post.isLiked;
    const heartColor = isLiked ? "#fa3737" : "none"; 
    const comments = post.comments || [];
    const postLink = `${window.location.origin}/ClubProfile/ClubProfile.html?slug=${post.clubSlug}&postId=${post._id}`;

    // --- COMMENTS HTML WITH AVATARS ---
    const commentsHTML = comments.map(c => {
        const isMyComment = c.author === currentUserName;
        const avatarUrl = c.userProfile || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&background=random&color=fff&size=64`;
        
        const deleteBtn = isMyComment ? 
            `<button class="delete-comment-btn" onclick="deleteComment('${post._id}', '${c._id}')" style="color:red; background:none; border:none; cursor:pointer; font-size:0.7rem; margin-left:10px;">Delete</button>` 
            : '';
        
        const replies = c.replies || [];
        const repliesHTML = replies.map(r => {
             const rAvatar = r.userProfile || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.author)}&background=random&color=fff&size=64`;
             return `
             <div class="reply-item" style="display:flex; align-items:flex-start; margin-top:8px; gap:8px;">
                <img src="${rAvatar}" 
     onclick="viewUserProfile('${r.author}')" 
     style="width:24px; height:24px; border-radius:50%; object-fit:cover; flex-shrink:0; cursor:pointer;">
                <div>
                    <span class="comment-author" style="font-weight:bold; font-size:0.85rem;">${r.author}:</span> 
                    <span style="font-size:0.9rem;">${r.content}</span>
                </div>
             </div>`;
        }).join('');
        
        return `
           <div class="comment-item" id="comment-${c._id}" style="display:flex; gap:10px; margin-bottom:15px;">
    <img src="${avatarUrl}" onclick="viewUserProfile('${c.author}')" style="width:32px; height:32px; border-radius:50%; object-fit:cover; cursor:pointer;">
    <div style="flex:1;">
        <div class="comment-bubble"> <div class="comment-header" style="display:flex; justify-content:space-between; align-items:center;">
                <span class="comment-author">${c.author}</span>
                ${deleteBtn}
            </div>
            <div class="comment-text">${c.content}</div>
        </div>
                
                <div style="margin-top:2px; margin-left:12px; font-size:0.8rem;">
                    <button class="reply-btn" onclick="toggleReplyInput('${c._id}')" style="background:none; border:none; color:#666; font-weight:bold; cursor:pointer;">Reply</button>
                </div>

                <div class="replies-list" style="margin-left:10px;">${repliesHTML}</div>
                
                <div id="reply-input-${c._id}" class="reply-input-container" style="display:none; margin-top:10px;">
                    <input type="text" class="reply-input" placeholder="Reply..." id="input-reply-${c._id}">
                    <button onclick="submitReply('${post._id}', '${c._id}')" class="comment-btn">Post</button>
                </div>
            </div>
        </div>`;
    }).join('');

    // Action Menu
    const actionMenu = `
        <div class="post-menu-container" style="position:absolute; top:10px; right:10px;">
            <button onclick="togglePostMenu('${post._id}')" class="menu-dots-btn" title="More Options">⋮</button>
            <div id="post-menu-${post._id}" class="post-dropdown" style="display:none;">
                <div onclick="hidePost('${post._id}')" class="menu-item">🙈 Hide Post</div>
                <div onclick="reportContent('Post', '${post._id}')" class="menu-item">🚩 Report Post</div>
                ${isAdmin ? `<div onclick="deletePost('${post._id}')" class="menu-item delete-item">🗑️ Delete (Admin)</div>` : ''}
            </div>
        </div>
    `;

    const card = document.createElement('div');
    card.className = 'post-card';
    card.id = `post-${post._id}`;
    
    // --- POST CARD HTML ---
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

        <div class="post-actions" style="margin-top:15px; border-top:1px solid #eee; padding-top:10px; display:flex; gap:20px; align-items:center;">
            <button class="action-btn" onclick="toggleLike('${post._id}', this)" style="display:flex; align-items:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${heartColor}" stroke="#fa3737" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <span class="like-count" style="margin-left:5px;">${post.likesCount}</span>
            </button>
            <button class="action-btn" onclick="toggleComments('${post._id}')" style="display:flex; align-items:center;">
                <span style="font-size:1.2rem;">💬</span> 
                <span style="margin-left:5px;">${comments.length}</span>
            </button>
            <div style="position:relative;">
                <button class="action-btn" onclick="toggleShareMenu('${post._id}')" title="Share" style="display:flex; align-items:center;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    <span style="margin-left:5px;">Share</span>
                </button>
                <div id="share-menu-${post._id}" class="share-dropdown" style="display:none; position:absolute; bottom:100%; left:0; background:white; border:1px solid #ddd; z-index:100; padding:10px; border-radius:5px; box-shadow:0 2px 10px rgba(0,0,0,0.1); width:150px; margin-bottom:10px;">
                    <div class="share-option" onclick="copyLink('${postLink}')" style="cursor:pointer; margin-bottom:8px; display:flex; align-items:center;">
                        <span style="margin-right:8px;">🔗</span> Copy Link
                    </div>
                </div>
            </div>
        </div>

        <div id="comments-${post._id}" style="display:none; background:#f9f9f9; padding:15px; margin-top:10px; border-radius:8px;">
            <div id="list-${post._id}" style="max-height:300px; overflow-y:auto; margin-bottom:10px;">${commentsHTML}</div>
            <div style="display:flex; gap:10px;">
                <textarea id="input-${post._id}" class="comment-input" rows="1" placeholder="Write a comment..."></textarea>
                <button onclick="submitComment('${post._id}')" class="comment-btn">Post</button>
            </div>
        </div>
    `;
    return card;
}

// ==========================================
// 4. HELPER FUNCTIONS
// ==========================================

function togglePostMenu(id) {
    const menu = document.getElementById(`post-menu-${id}`);
    const isHidden = menu.style.display === 'none';
    document.querySelectorAll('.post-dropdown').forEach(el => el.style.display = 'none');
    menu.style.display = isHidden ? 'block' : 'none';
}

function toggleShareMenu(postId) {
    const menu = document.getElementById(`share-menu-${postId}`);
    const isHidden = menu.style.display === 'none';
    document.querySelectorAll('.share-dropdown').forEach(el => el.style.display = 'none');
    menu.style.display = isHidden ? 'block' : 'none';
}

function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => alert("Link copied!"));
    document.querySelectorAll('.share-dropdown').forEach(el => el.style.display = 'none');
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

async function reportContent(type, id) {
    const reason = prompt(`Reason for reporting this ${type}?`);
    if(!reason) return;
    try {
        const res = await fetch('/api/reports/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetType: type, targetId: id, reason })
        });
        const data = await res.json();
        alert(data.message);
    } catch(e) { alert("Failed to submit report."); }
}

async function deletePost(postId) {
    if (!confirm("Delete post (Admin)?")) return;
    try {
        const response = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
        if (response.ok) document.getElementById(`post-${postId}`).remove();
    } catch (error) { console.error(error); }
}

async function toggleLike(postId, btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
        const response = await fetch(`/api/posts/like/${postId}`, { method: 'PUT' });
        const data = await response.json();
        if (data.success) {
            const svg = btn.querySelector('svg');
            const countSpan = btn.querySelector('.like-count');
            if (data.isLiked) {
                svg.setAttribute('fill', '#fa3737');
                svg.setAttribute('stroke', '#fa3737');
            } else {
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', '#666');
            }
            countSpan.innerText = data.likesCount;
        }
    } catch (error) { console.error("Like failed", error); } finally { btn.disabled = false; }
}

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
            loadClubPosts(document.getElementById('club-name').innerText);
        }
    } catch (e) { console.error(e); } finally { input.disabled = false; input.focus(); }
}

async function deleteComment(postId, commentId) {
    if (!confirm("Delete comment?")) return;
    try {
        const response = await fetch(`/api/posts/comment/${postId}/${commentId}`, { method: 'DELETE' });
        if (response.ok) loadClubPosts(document.getElementById('club-name').innerText);
    } catch (error) { console.error(error); }
}

function toggleReplyInput(commentId) {
    const div = document.getElementById(`reply-input-${commentId}`);
    div.style.display = (div.style.display === 'none') ? 'flex' : 'none';
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
            loadClubPosts(document.getElementById('club-name').innerText);
        }
    } catch (e) { console.error(e); } finally { input.disabled = false; }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text || "";
}

async function checkSpecificApplication(studentName, clubName, btn, container) {
    try {
        const response = await fetch(`/api/applications/check?studentname=${studentName}&clubname=${clubName}`);
        const data = await response.json();
        if (data.exists) {
            btn.innerText = "Pending Approval";
            btn.disabled = true;
            btn.style.opacity = "0.7";
            if (!document.getElementById('WithdrawButton')) {
                const withdrawBtn = document.createElement('button');
                withdrawBtn.id = 'WithdrawButton';
                withdrawBtn.innerText = "Withdraw";
                withdrawBtn.style.marginLeft = "10px";
                withdrawBtn.style.backgroundColor = "#dc3545";
                withdrawBtn.style.color = "white";
                withdrawBtn.style.border = "none";
                withdrawBtn.style.padding = "10px 20px";
                withdrawBtn.style.borderRadius = "20px";
                withdrawBtn.style.cursor = "pointer";
                withdrawBtn.onclick = () => withdrawApplication(studentName, clubName);
                container.appendChild(withdrawBtn);
            }
        } else {
            btn.style.display = 'none';
        }
    } catch (e) { console.error("Check app error", e); }
}

function setupJoinButton(btn, studentName, clubName) {
    btn.innerText = "Join Club";
    btn.disabled = false;
    btn.style.display = 'inline-block';
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', async () => {
        if (!confirm(`Apply to join ${clubName}?`)) return;
        try {
            newBtn.innerText = "Sending...";
            newBtn.disabled = true;
            const response = await fetch('/api/applications/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentname: studentName, clubname: clubName })
            });
            if (response.ok) {
                alert("Application submitted!");
                location.reload(); 
            } else {
                throw new Error("Failed to apply");
            }
        } catch (error) {
            alert(error.message);
            newBtn.innerText = "Join Club";
            newBtn.disabled = false;
        }
    });
}

async function withdrawApplication(studentName, clubName) {
    if (!confirm("Withdraw your application?")) return;
    try {
        await fetch('/api/applications/withdraw', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentname: studentName, clubname: clubName })
        });
        location.reload();
    } catch (error) { console.error("Withdraw Error", error); }
}
function fixPath(path, defaultPath) {
    if (!path || path === "null" || path === "undefined" || path.trim() === "") {
        return defaultPath;
    }
    if (path.startsWith('http') || path.startsWith('/')) {
        return path;
    }
    return '/' + path;
}