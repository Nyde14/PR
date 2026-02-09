// --- GLOBAL VARIABLES ---
let currentTargetId = null;
let currentAdviserName = ""; 
let selectedClubLogoFile = null;

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) throw new Error("Unauthorized");
        
        const liveData = await response.json();
        currentAdviserName = liveData.name; 

        // --- THE FIX: Define variables BEFORE using them ---
        const type = liveData.usertype; // Get 'Admin' or 'Teacher'
        const role = liveData.clubPosition || 'Member'; // Get 'President', 'VP', etc.

        // Now validate these values
        const isOfficer = role === 'President' || role === 'Vice President';
        const isStaff = type === 'Admin' || type === 'Teacher';

        // Validate Access
        if (!isStaff && !isOfficer) {
            alert("Access Denied. Only Advisers, Presidents, and VPs can view this dashboard.");
            window.location.href = "/ClubPortalFeed/ClubPortalFeed.html";
            return;
        }

        // Proceed with loading club data
        if (liveData.club && liveData.club !== "none" && liveData.club !== "") {
            document.getElementById('DisplayClubName').innerText = liveData.club;
            document.getElementById('AdviserWelcome').innerText = `Managing ${liveData.club}`;
            
            fetchClubStats(liveData.club);
            fetchPendingApplications(liveData.club); 
            fetchClubMembers(liveData.club); 
        } else {
            const appList = document.getElementById('ApplicationsList');
            if (appList) {
                appList.innerHTML = "<tr><td colspan='4'>No club assigned to this account.</td></tr>";
            }
        }
    } catch (error) {
        console.error("Dashboard Auth Error:", error);
        // Optional: Redirect to login if unauthorized
    }
    setupClubLogoUploader();
});

// ==========================================
// 1. MEMBER MANAGEMENT
// ==========================================

async function fetchClubMembers(clubName) {
    try {
        const response = await fetch(`/api/clubs/members?clubname=${encodeURIComponent(clubName)}`);
        const members = await response.json();
        const container = document.getElementById('MemberList');
        container.innerHTML = "";

        // Re-check current user's role for security
        const authRes = await fetch('/api/auth/me');
        const currentUser = await authRes.json();
        const isStaff = currentUser.usertype === 'Admin' || currentUser.usertype === 'Teacher';

        const roleOptions = ['Member', 'Active Member', 'PIO', 'Auditor', 'Treasurer', 'Secretary', 'Vice President', 'President'];

        members.forEach(member => {
            // 1. Skip the Adviser themselves in the list
            if (member.name === currentAdviserName) return; 

            const currentRole = member.clubPosition || 'Member';
            const isBanned = member.isRestricted;

            // 2. Security: Only Teachers/Admins can change roles. 
            // Presidents and VPs can see the list but cannot change roles.
            const isDisabled = !isStaff ? 'disabled' : '';
            
            const roleSelect = `
                <select onchange="window.updateMemberRole('${member._id}', this.value)" 
                        class="role-dropdown-styled" ${isDisabled}>
                    ${roleOptions.map(r => `<option value="${r}" ${r === currentRole ? 'selected' : ''}>${r}</option>`).join('')}
                </select>`;

            const statusBadge = isBanned 
                ? `<span class="status-badge" style="background:#dc3545;">Restricted</span>`
                : `<span class="status-badge green">Active</span>`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${member.name}</strong></td>
                <td>${member.email || 'N/A'}</td>
                <td>${roleSelect}</td> <td>${statusBadge}</td>
                <td>
                    <div style="display:flex; gap:5px;">
                        ${isStaff ? `
                            <button class="btn-approve" onclick="window.unrestrictUser('${member._id}', '${member.name}')" style="${!isBanned ? 'display:none' : ''}">Unrestrict</button>
                            <button class="btn-reject" onclick="window.openRestrictModal('${member._id}', '${member.name}')" style="${isBanned ? 'display:none' : ''}">Restrict</button>
                        ` : ''}
                        <button class="btn-reject" onclick="window.removeMember('${member.name}')">Remove</button>
                    </div>
                </td>
            `;
            container.appendChild(row);
        });
    } catch (error) { console.error("Error loading members:", error); }
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
            // Refresh the list immediately to confirm the DB has the new role
            const clubName = document.getElementById('DisplayClubName').innerText;
            fetchClubMembers(clubName);
        } else {
            const err = await res.json();
            alert("❌ Failed: " + err.message);
        }
    } catch(e) { 
        console.error(e); 
        alert("Network error updating role.");
    }
};

// --- RESTRICTION MODAL LOGIC (Attached to Window) ---

window.openRestrictModal = function(userId, userName) {
    currentTargetId = userId; 
    
    const targetSpan = document.getElementById('RestrictTargetName');
    if (targetSpan) targetSpan.innerText = userName;

    document.getElementById('RestrictModal').style.display = 'block';
};

window.closeRestrictModal = function() {
    document.getElementById('RestrictModal').style.display = 'none';
    currentTargetId = null;
    document.getElementById('RestrictReason').value = ""; 
};

window.submitRestriction = async function() {
    if (!currentTargetId) return;

    const duration = document.getElementById('RestrictDuration').value;
    const reason = document.getElementById('RestrictReason').value;

    if (!reason.trim()) return alert("Please provide a reason.");

    try {
        const response = await fetch(`/api/users/restrict/${currentTargetId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ duration, reason })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            window.closeRestrictModal();
            const clubName = document.getElementById('DisplayClubName').innerText;
            fetchClubMembers(clubName);
        } else {
            alert("Error: " + data.message);
        }
    } catch (e) {
        console.error(e);
        alert("Network error.");
    }
};

