let allUsers = []; // Store users locally for filtering
let currentTargetId = null;
let selectedAdvisers = []; // Store selected adviser for club modal
let selectedAdviserName = ''; // Store display name of selected adviser
let allStaff = []; // Store all advisers and admins
let activeAdviserTarget = 'edit'; // Tracks which modal opened the selector ('edit' or 'create')

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // 1. Check Auth & Admin Status
        const response = await fetch('/api/auth/me');
        if (!response.ok) throw new Error("Unauthorized");
        const user = await response.json();

        if (user.usertype !== 'Admin') {
            window.showToast("Access Denied: Admins Only.", "error");
            window.location.href = "/ClubPortalFeed/ClubPortalFeed.html";
            return;
        }

        // 2. Load Data (Default Tab)
        loadAllUsers();

    } catch (error) {
        console.error("Admin Auth Error:", error);
    }
});

// ==========================================
// TAB SWITCHING LOGIC
// ==========================================
function switchTab(tabName) {
    // 1. Reset all UI elements first
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.table-card').forEach(card => card.style.display = 'none');

    // 2. Identify the target tab
    const targetBtnId = 'Tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
    const targetSectionId = tabName.charAt(0).toUpperCase() + tabName.slice(1) + 'Section';

    const btn = document.getElementById(targetBtnId);
    const section = document.getElementById(targetSectionId);

    if (btn && section) {
        btn.classList.add('active');
        section.style.display = 'block';

        // 3. Load specific data based on the tab
        if (tabName === 'users') loadAllUsers();
        else if (tabName === 'reports') loadReports();
        else if (tabName === 'clubs') loadClubManagementList();
        else if (tabName === 'create') loadClubsForDropdown();
        else if (tabName === 'docs') loadAdminDocs(); // Trigger your new function
        else if (tabName === 'system') { /* No data to load */ }
    } else {
        console.error(`Tab error: Could not find ${targetBtnId} or ${targetSectionId}`);
    }
}

// 2. Load the Club List
// AdminDashboard.js - Robust category handling

