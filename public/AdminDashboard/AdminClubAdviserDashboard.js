// --- GLOBAL VARIABLES ---
let currentTargetId = null;
let currentClubSlug = null;
let currentClubName = "";

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // 1. Check Auth & Admin Status
        const response = await fetch('/api/auth/me');
        console.log("Auth check status:", response.status);
        
        if (!response.ok) {
            console.error("Auth check failed with status:", response.status);
            // If auth fails, redirect to login
            window.location.href = "/Login/Login.html";
            return;
        }
        
        const userdata = await response.json();
        console.log("User loaded:", userdata.name, "Type:", userdata.usertype);

        // 2. Verify Admin Status
        if (!userdata || userdata.usertype !== 'Admin') {
            console.error("User is not admin or user data missing");
            // Non-admin users should be redirected by server, but this is a backup
            window.location.href = "/ClubPortalFeed/ClubPortalFeed.html";
            return;
        }

        // 3. Get slug from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('slug');

        if (!slug) {
            console.error("No slug provided in URL");
            alert("No club specified. Returning to club list.");
            window.location.href = "/AdminDashboard/AdminClubList.html";
            return;
        }

        currentClubSlug = slug;
        console.log("Loading club with slug:", slug);

        // 4. Load club data using the slug
        await fetchClubData(slug);
        fetchClubMembers(currentClubName);
        fetchPendingApplications(currentClubName);

    } catch (error) {
        console.error("Dashboard Auth Error:", error);
        // Redirect to login on any unrecoverable error
        window.location.href = "/Login/Login.html";
    }
});

// ==========================================
// FETCH CLUB DATA FROM API
// ==========================================

async function fetchClubData(slug) {
    try {
        const response = await fetch(`/api/clubs/${slug}`);
        console.log("Club data fetch status:", response.status);
        
        if (!response.ok) throw new Error("Club not found");
        
        const clubData = await response.json();
        console.log("Club data loaded:", clubData.clubname);

        // 1. Update Display
        currentClubName = clubData.clubname;
        
        const displayClubName = document.getElementById('DisplayClubName');
        if (displayClubName) {
            displayClubName.innerText = clubData.clubname;
        } else {
            console.warn("DisplayClubName element not found");
        }
        
        const adviserWelcome = document.getElementById('AdviserWelcome');
        if (adviserWelcome) {
            adviserWelcome.innerText = `Managing ${clubData.clubname}`;
        } else {
            console.warn("AdviserWelcome element not found");
        }
        
        // 2. Update Member Count
        const memberCount = clubData.memberCount || 0;
        const countElement = document.getElementById('DisplayMemberCount');
        if (countElement) {
            countElement.innerText = memberCount;
        } else {
            console.warn("DisplayMemberCount element not found");
        }

        // 3. Update Descriptions
        const shortDesc = document.getElementById('ShortDescInput');
        if (shortDesc) {
            shortDesc.value = clubData.shortDescription || "";
        } else {
            console.warn("ShortDescInput element not found");
        }
        
        const fullDesc = document.getElementById('FullDescInput');
        if (fullDesc) {
            fullDesc.value = clubData.fullDescription || "";
        } else {
            console.warn("FullDescInput element not found");
        }

        // 4. Update Logo
        const logoImg = document.getElementById('DisplayClubLogo');
        if (logoImg) {
            if (clubData.branding && clubData.branding.logo) {
                logoImg.src = clubData.branding.logo;
            } else if (clubData.logo) {
                logoImg.src = clubData.logo;
            } else {
                logoImg.src = "/public/images/default-club.png";
            }
        } else {
            console.warn("DisplayClubLogo element not found");
        }

    } catch (error) {
        console.error("Error fetching club data:", error);
        alert("Could not load club data. Returning to club list.");
        window.location.href = "/AdminDashboard/AdminClubList.html";
    }
}

// ==========================================
// 1. MEMBER MANAGEMENT
// ==========================================

