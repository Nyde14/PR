let allUsers = []; // Store users locally for filtering
let currentTargetId = null;

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // 1. Check Auth & Admin Status
        const response = await fetch('/api/auth/me');
        if (!response.ok) throw new Error("Unauthorized");
        const user = await response.json();

        if (user.usertype !== 'Admin') {
            alert("Access Denied: Admins Only.");
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
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.table-card').forEach(card => card.style.display = 'none');

    if (tabName === 'users') {
        document.getElementById('TabUsers').classList.add('active');
        document.getElementById('UsersSection').style.display = 'block';
        loadAllUsers();
    } else if (tabName === 'reports') {
        document.getElementById('TabReports').classList.add('active');
        document.getElementById('ReportsSection').style.display = 'block';
        loadReports();
    } else if (tabName === 'clubs') {
        document.getElementById('TabClubs').classList.add('active');
        document.getElementById('ClubsSection').style.display = 'block';
        loadClubManagementList(); // New function
    } else if (tabName === 'create') {
        document.getElementById('TabCreate').classList.add('active');
        document.getElementById('CreateSection').style.display = 'block';
        loadClubsForDropdown();
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

            return `
            <tr>
                <td><img src="${logo}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #eee;"></td>
                <td>
                    <strong>${club.clubname}</strong><br>
                    <small style="color:#888;">${categoryText}</small>
                </td>
                <td>${club.adviser || '<span style="color:#888;">Unassigned</span>'}</td>
                <td><span class="badge badge-active">${memberCount} Members</span></td>
                <td>
                    <button onclick="openClubModal('${club._id}', '${club.clubname}', '${club.adviser}')" 
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
async function openClubModal(id = null, name = '', adviser = 'none') {
    editingClubId = id;
    
    document.getElementById('ClubModalTitle').innerText = id ? 'Edit Club Settings' : 'Add New Organization';
    document.getElementById('EditClubName').value = name;
    
    // Find club data in the global array
    const clubData = allClubs.find(c => c._id === id);
    
    // Clear and reset category
    currentClubCategory.clear();
    
    if (clubData && clubData.category) {
        // Handle category as a string (not array)
        if (typeof clubData.category === 'string') {
            currentClubCategory.add(clubData.category);
        } else if (Array.isArray(clubData.category)) {
            clubData.category.forEach(cat => currentClubCategory.add(cat));
        }
    }
    
    document.querySelectorAll('#EditClubTags .filter-tag').forEach(btn => {
        if (currentClubCategory.has(btn.innerText)) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    const previewImg = document.getElementById('ClubModalPreview');
    
    // THE FIX: Direct fallback logic for the preview
    let currentLogo = '/uploads/default_pfp.png';
    if (clubData) {
        currentLogo = (clubData.branding && clubData.branding.logo) 
            ? clubData.branding.logo 
            : (clubData.logo || currentLogo);
    }
    previewImg.src = currentLogo; 

    // Populate adviser dropdown with both Teachers and Admins
    const select = document.getElementById('EditClubAdviser');
    select.innerHTML = '<option value="">-- Keep Unchanged --</option>';
    
    const staff = allUsers.filter(u => u.usertype === 'Teacher' || u.usertype === 'Admin');
    staff.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.innerText = `${s.name} (${s.usertype})`; 
        if (s.name === adviser) opt.selected = true;
        select.appendChild(opt);
    });

    document.getElementById('ClubEditModal').style.display = 'block';
}

function closeClubModal() {
    document.getElementById('ClubEditModal').style.display = 'none';
    editingClubId = null;
}

// 4. Save Club Data
async function saveClubData() {
    

    const clubName = document.getElementById('EditClubName').value;
    const adviser = document.getElementById('EditClubAdviser').value;
    const logoFile = document.getElementById('EditClubLogo').files[0];

    const formData = new FormData();
    formData.append('clubId', editingClubId);
    formData.append('clubname', clubName);
    
    // Only send adviser if one was selected (not empty/unchanged)
    if (adviser && adviser.trim()) {
        formData.append('adviser', adviser);
    }
    
    // Save category as a single string (first selected tag)
    const categoriesArray = Array.from(currentClubCategory);
    const categoryString = categoriesArray.length > 0 ? categoriesArray[0] : 'Organization';
    formData.append('category', categoryString);

    if (logoFile) formData.append('logo', logoFile);

    try {
        const res = await fetch('/api/clubs/update-branding', { method: 'PATCH', body: formData });
        if (res.ok) {
            alert("✅ Club updated!");
            closeClubModal();
            loadClubManagementList();
        } else {
            const error = await res.json();
            alert(`❌ Error: ${error.message || 'Failed to update club'}`);
        }
    } catch (e) { 
        console.error(e);
        alert(`❌ Error: ${e.message}`);
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

function renderTable(users) {
    const tbody = document.getElementById('UserTableBody');
    tbody.innerHTML = "";

    if (users.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>No users found.</td></tr>";
        return;
    }

    users.forEach(user => {
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
}

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
    if(!confirm(`Mark report as ${status}?`)) return;
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

        if (result.type === 'Deleted') {
            alert(result.message);
            return;
        }

        if (result.type === 'Post') {
            window.open(result.url, '_blank');
        } 
        else if (result.type === 'Message') {
            openMessageModal(result.data);
        }
        // NEW: Handle Comments and Replies
        else if (result.type === 'Comment' || result.type === 'Reply') {
            openCommentModal(result.data, result.type);
        }

    } catch (e) { console.error(e); alert("Error retrieving content."); }
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
    if (!confirm(`Permanently delete this ${type}?`)) return;

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
            alert("Deleted successfully.");
            closeReviewModal();
            loadReports(); // Refresh table
        } else {
            alert("Failed to delete.");
        }
    } catch (e) { console.error(e); }
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

    if (!reason.trim()) return alert("Reason is required.");

    try {
        const res = await fetch(`/api/users/restrict/${currentTargetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration, reason })
        });
        
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            closeRestrictModal();
            loadAllUsers(); 
        } else {
            alert(data.message);
        }
    } catch (e) {
        console.error(e);
    }
}