async function loadClubManagementList() {
    const tbody = document.getElementById('ClubTableBody');
    
    if (!tbody) return;

    try {
        const res = await fetch('/api/clubs');
        if (!res.ok) throw new Error("Failed to fetch clubs");
        
        allClubs = await res.json(); 

        tbody.innerHTML = allClubs.map(club => {
    const logo = (club.branding && club.branding.logo) 
        ? club.branding.logo 
        : (club.logo || '/uploads/default_pfp.png');
    
    const memberCount = club.memberCount || 0;
    const categoryText = club.category || 'No Category';

    // --- THE FIX: Catch all 3 database variations ---
    let clubAdvisers = [];
    
    if (club.advisers && Array.isArray(club.advisers) && club.advisers.length > 0) {
        clubAdvisers = club.advisers;             // Catches the new array
    } else if (club.adviser) {
        clubAdvisers = [club.adviser];            // Catches lowercase string
    } else if (club.Adviser) {
        clubAdvisers = [club.Adviser];            // Catches uppercase string
    }

    // Clean out any weird nulls or blank strings just in case
    clubAdvisers = clubAdvisers.filter(a => a && a.trim() !== "");

    const advisersDisplay = clubAdvisers.length > 0 
        ? clubAdvisers.join('<br>') 
        : '<span style="color:#888;">Unassigned</span>';

    const advisersJson = encodeURIComponent(JSON.stringify(clubAdvisers));

    return `
            <tr>
    <td><img src="${logo}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #eee;"></td>
    <td>
        <strong>${club.clubname}</strong><br>
        <small style="color:#888;">${categoryText}</small>
    </td>
    <td style="font-size: 0.85rem;">${advisersDisplay}</td>
    <td><span class="badge badge-active">${memberCount} Members</span></td>
    <td>
        <button onclick="openClubModal('${club._id}', '${club.clubname}', '${advisersJson}')" 
                class="btn-action btn-unrestrict">Edit</button>
        <button onclick="deleteClub('${club._id}', '${club.clubname}', ${memberCount})" 
                class="btn-action btn-restrict" style="margin-left:5px;">Delete</button>
    </td>
</tr>`;
        }).join('');
    } catch (e) { 
        console.error("Failed to load clubs:", e); 
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error: ${e.message}</td></tr>`;
    }
}
// 3. Open Modal for Create or Edit
async function openClubModal(id = null, name = '', advisersJson = '[]') {
    editingClubId = id;
    document.getElementById('ClubModalTitle').innerText = id ? 'Edit Club Settings' : 'Add New Organization';
    document.getElementById('EditClubName').value = name;
    
    // Setup categories...
    const clubData = allClubs.find(c => c._id === id);
    currentClubCategory.clear();
    if (clubData && clubData.category) {
        if (typeof clubData.category === 'string') currentClubCategory.add(clubData.category);
        else if (Array.isArray(clubData.category)) clubData.category.forEach(cat => currentClubCategory.add(cat));
    }
    
    document.querySelectorAll('#EditClubTags .filter-tag').forEach(btn => {
        btn.classList.toggle('selected', currentClubCategory.has(btn.innerText));
    });

    const previewImg = document.getElementById('ClubModalPreview');
    previewImg.src = clubData?.branding?.logo || clubData?.logo || '/uploads/default_pfp.png'; 

    // Load Advisers
    selectedAdvisers = JSON.parse(decodeURIComponent(advisersJson));
    renderAdviserTags('edit');
    
    document.getElementById('ClubEditModal').style.display = 'block';
}

function closeClubModal() {
    document.getElementById('ClubEditModal').style.display = 'none';
    editingClubId = null;
}

// ==========================================
// ADVISER SELECTION MODAL
// ==========================================


// 4. Save Club Data
async function saveClubData() {
    const clubName = document.getElementById('EditClubName').value;
    const logoFile = document.getElementById('EditClubLogo').files[0];

    const formData = new FormData();
    formData.append('clubId', editingClubId);
    formData.append('clubname', clubName);
    
    // Attach the array of advisers
    formData.append('advisers', JSON.stringify(selectedAdvisers));
    
    // Save category as a single string (first selected tag)
    const categoriesArray = Array.from(currentClubCategory);
    const categoryString = categoriesArray.length > 0 ? categoriesArray[0] : 'Organization';
    formData.append('category', categoryString);

    if (logoFile) formData.append('logo', logoFile);

    try {
        const res = await fetch('/api/clubs/update-branding', { method: 'PATCH', body: formData });
        if (res.ok) {
            window.showToast("✅ Club updated!");
            closeClubModal();
            loadClubManagementList();
        } else {
            const error = await res.json();
            window.showToast(`❌ Error: ${error.message || 'Failed to update club'}`, "error");
        }
    } catch (e) { 
        console.error(e);
        window.showToast(`❌ Error: ${e.message}`, "error");
    }
}

// ==========================================
// USER MANAGEMENT
// ==========================================

async function loadAllUsers() {
    const tbody = document.getElementById('UserTableBody');
    // Optional: Add spinner here if desired

    try {
        const res = await fetch('/api/users/all');
        if (!res.ok) throw new Error("Failed to fetch users");
        
        allUsers = await res.json();
        renderTable(allUsers);

    } catch (e) {
        console.error(e);
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:red;'>Error loading users.</td></tr>";
    }
}

// Virtual Scrolling Variaviser)bles
let currentFilteredUsers = [];
let visibleUserRange = { start: 0, end: 20 };
const USERS_PER_PAGE = 20;
const USER_ROW_HEIGHT = 65; // Approximate height of each row in pixels

function renderTable(users) {
    const tbody = document.getElementById('UserTableBody');
    const table = tbody.parentElement;
    tbody.innerHTML = "";

    if (users.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>No users found.</td></tr>";
        return;
    }

    // Store filtered users globally for virtual scrolling
    currentFilteredUsers = users;
    visibleUserRange = { start: 0, end: USERS_PER_PAGE };

    // Setup virtual scrolling wrapper
    const wrapper = table.parentElement;
    if (!wrapper.classList.contains('user-table-scroll-wrapper')) {
        wrapper.classList.add('user-table-scroll-wrapper');
        wrapper.style.position = 'relative';
        wrapper.style.maxHeight = '700px';
        wrapper.style.overflow = 'auto';
        wrapper.addEventListener('scroll', debounceUserScroll);
    }

    // Render initial batch
    renderUserBatch();
}

function renderUserBatch() {
    const tbody = document.getElementById('UserTableBody');
    const { start, end } = visibleUserRange;
    
    // Clear all rows
    tbody.innerHTML = "";
    
    // Add top spacer
    const topSpacerRow = document.createElement('tr');
    topSpacerRow.className = 'spacer-top';
    topSpacerRow.style.height = (start * USER_ROW_HEIGHT) + 'px';
    topSpacerRow.innerHTML = '<td colspan="6"></td>';
    tbody.appendChild(topSpacerRow);

    // Render visible batch
    const batchUsers = currentFilteredUsers.slice(start, Math.min(end, currentFilteredUsers.length));
    
    batchUsers.forEach((user) => {
        const isBanned = user.isRestricted;
        const statusBadge = isBanned 
            ? `<span class="badge badge-restricted">Restricted</span>`
            : `<span class="badge badge-active">Active</span>`;

        const roleColor = user.usertype === 'Teacher' ? 'blue' : 'gray';
        const roleBadge = `<span style="color:${roleColor}; font-weight:bold;">${user.usertype}</span>`;

        const actionBtn = isBanned
            ? `<button onclick="unrestrictUser('${user._id}', '${user.name}')" class="btn-action btn-unrestrict">Unrestrict</button>`
            : `<button onclick="openRestrictModal('${user._id}', '${user.name}')" class="btn-action btn-restrict">Restrict</button>`;

        const row = document.createElement('tr');
        row.style.height = USER_ROW_HEIGHT + 'px';
        row.innerHTML = `
            <td><strong>${user.name}</strong></td>
            <td>${user.email}</td>
            <td>${roleBadge}</td>
            <td>${user.club || '-'}</td>
            <td>${statusBadge}</td>
            <td>${actionBtn}</td>
        `;
        tbody.appendChild(row);
    });

    // Add bottom spacer
    const totalHeight = currentFilteredUsers.length;
    const bottomSpacerRow = document.createElement('tr');
    bottomSpacerRow.className = 'spacer-bottom';
    const bottomHeight = Math.max(0, (totalHeight - end) * USER_ROW_HEIGHT);
    bottomSpacerRow.style.height = bottomHeight + 'px';
    bottomSpacerRow.innerHTML = '<td colspan="6"></td>';
    tbody.appendChild(bottomSpacerRow);
}

const debounceUserScroll = (() => {
    let timeout;
    return function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            const table = document.getElementById('UserTableBody').parentElement;
            const wrapper = table.parentElement;
            const scrollTop = wrapper.scrollTop;
            const visibleStart = Math.max(0, Math.floor(scrollTop / USER_ROW_HEIGHT) - 5);
            const visibleEnd = visibleStart + USERS_PER_PAGE + 10;

            if (visibleStart !== visibleUserRange.start || visibleEnd !== visibleUserRange.end) {
                visibleUserRange = { start: visibleStart, end: visibleEnd };
                renderUserBatch();
            }
        }, 100);
    };
})();

function filterUsers() {
    const term = document.getElementById('SearchInput').value.toLowerCase();
    const role = document.getElementById('RoleFilter').value;

    const filtered = allUsers.filter(u => {
        const matchesTerm = u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
        const matchesRole = role === 'all' || u.usertype === role;
        return matchesTerm && matchesRole;
    });

    renderTable(filtered);
}

// ==========================================
// REPORT MANAGEMENT
// ==========================================

async function loadReports() {
    const tbody = document.getElementById('ReportsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Loading reports...</td></tr>";

    try {
        console.log("Fetching reports...");
        const res = await fetch('/api/reports/all');
        console.log("Reports response status:", res.status);
        
        if (!res.ok) throw new Error("Failed to fetch reports");
        const reports = await res.json();
        console.log("Reports loaded:", reports.length, reports);

        if (reports.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No reports found.</td></tr>";
            return;
        }

        tbody.innerHTML = reports.map(r => {
            // THE FIX: Handle different reporter data structures
            const reporterDisplay = typeof r.reporter === 'object' ? r.reporter.name : (r.reporter || 'Anonymous');
            
            let statusClass = 'badge-pending';
            if (r.status === 'Resolved') statusClass = 'badge-resolved';
            if (r.status === 'Dismissed') statusClass = 'badge-dismissed';

            return `
            <tr>
                <td><span class="badge" style="background:#eee; color:#333;">${r.targetType}</span></td>
                <td><strong>${reporterDisplay}</strong></td>
                <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.reason}</td>
                <td><span class="badge ${statusClass}">${r.status || 'Pending'}</span></td>
                <td>
                    <button onclick="viewReportedContent('${r._id}')" class="btn-action" 
                            style="background:#17a2b8; color:white; padding: 5px 10px;" title="View Content">
                        <i class='bx bx-show'></i> View
                    </button>
                    ${r.status === 'Pending' ? `
                        <button onclick="resolveReport('${r._id}', 'Resolved')" class="btn-confirm" style="font-size:0.75rem; padding: 5px 8px;">Resolve</button>
                        <button onclick="resolveReport('${r._id}', 'Dismissed')" class="btn-cancel" style="font-size:0.75rem; padding: 5px 8px;">Dismiss</button>
                    ` : `<small style="color:#888;">By: ${r.resolvedBy || 'Admin'}</small>`}
                </td>
            </tr>`;
        }).join('');
    } catch (e) { 
        console.error("Report Load Error:", e);
        tbody.innerHTML = `<tr><td colspan='5' style='text-align:center; color:red;'>Error: ${e.message}</td></tr>`;
    }
}
async function resolveReport(id, status) {
    const isConfirmed = await window.showConfirm(
        "Resolve Report",
        `Mark report as ${status}?`,
        "Confirm"
    );
    if (!isConfirmed) return;
    try {
        await fetch(`/api/reports/${id}/resolve`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status })
        });
        loadReports(); // Refresh list
    } catch(e) { console.error(e); alert("Action failed."); }
}

// ==========================================
// VIEW CONTENT LOGIC (SMART SWITCH)
// ==========================================

async function viewReportedContent(reportId) {
    try {
        const res = await fetch(`/api/reports/${reportId}/view`);
        const result = await res.json();
        
        console.log("Report View Response:", result); // Debug logging

        if (result.type === 'Deleted') {
            window.showToast(result.message);
            return;
        }

        if (result.type === 'Post') {
            if (!result.data) {
                console.error("Post data missing from response:", result);
                window.showToast("Error: Post data missing from server response.", "error");
                return;
            }
            // Always show modal for posts - never redirect
            openPostModal(result.data);
        } 
        else if (result.type === 'Message') {
            openMessageModal(result.data);
        }
        // NEW: Handle Comments and Replies
        else if (result.type === 'Comment' || result.type === 'Reply') {
            openCommentModal(result.data, result.type);
        }

    } catch (e) { 
        console.error("viewReportedContent error:", e); 
        window.showToast("Error retrieving content.", "error"); 
    }
}

// --- NEW MODAL FOR COMMENTS/REPLIES ---
function openCommentModal(data, type) {
    document.getElementById('ReviewTitle').innerText = `Reported ${type}`;
    document.getElementById('ReviewAuthor').innerText = data.author;
    document.getElementById('ReviewContent').innerText = data.content;
    document.getElementById('ReviewContext').innerText = `Posted in: "${data.postTitle}"`;
    document.getElementById('ReviewDate').innerText = new Date(data.timestamp).toLocaleString();
    
    // Setup Delete Button
    const deleteBtn = document.getElementById('BtnReviewDelete');
    deleteBtn.onclick = () => deleteReportedComment(data.postId, data.commentId, data.replyId, type);

    document.getElementById('ReviewModal').style.display = 'block';
}

function closeReviewModal() {
    document.getElementById('ReviewModal').style.display = 'none';
}

async function deleteReportedComment(postId, commentId, replyId, type) {
    const isConfirmed = await window.showConfirm(
        "Delete Content",
        `Permanently delete this ${type}?`,
        "Delete"
    );
    if (!isConfirmed) return;

    let url = `/api/posts/comment/${postId}/${commentId}`;
    // If it's a reply, we need a specific endpoint or logic, 
    // but usually deleting the parent comment or handling via the same route works if structured right.
    // For specific reply deletion:
    if (type === 'Reply' && replyId) {
        url = `/api/posts/comment/reply/${postId}/${commentId}/${replyId}`; // Ensure this route exists
    }

    try {
        const res = await fetch(url, { method: 'DELETE' });
        if (res.ok) {
            window.showToast("Deleted successfully.");
            closeReviewModal();
            loadReports(); // Refresh table
        } else {
            window.showToast("Failed to delete.", "error");
        }
    } catch (e) { console.error(e); }
}

// ==========================================
// POST MODAL PREVIEW
// ==========================================

function openPostModal(data) {
    // Safety check: data must be defined
    if (!data) {
        window.showToast("Error: Post data is missing.", "error");
        console.error("openPostModal called with undefined data");
        return;
    }

    console.log("Opening post modal with data:", data); // Debug

    // 1. Fill Post Data
    document.getElementById('PostTitle').innerText = data.title || 'Untitled Post';
    document.getElementById('PostAuthor').innerText = data.author || 'Unknown Author';
    document.getElementById('PostClub').innerText = data.clubname || 'Club';
    document.getElementById('PostDate').innerText = new Date(data.timestamp).toLocaleString();
    document.getElementById('PostContent').innerText = data.content || '(No content)';
    document.getElementById('PostLikes').innerText = data.likes || 0;
    document.getElementById('PostComments').innerText = data.commentsCount || 0;

    // 2. Handle Author Profile Picture
    const authorPic = document.getElementById('PostAuthorPic');
    if (data.authorProfile) {
        authorPic.src = data.authorProfile;
        authorPic.style.display = 'inline-block';
    } else {
        authorPic.style.display = 'none';
    }

    // 3. Handle Media
    const mediaContainer = document.getElementById('PostMediaContainer');
    const imgElement = document.getElementById('PostMediaImage');
    const videoElement = document.getElementById('PostMediaVideo');
    
    mediaContainer.style.display = 'none';
    imgElement.style.display = 'none';
    videoElement.style.display = 'none';

    if (data.mediaUrl) {
        mediaContainer.style.display = 'block';
        if (data.mediaType === 'image') {
            imgElement.src = data.mediaUrl;
            imgElement.style.display = 'block';
        } else if (data.mediaType === 'video') {
            videoElement.src = data.mediaUrl;
            videoElement.style.display = 'block';
        }
    }

    // 4. Setup Delete Button
    const deleteBtn = document.getElementById('BtnDeletePost');
    deleteBtn.onclick = () => deleteReportedPost(data.postId);

    // 5. Show Modal - ALWAYS DISPLAY BLOCK
    const modal = document.getElementById('PostModal');
    modal.style.display = 'block';
    
    console.log("Post modal displayed:", modal.style.display); // Debug
}

function closePostModal() {
    document.getElementById('PostModal').style.display = 'none';
}

async function deleteReportedPost(postId) {
    const isConfirmed = await window.showConfirm(
        "Delete Post",
        "Are you sure you want to permanently delete this post? This action cannot be undone.",
        "Delete"
    );
    if (!isConfirmed) return;

    try {
        const res = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            window.showToast("Post deleted successfully.");
            closePostModal();
            loadReports(); // Refresh the reports table
        } else {
            const error = await res.json();
            window.showToast("Failed to delete: " + error.message, "error");
        }
    } catch (e) {
        console.error(e);
        window.showToast("Error deleting post.", "error");
    }
}

// ==========================================
// MESSAGE VIEWER MODAL
// ==========================================

function openMessageModal(data) {
    // 1. Fill Data
    document.getElementById('MsgSender').innerText = data.sender;
    document.getElementById('MsgContext').innerText = data.context;
    document.getElementById('MsgContent').innerText = data.content || "(No text content)";
    document.getElementById('MsgTime').innerText = new Date(data.timestamp).toLocaleString();

    // 2. Handle Media
    const mediaContainer = document.getElementById('MsgMediaContainer');
    mediaContainer.innerHTML = "";
    mediaContainer.style.display = 'none';

    if (data.mediaUrl) {
        mediaContainer.style.display = 'block';
        if (data.mediaType === 'image') {
            mediaContainer.innerHTML = `<img src="${data.mediaUrl}" style="max-width:100%; border-radius:8px;">`;
        } else if (data.mediaType === 'video') {
            mediaContainer.innerHTML = `<video src="${data.mediaUrl}" controls style="max-width:100%; border-radius:8px;"></video>`;
        }
    }

    // 3. SETUP DELETE BUTTON
    const deleteBtn = document.getElementById('BtnDeleteMessage');
    // We attach a fresh onclick handler with the specific ID
    deleteBtn.onclick = () => deleteReportedMessage(data.messageId);

    // 4. Show Modal
    document.getElementById('MessageModal').style.display = 'block';
}

function closeMessageModal() {
    document.getElementById('MessageModal').style.display = 'none';
}

// ==========================================
// RESTRICTION LOGIC (MODAL)
// ==========================================

function openRestrictModal(id, name) {
    currentTargetId = id;
    const targetEl = document.getElementById('RestrictTargetName');
    if(targetEl) {
        targetEl.innerText = name;
        targetEl.style.color = "#fa3737";
    }
    document.getElementById('RestrictModal').style.display = 'block';
}

function closeRestrictModal() {
    document.getElementById('RestrictModal').style.display = 'none';
    document.getElementById('RestrictReason').value = "";
    currentTargetId = null;
}

async function submitRestriction() {
    if (!currentTargetId) return;
    const duration = document.getElementById('RestrictDuration').value;
    const reason = document.getElementById('RestrictReason').value;

    if (!reason.trim()) return window.showToast("Reason is required.", "error");

    try {
        const res = await fetch(`/api/users/restrict/${currentTargetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration, reason })
        });
        
        const data = await res.json();
        if (res.ok) {
            window.showToast(data.message);
            closeRestrictModal();
            loadAllUsers(); 
        } else {
            window.showToast(data.message, "error");
        }
    } catch (e) {
        console.error(e);
    }
}

