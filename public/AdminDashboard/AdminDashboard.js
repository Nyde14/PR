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
    // 1. Reset Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.table-card').forEach(card => card.style.display = 'none');

    // 2. Activate Selection
    if (tabName === 'users') {
        document.getElementById('TabUsers').classList.add('active');
        document.getElementById('UsersSection').style.display = 'block';
        loadAllUsers(); // Refresh users
    } else if (tabName === 'reports') {
        document.getElementById('TabReports').classList.add('active');
        document.getElementById('ReportsSection').style.display = 'block';
        loadReports(); // Fetch reports
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
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Loading...</td></tr>";

    try {
        const res = await fetch('/api/reports/all');
        const reports = await res.json();

        if(reports.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No reports found.</td></tr>";
            return;
        }

        tbody.innerHTML = reports.map(r => {
            let statusClass = 'badge-pending';
            if(r.status === 'Resolved') statusClass = 'badge-resolved';
            if(r.status === 'Dismissed') statusClass = 'badge-dismissed';

            return `
            <tr>
                <td><strong>${r.targetType}</strong></td>
                <td>${r.reporter}</td>
                <td>${r.reason}</td>
                <td><span class="badge ${statusClass}">${r.status}</span></td>
                <td>
                    <button onclick="viewReportedContent('${r._id}')" class="btn-action" style="background:#17a2b8; color:white; margin-right:5px;" title="View Content">👁️</button>

                    ${r.status === 'Pending' ? `
                        <button onclick="resolveReport('${r._id}', 'Resolved')" class="btn-confirm" style="font-size:0.8rem;">Resolve</button>
                        <button onclick="resolveReport('${r._id}', 'Dismissed')" class="btn-cancel" style="font-size:0.8rem;">Dismiss</button>
                    ` : `<span style="font-size:0.8rem; color:#888;">By: ${r.resolvedBy}</span>`}
                </td>
            </tr>
        `}).join('');
    } catch(e) { console.error(e); }
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
        // Fetch data from our new smart endpoint
        const res = await fetch(`/api/reports/${reportId}/view`);
        const result = await res.json();

        // CASE 1: Content was deleted
        if (result.type === 'Deleted') {
            alert(result.message);
            return;
        }

        // CASE 2: It's a POST -> Redirect (Existing behavior)
        if (result.type === 'Post') {
            window.open(result.url, '_blank');
        }

        // CASE 3: It's a MESSAGE -> Open Modal (New behavior)
        if (result.type === 'Message') {
            openMessageModal(result.data);
        }

    } catch (e) {
        console.error(e);
        alert("Error retrieving content.");
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