async function unrestrictUser(id, name) {
    if (!confirm(`Unrestrict ${name}?`)) return;
    try {
        const res = await fetch(`/api/users/unrestrict/${id}`, { method: 'PUT' });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadAllUsers();
        } else {
            alert(data.message);
        }
    } catch (e) { console.error(e); }
}
async function deleteReportedMessage(messageId) {
    if (!confirm("Are you sure you want to delete this message? This action is permanent.")) return;

    try {
        // Reuse the existing chat delete endpoint
        const res = await fetch(`/api/chat/delete/${messageId}`, {
            method: 'PATCH'
        });
        
        const result = await res.json();

        if (res.ok) {
            alert("Message deleted successfully.");
            closeMessageModal();
            // Optional: Reload reports if you want to reflect changes, 
            // though the report itself still exists (just pointing to deleted content now)
        } else {
            alert("Failed to delete: " + result.message);
        }
    } catch (e) {
        console.error(e);
        alert("Network error while deleting.");
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
    if (!confirm("Are you sure? This will notify ALL users.")) return;

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
            alert("Global Announcement Posted!");
            closeAnnouncementModal();
            // Optional: Reload feed if on the same page
        } else {
            const data = await res.json();
            alert("Failed: " + data.message);
        }
    } catch (e) { 
        console.error(e); 
        alert("Error posting announcement.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
function switchTab(tabName) {
    // 1. Reset Tabs & Sections
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.table-card').forEach(card => card.style.display = 'none');

    // 2. Activate Selection
    if (tabName === 'users') {
        document.getElementById('TabUsers').classList.add('active');
        document.getElementById('UsersSection').style.display = 'block';
        loadAllUsers();
    } else if (tabName === 'reports') {
        document.getElementById('TabReports').classList.add('active');
        document.getElementById('ReportsSection').style.display = 'block';
        loadReports();
    } else if (tabName === 'create') {
        document.getElementById('TabCreate').classList.add('active');
        document.getElementById('CreateSection').style.display = 'block';
        loadClubsForDropdown(); // Fetch clubs when tab opens
    } else if (tabName === 'clubs') {
        document.getElementById('TabClubs').classList.add('active');
        document.getElementById('ClubsSection').style.display = 'block';
        loadClubManagementList();
    } else if (tabName === 'system') {
        document.getElementById('TabSystem').classList.add('active');
        document.getElementById('SystemSection').style.display = 'block';
    }
}

// ==========================================
// CREATE ACCOUNT LOGIC
// ==========================================

// 1. Toggle Club Dropdown (Admins don't need clubs)
function toggleClubSelect() {
    const role = document.getElementById('NewRole').value;
    const container = document.getElementById('ClubSelectContainer');
    // Hide club selection if creating an Admin
    if (role === 'Admin') {
        container.style.opacity = '0.5';
        document.getElementById('NewClub').disabled = true;
        document.getElementById('NewClub').value = 'none';
    } else {
        container.style.opacity = '1';
        document.getElementById('NewClub').disabled = false;
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
            alert(`✅ Account Created Successfully!\nVerification bypassed for ${userData.name}.`);
            document.getElementById('CreateUserForm').reset();
            toggleClubSelect(); 
        } else {
            alert("Registration Failed: " + data.message);
        }

    } catch (error) {
        console.error("Admin Registration Error:", error);
        alert("Network Error: Could not reach the registration server.");
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
        alert(`Cannot delete "${name}". You must remove or reassign the ${memberCount} members first.`);
        return;
    }

    // 2. Confirmation
    const confirmation = confirm(`Are you sure you want to permanently delete the club "${name}"? This action cannot be undone.`);
    if (!confirmation) return;

    try {
        const res = await fetch(`/api/clubs/delete/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            alert(`✅ Club "${name}" has been removed.`);
            loadClubManagementList(); // Refresh the table
        } else {
            const data = await res.json();
            alert("Delete failed: " + data.message);
        }
    } catch (e) {
        console.error("Delete Error:", e);
        alert("Server error occurred while deleting the club.");
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
        alert("Failed to load profile.");
    }
}

function closeProfileSettings() {
    document.getElementById('ProfileSettingsModal').style.display = 'none';
}

async function uploadProfilePicture() {
    const fileInput = document.getElementById('ProfilePictureInput');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert("Please select an image.");
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
        
        alert("✅ Profile picture updated! Your announcements will use this new picture.");
        
        // Close modal
        closeProfileSettings();
    } catch (error) {
        console.error("Upload error:", error);
        alert("❌ Failed to upload picture: " + error.message);
    } finally {
        const btn = event.target;
        btn.disabled = false;
        btn.innerText = 'Save Picture';
    }
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('ProfileSettingsModal');
    if (e.target === modal) closeProfileSettings();
});
function openCreateClubModal() {
    // 1. Populate Adviser Dropdown from the global allUsers array
    const select = document.getElementById('CreateClubAdviser');
    select.innerHTML = '<option value="">-- Optional: Select Later --</option>';
    
    // Filter for staff members who can lead a club
    const staff = allUsers.filter(u => u.usertype === 'Teacher' || u.usertype === 'Admin');
    staff.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.innerText = `${s.name} (${s.usertype})`;
        select.appendChild(opt);
    });

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

    if (!clubname) return alert("Please provide a club name.");

    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerText = "Creating...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/clubs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clubname, category, adviser })
        });

        const data = await res.json();

        if (res.ok) {
            alert("✅ Organization created successfully!");
            closeCreateClubModal();
            loadClubManagementList(); // Refresh the table
        } else {
            alert("❌ Failed: " + (data.message || "Unknown error"));
        }
    } catch (error) {
        console.error("Create Club Error:", error);
        alert("Server error. Check console.");
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
        alert("❌ Please type 'reset all' to confirm this action.");
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
            alert(`✅ ${data.studentsRemoved} students have been removed from all organizations!\n\nAdvisers and moderators were NOT affected.`);
            closeResetStudentClubsModal();
            loadClubManagementList(); // Refresh the club list
        } else {
            alert("❌ Error: " + (data.message || "Failed to reset clubs"));
        }
    } catch (error) {
        console.error("Reset Error:", error);
        alert("❌ Server error: " + error.message);
    } finally {
        btn.innerText = "Confirm Reset";
        btn.disabled = false;
        document.getElementById('ResetConfirmInput').value = "";
    }
}