async function unrestrictUser(id, name) {
    const isConfirmed = await window.showConfirm(
        "Unrestrict User",
        `Unrestrict ${name}?`,
        "Unrestrict"
    );
    if (!isConfirmed) return;
    try {
        const res = await fetch(`/api/users/unrestrict/${id}`, { method: 'PUT' });
        const data = await res.json();
        if (res.ok) {
            window.showToast(data.message);
            loadAllUsers();
        } else {
            window.showToast(data.message, "error");
        }
    } catch (e) { console.error(e); }
}
async function deleteReportedMessage(messageId) {
    const isConfirmed = await window.showConfirm(
        "Delete Message",
        "Are you sure you want to delete this message? This action is permanent.",
        "Delete"
    );
    if (!isConfirmed) return;

    try {
        // Reuse the existing chat delete endpoint
        const res = await fetch(`/api/chat/delete/${messageId}`, {
            method: 'PATCH'
        });
        
        const result = await res.json();

        if (res.ok) {
            window.showToast("Message deleted successfully.");
            closeMessageModal();
            // Optional: Reload reports if you want to reflect changes, 
            // though the report itself still exists (just pointing to deleted content now)
        } else {
            window.showToast("Failed to delete: " + result.message, "error");
        }
    } catch (e) {
        console.error(e);
        window.showToast("Network error while deleting.", "error");
    }
}
function openAnnouncementModal() {
    document.getElementById('AnnouncementModal').style.display = 'block';
}