async function fetchClubMembers(clubName) {
    if (!clubName) {
        console.warn("No club name provided to fetchClubMembers");
        return;
    }

    try {
        console.log("Fetching members for club:", clubName);
        const response = await fetch(`/api/clubs/members?clubname=${encodeURIComponent(clubName)}`);
        console.log("Members fetch status:", response.status);
        
        if (!response.ok) {
            throw new Error("Failed to fetch members");
        }

        const members = await response.json();
        console.log("Members loaded:", members.length);
        
        const container = document.getElementById('MemberList');
        if (!container) {
            console.error("MemberList container element not found");
            return;
        }
        
        container.innerHTML = "";

        const roleOptions = ['Member', 'Active Member', 'PIO', 'Auditor', 'Treasurer', 'Secretary', 'Vice President', 'President'];

        members.forEach(member => {
            const currentRole = member.clubPosition || 'Member';
            const isBanned = member.isRestricted;

            // Admins can always change roles
            const roleSelect = `
                <select onchange="window.updateMemberRole('${member._id}', this.value)" 
                        class="role-dropdown-styled">
                    ${roleOptions.map(r => `<option value="${r}" ${r === currentRole ? 'selected' : ''}>${r}</option>`).join('')}
                </select>`;

            const statusBadge = isBanned 
                ? `<span class="status-badge" style="background:#dc3545;">Restricted</span>`
                : `<span class="status-badge green">Active</span>`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${member.name}</strong></td>
                <td>${member.email || 'N/A'}</td>
                <td>${roleSelect}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-approve" onclick="window.unrestrictUser('${member._id}', '${member.name}')" style="${!isBanned ? 'display:none' : ''}">Unrestrict</button>
                        <button class="btn-reject" onclick="window.openRestrictModal('${member._id}', '${member.name}')" style="${isBanned ? 'display:none' : ''}">Restrict</button>
                        <button class="btn-reject" onclick="window.removeMember('${member.name}')">Remove</button>
                    </div>
                </td>
            `;
            container.appendChild(row);
        });
    } catch (error) { 
        console.error("Error loading members:", error);
        const container = document.getElementById('MemberList');
        if (container) {
            container.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error loading members</td></tr>`;
        }
    }
}

// Global function to update role via API
window.updateMemberRole = async function(userId, newRole) {
    if(!confirm(`Change role to ${newRole}?`)) return;
    
    try {
        const res = await fetch('/api/users/assign-role', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, newRole })
        });

        if(res.ok) {
            alert("✅ Role updated successfully!");
            fetchClubMembers(currentClubName);
        } else {
            const err = await res.json();
            alert("❌ Failed: " + err.message);
        }
    } catch(e) { 
        console.error(e); 
        alert("Network error updating role.");
    }
};

// --- RESTRICTION MODAL LOGIC ---

window.openRestrictModal = function(userId, userName) {
    console.log("Opening restrict modal for user:", userName);
    currentTargetId = userId; 
    const targetSpan = document.getElementById('RestrictTargetName');
    if (targetSpan) {
        targetSpan.innerText = userName;
    } else {
        console.warn("RestrictTargetName element not found");
    }
    const modal = document.getElementById('RestrictModal');
    if (modal) {
        modal.style.display = 'block';
    } else {
        console.error("RestrictModal element not found");
    }
};

window.closeRestrictModal = function() {
    console.log("Closing restrict modal");
    const modal = document.getElementById('RestrictModal');
    if (modal) {
        modal.style.display = 'none';
    } else {
        console.warn("RestrictModal element not found");
    }
    currentTargetId = null;
    const reasonField = document.getElementById('RestrictReason');
    if (reasonField) {
        reasonField.value = ""; 
    } else {
        console.warn("RestrictReason element not found");
    }
};