window.unrestrictUser = async function(userId, userName) {
    if (!confirm(`Lift restriction for ${userName}?`)) return;

    try {
        const response = await fetch(`/api/users/unrestrict/${userId}`, {
            method: 'PUT'
        });

        const data = await response.json();

        if (response.ok) {
            alert("User is now active.");
            const clubName = document.getElementById('DisplayClubName').innerText;
            fetchClubMembers(clubName);
        } else {
            alert("Error: " + data.message);
        }
    } catch (e) {
        console.error(e);
        alert("Network error.");
    }
};

window.removeMember = async function(studentName) {
    const clubName = document.getElementById('DisplayClubName').innerText;
    if (!confirm(`Are you sure you want to remove ${studentName} from ${clubName}?`)) return;

    try {
        const response = await fetch('/api/clubs/remove-member', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentname: studentName, clubname: clubName })
        });

        if (response.ok) {
            alert("Member removed.");
            fetchClubMembers(clubName);
            fetchClubStats(clubName);
        } else {
            const error = await response.json();
            alert("Error: " + error.message);
        }
    } catch (error) {
        console.error("Removal error:", error);
    }
};

// ==========================================
// 2. APPLICATIONS & STATS
// ==========================================

async function fetchPendingApplications(adviserClub) {
    try {
        const response = await fetch(`/api/applications/pending?clubname=${encodeURIComponent(adviserClub)}`);
        const data = await response.json();

        const container = document.getElementById('ApplicationsList');
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
        console.error("Dashboard error:", error);
    }
}
async function fetchClubStats(clubName) {
    if (!clubName) return;
    try {
        const response = await fetch(`/api/clubs/search?name=${encodeURIComponent(clubName)}`);
        const data = await response.json();

        if (!data) return;

        // 1. Update Member Count
        if(document.getElementById('DisplayMemberCount')) {
            document.getElementById('DisplayMemberCount').innerText = (data.membercount !== undefined) ? data.membercount : 0;
        }

        // 2. Update Descriptions
        if(document.getElementById('ShortDescInput')) document.getElementById('ShortDescInput').value = data.shortDescription || "";
        if(document.getElementById('FullDescInput')) document.getElementById('FullDescInput').value = data.fullDescription || "";

        // 3. --- FIX: UPDATE THE LOGO ---
        const logoImg = document.getElementById('DisplayClubLogo');
        if (logoImg) {
            // Use the saved logo, or fallback to default if none exists
            if (data.branding && data.branding.logo) {
                logoImg.src = data.branding.logo;
            } else {
                logoImg.src = "/public/images/default-club.png";
            }
        }

    } catch (error) {
        console.error("Error fetching club stats:", error);
    }
}