function closeAnnouncementModal() {
    document.getElementById('AnnouncementModal').style.display = 'none';
    document.getElementById('AnnounceTitle').value = "";
    document.getElementById('AnnounceContent').value = "";
    document.getElementById('AnnounceMedia').value = "";
}

async function submitAnnouncement() {
    const title = document.getElementById('AnnounceTitle').value;
    const content = document.getElementById('AnnounceContent').value;
    const mediaFile = document.getElementById('AnnounceMedia').files[0];

    if (!title || !content) return alert("Title and Content are required.");
    const isConfirmed = await window.showConfirm(
        "Send Announcement",
        "This will notify ALL users.",
        "Send"
    );
    if (!isConfirmed) return;

    const btn = document.querySelector('#AnnouncementModal .btn-confirm');
    const originalText = btn.innerText;
    btn.innerText = "Posting...";
    btn.disabled = true;

    try {
        // 1. Fetch Current Admin Info to get their PFP
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) throw new Error("Auth check failed");
        const adminUser = await authRes.json();
        
        // Use their existing PFP or fallback to a generated avatar
        const adminPfp = adminUser.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(adminUser.name)}&background=random`;

        // 2. Prepare Data
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('isGlobal', 'true'); // Critical Flag
        formData.append('visibility', 'public');
        
        // SEND THE PFP AS 'authorProfile'
        formData.append('authorProfile', adminPfp); 

        if (mediaFile) formData.append('media', mediaFile);

        const res = await fetch('/api/posts/create', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            window.showToast("Global Announcement Posted!");
            closeAnnouncementModal();
            // Optional: Reload feed if on the same page
        } else {
            const data = await res.json();
            window.showToast("Failed: " + data.message, "error");
        }
    } catch (e) { 
        console.error(e); 
        window.showToast("Error posting announcement.", "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}


// ==========================================
// CREATE ACCOUNT LOGIC
// ==========================================

// 1. Toggle Club Dropdown (Admins don't need clubs)
function toggleClubSelect() {
    const role = document.getElementById('NewRole').value;
    const clubContainer = document.getElementById('ClubSelectContainer');
    const adminContainer = document.getElementById('AdminSelectContainer');
    
    // Hide club selection if creating an Admin
    if (role === 'Admin') {
        clubContainer.style.display = 'none';
        adminContainer.style.display = 'block';
        document.getElementById('NewClub').disabled = true;
        document.getElementById('NewClub').value = 'none';
        loadAdminUsers(); // Load admin users when Admin role is selected
    } else {
        clubContainer.style.display = 'block';
        adminContainer.style.display = 'none';
        document.getElementById('NewAdminSupervisor').value = '';
    }
}

// Load and populate admin users dropdown
async function loadAdminUsers() {
    const select = document.getElementById('NewAdminSupervisor');
    
    try {
        // Filter existing allUsers array for admins
        const admins = allUsers.filter(u => 
            u.usertype && u.usertype.toLowerCase() === 'admin'
        );
        
        // Clear existing options except the first one
        select.innerHTML = '<option value="">-- Select Admin --</option>';
        
        // Add current user first if they're an admin
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const currentUser = await res.json();
            if (currentUser.usertype === 'Admin') {
                const opt = document.createElement('option');
                opt.value = currentUser.name;
                opt.innerText = `${currentUser.name} (Current Admin)`;
                select.appendChild(opt);
            }
        }
        
        // Add other admins
        admins.forEach(admin => {
            const opt = document.createElement('option');
            opt.value = admin.name;
            opt.innerText = admin.name;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error("Error loading admin users:", e);
    }
}

// 2. Load Clubs from API
async function loadClubsForDropdown() {
    const select = document.getElementById('NewClub');
    if (select.options.length > 1) return; // Prevent re-fetching if already loaded

    try {
        const res = await fetch('/api/clubs'); // Assuming this endpoint exists
        if (!res.ok) throw new Error("Failed to load clubs");
        const clubs = await res.json();

        clubs.forEach(club => {
            const option = document.createElement('option');
            option.value = club.clubname; // Or club._id depending on your backend
            option.innerText = club.clubname;
            select.appendChild(option);
        });
    } catch (e) {
        console.error("Club Load Error:", e);
        const option = document.createElement('option');
        option.innerText = "Error loading clubs";
        select.appendChild(option);
    }
}

// 3. Submit New User
async function handleCreateUser(e) {
    e.preventDefault();
    
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = "Creating...";
    btn.disabled = true;

    // 1. Gather form data
    const userData = {
        name: document.getElementById('NewName').value,
        email: document.getElementById('NewEmail').value,
        password: document.getElementById('NewPassword').value,
        usertype: document.getElementById('NewRole').value,
        club: document.getElementById('NewClub').value,
        
        // Add admin supervisor if creating an Admin account
        ...(document.getElementById('NewRole').value === 'Admin' && {
            adminSupervisor: document.getElementById('NewAdminSupervisor').value
        }),
        
        // --- BYPASS FLAG ---
        // This tells the backend to skip sending/checking OTP codes
        skipVerification: true 
    };

    try {
        // 2. Send to Registration API
        const res = await fetch('/api/auth/register', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await res.json();

        if (res.ok) {
            window.showToast(`✅ Account Created Successfully!\nVerification bypassed for ${userData.name}.`);
            document.getElementById('CreateUserForm').reset();
            toggleClubSelect(); 
        } else {
            window.showToast("Registration Failed: " + data.message, "error");
        }

    } catch (error) {
        console.error("Admin Registration Error:", error);
        window.showToast("Network Error: Could not reach the registration server.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
function previewClubLogo(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('ClubModalPreview');
            if (preview) {
                preview.src = e.target.result; // Updates the <img> src
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}
async function deleteClub(id, name, memberCount) {
    // 1. Safety Check: Don't delete clubs with members
    if (memberCount > 0) {
        window.showToast(`Cannot delete "${name}". You must remove or reassign the ${memberCount} members first.`, "error");
        return;
    }

    // 2. Confirmation
    const confirmation = await window.showConfirm(
        "Delete Club",
        `Are you sure you want to permanently delete the club "${name}"? This action cannot be undone.`,
        "Delete"
    );
    if (!confirmation) return;

    try {
        const res = await fetch(`/api/clubs/delete/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            window.showToast(`✅ Club "${name}" has been removed.`);
            loadClubManagementList(); // Refresh the table
        } else {
            const data = await res.json();
            window.showToast("Delete failed: " + data.message, "error");
        }
    } catch (e) {
        console.error("Delete Error:", e);
        window.showToast("Server error occurred while deleting the club.", "error");
    }
}
let currentClubCategory = new Set(); // Temporarily hold tags for the current modal