window.submitRestriction = async function() {
    if (!currentTargetId) {
        console.error("No target ID for restriction");
        return;
    }

    const durationField = document.getElementById('RestrictDuration');
    const reasonField = document.getElementById('RestrictReason');
    
    if (!durationField || !reasonField) {
        console.error("Missing restriction form fields");
        alert("Error: Form elements not found");
        return;
    }

    const duration = durationField.value;
    const reason = reasonField.value;

    if (!reason.trim()) {
        alert("Please provide a reason.");
        return;
    }

    console.log("Submitting restriction for user:", currentTargetId, "Duration:", duration);

    try {
        const response = await fetch(`/api/users/restrict/${currentTargetId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ duration, reason })
        });

        console.log("Restrict response status:", response.status);
        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            window.closeRestrictModal();
            fetchClubMembers(currentClubName);
        } else {
            alert("Error: " + data.message);
        }
    } catch (e) {
        console.error("Restriction error:", e);
        alert("Network error.");
    }
};

window.unrestrictUser = async function(userId, userName) {
    console.log("Unrestricting user:", userName);
    if (!confirm(`Lift restriction for ${userName}?`)) return;

    try {
        const response = await fetch(`/api/users/unrestrict/${userId}`, {
            method: 'PUT'
        });

        console.log("Unrestrict response status:", response.status);
        const data = await response.json();

        if (response.ok) {
            alert("User is now active.");
            fetchClubMembers(currentClubName);
        } else {
            alert("Error: " + data.message);
        }
    } catch (e) {
        console.error("Unrestrict error:", e);
        alert("Network error.");
    }
};

window.removeMember = async function(studentName) {
    console.log("Removing member:", studentName, "from club:", currentClubName);
    if (!confirm(`Are you sure you want to remove ${studentName} from ${currentClubName}?`)) return;

    try {
        const response = await fetch('/api/clubs/remove-member', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentname: studentName, clubname: currentClubName })
        });

        console.log("Remove member response status:", response.status);

        if (response.ok) {
            alert("Member removed.");
            fetchClubMembers(currentClubName);
            // Also refresh the member count
            const countElement = document.getElementById('DisplayMemberCount');
            if (countElement) {
                const count = parseInt(countElement.innerText) - 1;
                countElement.innerText = count;
            } else {
                console.warn("DisplayMemberCount element not found for update");
            }
        } else {
            const error = await response.json();
            alert("Error: " + error.message);
        }
    } catch (error) {
        console.error("Removal error:", error);
        alert("Network error removing member.");
    }
};

// ==========================================
// 2. APPLICATIONS & STATS
// ==========================================

async function fetchPendingApplications(clubName) {
    if (!clubName) {
        console.warn("No club name provided to fetchPendingApplications");
        return;
    }

    try {
        console.log("Fetching pending applications for club:", clubName);
        const response = await fetch(`/api/applications/pending?clubname=${encodeURIComponent(clubName)}`);
        console.log("Applications fetch status:", response.status);
        
        if (!response.ok) {
            throw new Error("Failed to fetch applications");
        }

        const data = await response.json();
        console.log("Applications loaded:", data.length);
        
        const container = document.getElementById('ApplicationsList');
        if (!container) {
            console.error("ApplicationsList container element not found");
            return;
        }
        
        container.innerHTML = ""; 

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = "<tr><td colspan='4'>No pending applications.</td></tr>";
            return;
        }

        data.forEach(app => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${app.studentname}</strong></td>
                <td>${app.clubname}</td>
                <td>${new Date(app.appliedat).toLocaleDateString()}</td>
                <td>
                    <button class="btn-approve" onclick="window.updateStatus('${app._id}', 'approved')">Approve</button>
                    <button class="btn-reject" onclick="window.updateStatus('${app._id}', 'rejected')">Reject</button>
                </td>
            `;
            container.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading applications:", error);
        const container = document.getElementById('ApplicationsList');
        if (container) {
            container.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error loading applications</td></tr>`;
        }
    }
}

window.updateStatus = async function(id, newStatus) {
    console.log("Updating application status:", id, "to:", newStatus);
    if (!confirm(`Are you sure you want to ${newStatus} this application?`)) return;

    try {
        const response = await fetch(`/api/applications/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        console.log("Update status response:", response.status);

        if (response.ok) {
            alert(`Application ${newStatus}!`);
            fetchPendingApplications(currentClubName);
            fetchClubMembers(currentClubName);
            // Refresh member count
            const countElement = document.getElementById('DisplayMemberCount');
            if (countElement) {
                const count = parseInt(countElement.innerText);
                if (newStatus === 'approved') {
                    countElement.innerText = count + 1;
                }
            } else {
                console.warn("DisplayMemberCount element not found for update");
            }
        } else {
            const result = await response.json();
            alert("Error: " + result.error);
        }
    } catch (error) {
        console.error("Update status error:", error);
        alert("Update failed: " + error.message);
    }
};

// ==========================================
// 3. EDIT PROFILE
// ==========================================

window.saveDescription = async function() {
    console.log("Saving description for club:", currentClubName);
    
    const shortDescElement = document.getElementById('ShortDescInput');
    const fullDescElement = document.getElementById('FullDescInput');
    
    if (!shortDescElement || !fullDescElement) {
        console.error("Missing description form elements");
        alert("Error: Form elements not found");
        return;
    }

    const shortDesc = shortDescElement.value;
    const fullDesc = fullDescElement.value;

    if (!confirm("Update club description?")) return;

    try {
        const response = await fetch('/api/clubs/update-description', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clubname: currentClubName, shortDescription: shortDesc, fullDescription: fullDesc })
        });

        console.log("Save description response status:", response.status);

        if (response.ok) {
            alert("✅ Club profile updated successfully!");
        } else {
            alert("❌ Update failed.");
        }
    } catch (error) { 
        console.error("Save description error:", error);
        alert("Error: " + error.message);
    }
};