window.updateStatus = async function(id, newStatus) {
    if (!confirm(`Are you sure you want to ${newStatus} this application?`)) return;

    try {
        const response = await fetch(`/api/applications/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            alert(`Application ${newStatus}!`);
            const currentClub = document.getElementById('DisplayClubName').innerText;
            fetchPendingApplications(currentClub); 
            fetchClubStats(currentClub);
            fetchClubMembers(currentClub); 
        } else {
            const result = await response.json();
            alert("Error: " + result.error);
        }
    } catch (error) {
        alert("Update failed: " + error.message);
    }
};

// ==========================================
// 3. EDIT PROFILE & POSTS
// ==========================================

window.saveDescription = async function() {
    const clubName = document.getElementById('DisplayClubName').innerText;
    const shortDesc = document.getElementById('ShortDescInput').value;
    const fullDesc = document.getElementById('FullDescInput').value;

    if (!confirm("Update club description?")) return;

    try {
        const response = await fetch('/api/clubs/update-description', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clubname: clubName, shortDescription: shortDesc, fullDescription: fullDesc })
        });

        if (response.ok) alert("Club profile updated successfully!");
        else alert("Update failed.");
    } catch (error) { console.error(error); }
};

window.saveBranding = async function() {
    const clubName = document.getElementById('DisplayClubName').innerText;
    const logoFile = document.getElementById('LogoInput').files[0];
    const bannerFile = document.getElementById('BannerInput').files[0];

    if (!logoFile && !bannerFile) return alert("Select an image first.");
    if (!confirm("Upload selected images?")) return;

    const formData = new FormData();
    formData.append('clubname', clubName);
    if (logoFile) formData.append('logo', logoFile);
    if (bannerFile) formData.append('banner', bannerFile);

    try {
        const response = await fetch('/api/clubs/update-branding', { method: 'PATCH', body: formData });
        if (response.ok) {
            alert("Images uploaded successfully!");
            location.reload(); 
        } else {
            alert("Upload failed.");
        }
    } catch (error) { console.error(error); }
};

const postForm = document.getElementById('CreatePostForm');
if (postForm) {
    postForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = postForm.querySelector('button');
        const originalText = btn.innerText;
        
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;
        // NEW: Get Visibility
        const visibility = document.getElementById('postVisibility').value;
        const file = document.getElementById('postMedia').files[0];

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('visibility', visibility); // <--- Send to Backend
        if (file) formData.append('media', file);

        btn.innerText = "Publishing...";
        btn.disabled = true;

        try {
            const response = await fetch('/api/posts/create', { method: 'POST', body: formData });
            if (response.ok) {
                alert("✅ Announcement posted!");
                postForm.reset();
            } else {
                throw new Error("Failed to post");
            }
        } catch (error) {
            alert("❌ Error: " + error.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}
function setupClubLogoUploader() {
    // FIX: Target the WRAPPER, not just the image
    const logoWrapper = document.querySelector('.logo-upload-wrapper');
    const logoImg = document.getElementById('DisplayClubLogo');
    
    // Add Click Listener to the Wrapper (handles the overlay click)
    if (logoWrapper) {
        logoWrapper.style.cursor = "pointer";
        logoWrapper.onclick = () => document.getElementById('ClubLogoInput').click();
    } else if (logoImg) {
        // Fallback: If wrapper is missing, click the image directly
        logoImg.style.cursor = "pointer";
        logoImg.onclick = () => document.getElementById('ClubLogoInput').click();
    }

    // Check if we already injected the HTML to avoid duplicates
    if (document.getElementById('ClubLogoInput')) return;

    // 3. Inject the Hidden Input & Modal HTML
    const uploaderHTML = `
        <input type="file" id="ClubLogoInput" accept="image/*" style="display:none;" onchange="previewClubLogo()">

        <div id="ClubLogoPreviewModal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10000; justify-content:center; align-items:center;">
            <div class="modal-content" style="background:white; padding:25px; border-radius:12px; width:90%; max-width:400px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.3); animation: popIn 0.3s ease-out;">
                <h3 style="margin-top:0; color:#333;">Update Club Logo</h3>
                <p style="color:#666; font-size:0.9rem; margin-bottom:15px;">New look for the club?</p>
                
                <div style="width:150px; height:150px; margin:0 auto 20px auto; border-radius:50%; overflow:hidden; border:4px solid #fa3737; background:#f0f0f0;">
                    <img id="ClubLogoPreviewImg" src="" style="width:100%; height:100%; object-fit:cover;">
                </div>

                <div style="display:flex; justify-content:center; gap:15px;">
                    <button onclick="cancelClubLogo()" style="padding:10px 20px; border:none; background:#ccc; color:#333; border-radius:6px; cursor:pointer; font-weight:bold;">Cancel</button>
                    <button id="SaveClubLogoBtn" onclick="saveClubLogo()" style="padding:10px 20px; border:none; background:#fa3737; color:white; border-radius:6px; cursor:pointer; font-weight:bold;">Save Logo</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', uploaderHTML);
}

// --- A. PREVIEW FUNCTION ---
window.previewClubLogo = function() {
    const input = document.getElementById('ClubLogoInput');
    const file = input.files[0];
    
    if (!file) return;

    selectedClubLogoFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('ClubLogoPreviewImg').src = e.target.result;
        document.getElementById('ClubLogoPreviewModal').style.display = 'flex'; // Show Modal
    };
    reader.readAsDataURL(file);
};

// --- B. CANCEL FUNCTION ---
window.cancelClubLogo = function() {
    selectedClubLogoFile = null;
    document.getElementById('ClubLogoInput').value = ""; // Reset input
    document.getElementById('ClubLogoPreviewModal').style.display = 'none'; // Hide Modal
};

window.saveClubLogo = async function() {
    if (!selectedClubLogoFile) return;

    const clubName = document.getElementById('DisplayClubName').innerText;
    const btn = document.getElementById('SaveClubLogoBtn');
    
    // UI Feedback
    btn.innerText = "Uploading...";
    btn.disabled = true;

    const formData = new FormData();
    formData.append('clubname', clubName);
    formData.append('logo', selectedClubLogoFile);

    try {
        const response = await fetch('/api/clubs/update-branding', {
            method: 'PATCH',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            
            // --- FIX IS HERE ---
            const logoDisplay = document.getElementById('DisplayClubLogo');
            if (logoDisplay) {
                // We add ?t=Date.now() to force the browser to reload the image
                logoDisplay.src = `${data.club.branding.logo}?t=${new Date().getTime()}`;
            }

            alert("✅ Club Logo Updated!");
            cancelClubLogo(); // Close modal
        } else {
            const err = await response.json();
            alert("❌ Upload failed: " + (err.message || "Unknown error"));
        }
    } catch (error) {
        console.error("Logo Upload Error:", error);
        alert("Network error.");
    } finally {
        btn.innerText = "Save Logo";
        btn.disabled = false;
    }
};