function toggleClubCategory(btn, tag) {
    if (currentClubCategory.has(tag)) {
        currentClubCategory.delete(tag);
        btn.classList.remove('selected'); // Uses your existing .selected class
    } else {
        currentClubCategory.add(tag);
        btn.classList.add('selected');
    }
}
function toggleClubTag(btn, tag) {
    // 1. Check if the tag is already in our Set
    if (currentClubCategory.has(tag)) {
        currentClubCategory.delete(tag);
        btn.classList.remove('selected'); // Visual feedback: remove red/active state
    } else {
        currentClubCategory.add(tag);
        btn.classList.add('selected'); // Visual feedback: add red/active state
    }
}

// ==========================================
// PROFILE SETTINGS
// ==========================================
let currentAdminUser = null;

async function openProfileSettings() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error("Failed to load user");
        
        currentAdminUser = await res.json();
        
        // Populate modal
        document.getElementById('AdminNameDisplay').innerText = currentAdminUser.name;
        const previewImg = document.getElementById('ProfilePreview');
        previewImg.src = currentAdminUser.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentAdminUser.name) + '&background=fa3737&color=fff';
        
        // Show modal
        document.getElementById('ProfileSettingsModal').style.display = 'flex';
    } catch (error) {
        console.error("Error opening profile settings:", error);
        window.showToast("Failed to load profile.", "error");
    }
}

function closeProfileSettings() {
    document.getElementById('ProfileSettingsModal').style.display = 'none';
}

async function uploadProfilePicture() {
    const fileInput = document.getElementById('ProfilePictureInput');
    if (!fileInput.files || fileInput.files.length === 0) {
        window.showToast("Please select an image.", "error");
        return;
    }

    const formData = new FormData();
    formData.append('avatar', fileInput.files[0]);

    try {
        const btn = event.target;
        btn.disabled = true;
        btn.innerText = 'Uploading...';

        const res = await fetch('/api/users/upload-avatar', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) throw new Error("Upload failed");
        
        const data = await res.json();
        
        // Update preview
        document.getElementById('ProfilePreview').src = data.newUrl + '?t=' + Date.now();
        
        window.showToast("✅ Profile picture updated! Your announcements will use this new picture.");
        
        // Close modal
        closeProfileSettings();
    } catch (error) {
        console.error("Upload error:", error);
        window.showToast("❌ Failed to upload picture: " + error.message, "error");
    } finally {
        const btn = event.target;
        btn.disabled = false;
        btn.innerText = 'Save Picture';
    }
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('ProfileSettingsModal');
    const previewFull = document.getElementById('DocPreviewFull');
    const postModal = document.getElementById('PostModal');
    
    // THE FIX: If the user is clicking INSIDE the preview container, do NOT close
    if (e.target.closest('#PreviewContainer')) return; 

    if (e.target === modal) closeProfileSettings();
    if (e.target === previewFull) window.closeDocPreview();
    if (e.target === postModal) closePostModal();
});
function openCreateClubModal() {
    selectedAdvisers = [];
    renderAdviserTags('create');
    document.getElementById('ClubCreateModal').style.display = 'block';
}

function closeCreateClubModal() {
    document.getElementById('ClubCreateModal').style.display = 'none';
    document.getElementById('CreateClubForm').reset();
}

async function submitNewClub(e) {
    e.preventDefault();

    const clubname = document.getElementById('CreateClubName').value.trim();
    const category = document.getElementById('CreateClubCategory').value;
    const adviser = document.getElementById('CreateClubAdviser').value || null;

    if (!clubname) return window.showToast("Please provide a club name.", "error");

    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerText = "Creating...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/clubs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clubname, category, advisers: selectedAdvisers })
        });

        const data = await res.json();

        if (res.ok) {
            window.showToast("✅ Organization created successfully!");
            closeCreateClubModal();
            loadClubManagementList(); // Refresh the table
        } else {
            window.showToast("❌ Failed: " + (data.message || "Unknown error"), "error");
        }
    } catch (error) {
        console.error("Create Club Error:", error);
        window.showToast("Server error. Check console.", "error");
    } finally {
        btn.innerText = "Create Organization";
        btn.disabled = false;
    }
}

// ==========================================
// SYSTEM ACTIONS & END OF YEAR RESET
// ==========================================

function openResetStudentClubsModal() {
    document.getElementById('ResetStudentClubsModal').style.display = 'block';
}

function closeResetStudentClubsModal() {
    document.getElementById('ResetStudentClubsModal').style.display = 'none';
}

async function submitResetStudentClubs() {
    const confirmText = document.getElementById('ResetConfirmInput').value;
    
    if (confirmText.toLowerCase() !== 'reset all') {
        window.showToast("❌ Please type 'reset all' to confirm this action.", "error");
        return;
    }

    const btn = event.target;
    btn.innerText = "Resetting...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/clubs/reset-students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();

        if (res.ok) {
            window.showToast(`✅ ${data.studentsRemoved} students have been removed from all organizations!\n\nAdvisers and moderators were NOT affected.`);
            closeResetStudentClubsModal();
            loadClubManagementList(); // Refresh the club list
        } else {
            window.showToast("❌ Error: " + (data.message || "Failed to reset clubs"), "error");
        }
    } catch (error) {
        console.error("Reset Error:", error);
        window.showToast("❌ Server error: " + error.message, "error");
    } finally {
        btn.innerText = "Confirm Reset";
        btn.disabled = false;
        document.getElementById('ResetConfirmInput').value = "";
    }
}
let allDocs = []; // Global array to store documents for local filtering

async function loadAdminDocs() {
    const tbody = document.getElementById('AdminDocTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/admin/documents/all');
        allDocs = await res.json();
        
        // Trigger the filter and render function immediately after fetching
        filterAndSortDocs(); 
    } catch (e) {
        console.error("Load Docs Error:", e);
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:red;'>Error loading documents.</td></tr>";
    }
}

// NEW: Master filter & sort logic
window.filterAndSortDocs = function() {
    const searchTerm = (document.getElementById('DocSearchInput').value || '').toLowerCase();
    const statusFilter = document.getElementById('DocStatusFilter').value || 'all';
    const sortBy = document.getElementById('DocSortBy').value || 'newest';

    // 1. Apply Search and Filter
    let filteredDocs = allDocs.filter(doc => {
        const matchesSearch = doc.clubName.toLowerCase().includes(searchTerm) || 
                              doc.fileName.toLowerCase().includes(searchTerm) || 
                              doc.purpose.toLowerCase().includes(searchTerm);
        
        const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    // 2. Apply Sorting
    filteredDocs.sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt || 0) < new Date(a.createdAt || 0) ? 1 : -1;
        if (sortBy === 'oldest') return new Date(a.createdAt || 0) < new Date(b.createdAt || 0) ? -1 : 1;
        if (sortBy === 'name_asc') return a.clubName.localeCompare(b.clubName);
        return 0;
    });

    // 3. Render
    renderDocsTable(filteredDocs);
};

// NEW: Extracted rendering logic
function renderDocsTable(docs) {
    const tbody = document.getElementById('AdminDocTableBody');
    if (!tbody) return;

    if (docs.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No documents match your search criteria.</td></tr>";
        return;
    }

    tbody.innerHTML = docs.map(doc => {
        const isApproved = doc.status === 'approved';
        const statusClass = isApproved ? 'badge-resolved' : 
                            doc.status === 'rejected' ? 'badge-restricted' : 'badge-pending';
        
        let actionButtons = `
            <button class="btn-action btn-unrestrict" 
                    onclick="window.viewDocumentForReview('${doc._id}', '${doc.fileUrl}', '${doc.fileName}', '${doc.status}')">
                <i class='bx bx-show'></i> ${isApproved ? 'View Original' : 'View & Review'}
            </button>`;

        if (isApproved && doc.signedFileUrl) {
            actionButtons += `
                <button class="btn-action" style="background:#fa3737; color:white; margin-left:5px;"
                        onclick="window.viewDocument('${doc.signedFileUrl}', 'SIGNED-${doc.fileName}')">
                    <i class='bx bxs-file-pdf'></i> View Signed
                </button>`;
        }
        
        return `
            <tr>
                <td><strong>${doc.clubName}</strong></td>
                <td><strong>${doc.purpose}</strong><br><small style="color:#888;">${doc.fileName}</small></td>
                <td>${doc.submittedBy} <br><small>${doc.uploaderRole}</small></td>
                <td><span class="badge ${statusClass}">${doc.status.toUpperCase()}</span></td>
                <td>
                    <div style="display:flex; gap:5px;">
                        ${actionButtons}
                    </div>
                </td>
            </tr>`;
    }).join('');
}

window.switchTab = function(tabName) {
    console.log("Switching to tab:", tabName); // Debugging line

    // 1. Reset all tabs and sections
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.table-card').forEach(card => card.style.display = 'none');

    // 2. Map tab names to their specific IDs
    const tabMap = {
        'users': { btn: 'TabUsers', section: 'UsersSection', loader: loadAllUsers },
        'reports': { btn: 'TabReports', section: 'ReportsSection', loader: loadReports },
        'create': { btn: 'TabCreate', section: 'CreateSection', loader: loadClubsForDropdown },
        'clubs': { btn: 'TabClubs', section: 'ClubsSection', loader: loadClubManagementList },
        'system': { btn: 'TabSystem', section: 'SystemSection', loader: null },
        'docs': { btn: 'TabDocs', section: 'DocsSection', loader: loadAdminDocs }
    };

    const target = tabMap[tabName];

    if (target) {
        const btn = document.getElementById(target.btn);
        const section = document.getElementById(target.section);

        if (btn && section) {
            btn.classList.add('active');
            section.style.display = 'block';
            if (target.loader) target.loader(); // Trigger the data fetch
        } else {
            console.error(`Missing DOM elements: ${target.btn} or ${target.section}`);
        }
    }
};
window.viewDocumentForReview = function(docId, url, fileName, status) {
    // Open the standard document viewer
    window.viewDocument(url, fileName);

    const actionBar = document.getElementById('AdminActionBar');
    const approveBtn = document.getElementById('BtnModalApprove');
    const rejectBtn = document.getElementById('BtnModalReject');

    // --- DEBUG MODE: Always show action bar regardless of status ---
    if (actionBar) {
        actionBar.style.display = 'flex'; 
        
        approveBtn.onclick = (e) => {
            // Prevent the click from bubbling up to the modal backdrop
            e.stopPropagation(); 
            // Trigger the signing placement logic
            window.processDocument(docId, 'approved'); 
        };

        rejectBtn.onclick = (e) => {
            e.stopPropagation();
            // Rejections close the modal as per your existing workflow
            window.closeDocPreview();
            // Trigger the rejection logic (Note: Ensure 'window.Document' isn't a typo in your file)
            window.processDocument(docId, 'rejected'); 
        };
    }
};
window.openSignatureModal = async function() {
    try {
        const res = await fetch('/api/auth/me');
        const user = await res.json();
        const preview = document.getElementById('CurrentSignaturePreview');
        
        // --- THE FIX: Match field names exactly with server.js response ---
        // Your server.js line 238 returns 'eSignature' (lowercase 'e')
        const sigPath = user.eSignature || user.Signature; 

        if (user.hasSignature && sigPath) {
            // Remove any leftover '/public' from the string just in case
            const cleanPath = sigPath.replace('/public', '');
            preview.src = cleanPath + '?t=' + Date.now(); 
        } else {
            preview.src = "/uploads/no-signature.png"; 
        }

        document.getElementById('SignatureModal').style.display = 'block';
    } catch (e) { console.error("Modal Error:", e); }
};
window.closeSignatureModal = function() {
    document.getElementById('SignatureModal').style.display = 'none';
    document.getElementById('SignatureInput').value = "";
};

window.previewNewSignature = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('CurrentSignaturePreview').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};
let signaturePad, ctx, drawing = false;
let signatureMode = 'upload'; // Default mode

window.setSignatureMode = function(mode) {
    signatureMode = mode;
    document.getElementById('UploadSignatureSection').style.display = mode === 'upload' ? 'block' : 'none';
    document.getElementById('DrawSignatureSection').style.display = mode === 'draw' ? 'block' : 'none';
    
    // UI Tab toggle
    document.getElementById('TabUploadMode').classList.toggle('active', mode === 'upload');
    document.getElementById('TabDrawMode').classList.toggle('active', mode === 'draw');
    
    if (mode === 'draw') initSignaturePad();
};

function initSignaturePad() {
    signaturePad = document.getElementById('SignaturePad');
    ctx = signaturePad.getContext('2d');
    ctx.strokeStyle = "#000"; // Black ink
    ctx.lineWidth = 2;
    
    // Mouse Events for Drawing
    signaturePad.addEventListener('mousedown', (e) => { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); });
    signaturePad.addEventListener('mousemove', (e) => { if(drawing) { ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); } });
    signaturePad.addEventListener('mouseup', () => { drawing = false; });
}

window.clearSignaturePad = function() {
    ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
};
window.saveAdminSignature = async function() {
    const formData = new FormData();
    const btn = document.getElementById('BtnSaveSignature');
    btn.innerText = "Saving...";
    btn.disabled = true;

    if (signatureMode === 'upload') {
        const file = document.getElementById('SignatureInput').files[0];
        if (!file) return alert("Please select a PNG file.");
        formData.append('signature', file);
    } else {
        // Convert Canvas to Blob
        const blob = await new Promise(resolve => signaturePad.toBlob(resolve, 'image/png'));
        formData.append('signature', blob, 'signature.png');
    }

    try {
        const res = await fetch('/api/admin/save-signature', { method: 'POST', body: formData });
        if (res.ok) {
            window.showToast("✅ Signature saved successfully!");
            closeSignatureModal();
        } else {
            window.showToast("❌ Failed to save signature.", "error");
        }
    } catch (e) {
        console.error(e);
    } finally {
        btn.innerText = "Save Signature";
        btn.disabled = false;
    }
};
window.processDocument = async function(docId, status) {
    if (status === 'approved') {
        const authRes = await fetch('/api/auth/me');
        const user = await authRes.json();
        
        if (!user.hasSignature) {
            window.showToast("❌ You haven't set a signature yet.", "error");
            window.openSignatureModal();
            return;
        }

        // --- THE FIX: Clean the path to ensure it starts with /uploads ---
        let sigUrl = user.eSignature || user.Signature;
        if (sigUrl) sigUrl = sigUrl.replace('/public', ''); 

        startSignaturePlacement(docId, sigUrl);
    } else {
        // ... (Existing rejection logic with prompt)
    }
};

function startSignaturePlacement(docId, sigUrl) {
    // Select ALL generated pages instead of just one
    const wrappers = document.querySelectorAll('.pdf-page-wrapper');
    if (wrappers.length === 0) return window.showToast("❌ Error: Document pages not found.", "error");

    const cleanSigUrl = sigUrl.startsWith('/public') ? sigUrl.replace('/public', '') : sigUrl;

    // Apply overlay logic to every page
    wrappers.forEach(wrapper => {
        wrapper.style.position = 'relative';

        const overlay = document.createElement('div');
        overlay.className = "SignaturePlacementOverlay";
        overlay.style = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; cursor: crosshair; background: rgba(250, 55, 55, 0.05);`;
        wrapper.appendChild(overlay);

        const ghostSig = document.createElement('img');
        ghostSig.src = cleanSigUrl;
        ghostSig.className = "GhostSignature";
        ghostSig.style = `position: absolute; width: 150px; opacity: 0.6; pointer-events: none; z-index: 10001; border: 1px dashed #fa3737; transform: translate(-50%, -50%); display: none;`;
        wrapper.appendChild(ghostSig);

        overlay.addEventListener('mousemove', (e) => {
            const rect = wrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Hide ghost signatures on all OTHER pages while hovering over this one
            document.querySelectorAll('.GhostSignature').forEach(g => g.style.display = 'none');

            ghostSig.style.display = 'block';
            ghostSig.style.left = x + 'px';
            ghostSig.style.top = y + 'px';
        });

        overlay.addEventListener('mouseleave', () => {
            ghostSig.style.display = 'none';
        });

        overlay.onclick = (e) => {
            e.stopPropagation();
            const rect = wrapper.getBoundingClientRect();
            
            const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
            const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
            
            // Extract the page number from the wrapper we clicked on
            const pageNum = parseInt(wrapper.dataset.page) || 1;

            // Cleanup ALL overlays
            document.querySelectorAll('.SignaturePlacementOverlay, .GhostSignature').forEach(el => el.remove());

            setTimeout(async () => {
                const isConfirmed = await window.showConfirm(
                    "Confirm Signature",
                    `Confirm signature placement on Page ${pageNum}?`,
                    "Confirm"
                );
                if (isConfirmed) {
                    // Pass the specific pageNum to the finalize function
                    finalizeSignature(docId, xPercent, yPercent, pageNum);
                } else {
                    startSignaturePlacement(docId, sigUrl); 
                }
            }, 50);
        };
    });
}

// Ensure finalizeSignature accepts the pageNum parameter
async function finalizeSignature(docId, x, y, pageNum) {
    try {
        const res = await fetch(`/api/admin/documents/${docId}/sign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y, page: pageNum }) // Sending the correct page to backend
        });

        const data = await res.json();
        if (data.success) {
            window.showToast("✅ " + data.message);
            window.closeDocPreview();
            loadAdminDocs(); 
        } else {
            window.showToast("❌ Error: " + data.message, "error");
        }
    } catch (err) {
        console.error("Finalize Error:", err);
        window.showToast("Failed to finalize document.", "error");
    }
}
function updatePreviewFromCanvas() {
    const signaturePad = document.getElementById('SignaturePad');
    const previewImg = document.getElementById('CurrentSignaturePreview');
    // This generates a data:image/png;base64 string directly
    previewImg.src = signaturePad.toDataURL("image/png"); 
}

// Update your initSignaturePad to trigger this on 'mouseup'
function initSignaturePad() {
    signaturePad = document.getElementById('SignaturePad');
    ctx = signaturePad.getContext('2d');
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;

    const getPos = (e) => {
        const rect = signaturePad.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e) => { 
        drawing = true; 
        const pos = getPos(e);
        ctx.beginPath(); 
        ctx.moveTo(pos.x, pos.y); 
        if (e.touches) e.preventDefault(); // Stop scrolling while drawing
    };

    const move = (e) => { 
        if (!drawing) return;
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y); 
        ctx.stroke(); 
    };

    const stop = () => { 
        drawing = false; 
        updatePreviewFromCanvas(); 
    };

    // Mouse Listeners
    signaturePad.onmousedown = start;
    signaturePad.onmousemove = move;
    signaturePad.onmouseup = stop;

    // Touch Listeners
    signaturePad.ontouchstart = start;
    signaturePad.ontouchmove = move;
    signaturePad.ontouchend = stop;
}
window.clearSignaturePad = function() {
    if (!ctx) return;
    ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
    // THE FIX: Correct path
    document.getElementById('CurrentSignaturePreview').src = "/uploads/no-signature.png"; 
};
window.openAdviserModal = function(target) {
    activeAdviserTarget = target; // 'edit' or 'create'
    allStaff = allUsers.filter(u => u.usertype === 'Teacher' || u.usertype === 'Admin');
    
    populateAdviserList();
    document.getElementById('SetAdviserModal').style.display = 'block';
    document.getElementById('AdviserSearchInput').value = '';
};

function closeAdviserModal() { document.getElementById('SetAdviserModal').style.display = 'none'; }
function populateAdviserList(searchTerm = '') {
    const container = document.getElementById('AdviserListContainer');
    const filtered = allStaff.filter(staff => staff.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filtered.length === 0) return container.innerHTML = '<div style="padding: 15px; text-align: center; color: #888;">No staff found</div>';
    
    container.innerHTML = filtered.map(staff => {
        const isSelected = selectedAdvisers.includes(staff.name);
        return `
        <div style="padding: 12px 15px; border-bottom: 1px solid #eee; cursor: pointer; background: ${isSelected ? '#ffeeee' : 'white'}; display: flex; align-items: center;" 
             onclick="toggleAdviser('${staff.name}')">
            <input type="checkbox" ${isSelected ? 'checked' : ''} style="margin-right: 15px; pointer-events: none; width: 18px; height: 18px;">
            <div>
                <strong style="color: ${isSelected ? '#fa3737' : '#333'}">${staff.name}</strong>
                <small style="color: #aaa; display: block; font-size: 0.8rem;">${staff.usertype}</small>
            </div>
        </div>
    `}).join('');
}

window.filterAdviserList = function() { populateAdviserList(document.getElementById('AdviserSearchInput').value); };

window.toggleAdviser = function(name) {
    if(selectedAdvisers.includes(name)) {
        selectedAdvisers = selectedAdvisers.filter(n => n !== name);
    } else {
        selectedAdvisers.push(name);
    }
    populateAdviserList(document.getElementById('AdviserSearchInput').value); // Re-render visually
};

window.confirmAdviserSelection = function() {
    renderAdviserTags(activeAdviserTarget);
    closeAdviserModal();
};

function renderAdviserTags(target) {
    const container = document.getElementById(target === 'edit' ? 'EditAdvisersList' : 'CreateAdvisersList');
    if (selectedAdvisers.length === 0) {
        container.innerHTML = '<span style="color:#888; font-size: 0.9rem;">No advisers selected...</span>';
        return;
    }
    container.innerHTML = selectedAdvisers.map(name => `
        <span class="badge" style="background: #fa3737; color: white; padding: 6px 12px; border-radius: 15px; font-size: 0.85rem; display:flex; align-items:center; gap:8px;">
            ${name} <i class='bx bx-x' style="cursor:pointer; font-size: 1.2rem;" onclick="removeAdviserTag('${name}', '${target}')"></i>
        </span>
    `).join('');
}

window.removeAdviserTag = function(name, target) {
    selectedAdvisers = selectedAdvisers.filter(n => n !== name);
    renderAdviserTags(target);
};