document.addEventListener("DOMContentLoaded", () => {
    loadSidebar();
    injectInterestModal();
    loadUserHeader();
    setupDarkMode(); // <--- Initialize Dark Mode
    setupMobileMenu();    
    checkNotifications();
    injectFullProfileModal();   // For "My Settings"
    injectPublicProfileModal(); // For "View Others"
    checkNotifications(); // Initial check on load
});
let selectedAvatarFile = null;
let globalInterests = new Set();

// ==========================================
// 1. SIDEBAR LOADER
// ==========================================
async function loadSidebar() {
    const sidebarList = document.getElementById('MainSideBarList');
    if (!sidebarList) return;

    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const user = await res.json();
        
        const userRole = user.usertype;
        const hasClubAssignment = user.club && user.club !== 'none' && user.club !== 'Pending';
        
        // 1. Define Access Roles
        const isStaff = userRole === 'Teacher' || userRole === 'Admin';
        const clubPosition = user.clubPosition || 'Member';
        const isOfficer = clubPosition === 'President' || clubPosition === 'Vice President';

        const menuItems = [
            { name: "Home", link: "/ClubPortalFeed/ClubPortalFeed.html", icon: "bx bx-home-alt-2" },
            { name: "Clubs", link: "/ApplyClub/Clublist.html", icon: "bx bx-shield-quarter" },
            { name: "Messages", link: "/public/ClubChat/ChatInbox.html", icon: "bx bx-message-square-dots" },
            { name: "Following", link: "/FollowedClubs/FollowedClubs.html", icon: "bx bx-star" },
            { name: "Hidden Posts", link: "/HiddenPosts/HiddenPosts.html", icon: "bx bx-hide" },
            
            // --- THE FIX: Allow Staff OR Officers to see the dashboard ---
            { 
                name: "Club Dashboard", 
                link: "/TeacherDashboard/ClubAdviserDashboard.html", 
                visible: ((isStaff || isOfficer) && hasClubAssignment), 
                icon: "bx bxs-dashboard" 
            },
            
            { 
                name: "Admin Panel", 
                link: "/AdminDashboard/AdminDashboard.html", 
                visible: (userRole === 'Admin'), 
                icon: "bx bx-cog" 
            },
            
            { name: "Customize Feed", link: "#", onclick: "openInterestModal()", icon: "bx bx-slider-alt" },
            { name: "Logout", link: "#", onclick: "logout()", icon: "bx bx-log-out" }
        ];

        let html = menuItems
            .filter(item => item.visible !== false) 
            .map(item => {
                const content = `<i class='${item.icon} sidebar-icon'></i> <span class="sidebar-text">${item.name}</span>`;
                return item.onclick 
                    ? `<li><a href="#" onclick="${item.onclick}" class="SidebarItem">${content}</a></li>`
                    : `<li><a href="${item.link}" class="SidebarItem">${content}</a></li>`;
            })
            .join('');

        html += `
            <li style="margin-top: auto; padding-top: 20px; border-top: 1px solid #eee;">
                <div class="theme-switch-wrapper" style="display:flex; align-items:center; padding-left:15px;">
                    <label class="theme-switch" for="checkbox">
                        <input type="checkbox" id="checkbox">
                        <span class="slider round"></span>
                        <span class="slider-icon"></span>
                    </label>
                    <span id="ModeLabel" style="margin-left:15px; font-size:0.9rem; color:#666;">Light Mode</span>
                </div>
            </li>
        `;

        sidebarList.innerHTML = html;
        setupDarkMode(); 

    } catch (e) {
        console.error("Sidebar Loading Error:", e);
    }
}
// ==========================================
// 2. DARK MODE LOGIC
// ==========================================
function setupDarkMode() {
    const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
    const modeLabel = document.getElementById('ModeLabel');
    const currentTheme = localStorage.getItem('theme');

    // 1. Check Saved Preference
    if (currentTheme) {
        document.body.classList.add(currentTheme); // 'dark-mode' or nothing
        if (currentTheme === 'dark-mode') {
            if(toggleSwitch) toggleSwitch.checked = true;
            if(modeLabel) modeLabel.innerText = "Dark Mode";
        }
    }

    // 2. Handle Switch Toggle
    if (toggleSwitch) {
        toggleSwitch.addEventListener('change', function(e) {
            if (e.target.checked) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark-mode');
                if(modeLabel) modeLabel.innerText = "Dark Mode";
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light-mode');
                if(modeLabel) modeLabel.innerText = "Light Mode";
            }
        });
    }
}

// ==========================================
// 3. HEADER & LOGOUT
// ==========================================
async function loadUserHeader() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const user = await res.json(); 

        const profileContainer = document.getElementById('UserProfile');
        if (profileContainer) {
            // Fix the gap: Use flex gap instead of margins
            profileContainer.style.display = 'flex';
            profileContainer.style.alignItems = 'center';
            profileContainer.style.gap = '10px'; 
            profileContainer.style.justifyContent = 'flex-end';

            const imgSrc = user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff&size=128`;
            const isAdviser = user.usertype === 'Teacher' || user.usertype === 'Admin';
            const roleLabel = isAdviser ? 'CLUB ADVISER' : (user.clubPosition || 'MEMBER').toUpperCase();

            // 1. Clear and Build Header
            profileContainer.innerHTML = ''; 

            // 2. Inject Bell first
            createNotificationBell(profileContainer);

            // 3. Inject Profile Picture (Added z-index to ensure clickability)
            const profileWrapper = document.createElement('div');
            profileWrapper.className = 'header-profile-wrapper';
            profileWrapper.style.position = 'relative';
            profileWrapper.style.zIndex = '10'; 

            profileWrapper.innerHTML = `
                <img id="HeaderProfilePic" src="${imgSrc}" 
                     onclick="window.openFullProfileModal()" 
                     style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; cursor: pointer; border: 2px solid white; display: block;">
            `;
            profileContainer.appendChild(profileWrapper);

            // 4. Update Name and Fetch Notifications
            const nameEl = document.getElementById('Name');
            if (nameEl) nameEl.innerText = `${user.name} (${roleLabel})`;
            
            checkNotifications();
        }
    } catch (e) { console.error("Header Error:", e); }
}

function createNotificationBell(container) {
    if (document.getElementById('NotifBtn')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'notification-wrapper';
    // Removed large margin-right to fix the gap
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    
    wrapper.innerHTML = `
        <button id="NotifBtn" onclick="toggleNotifDropdown()">
            <i class='bx bx-bell'></i> <span id="NotifBadge" style="display:none;">0</span>
        </button>
        <div id="NotifDropdown" class="notif-dropdown" style="display:none;">
            <div class="notif-header-row">
                <span>Notifications</span>
                <button onclick="markAllRead()" class="mark-read-btn">Mark all read</button>
            </div>
            <div id="NotifList"><p class="empty-notif">Loading...</p></div>
        </div>`;

    container.appendChild(wrapper);
}

function logout() {
    // Clear session/token
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        window.location.href = "/Login/Login.html";
    });
}


// Helper function
function getBellHTML() {
    return `
        <button id="NotifBtn" onclick="toggleNotifDropdown()">
            <i class='bx bx-bell'></i>
            <span id="NotifBadge">0</span>
        </button>
        <div id="NotifDropdown" class="notif-dropdown">...</div>
    `;
}

// --- B. FETCH & UPDATE LOGIC ---
async function checkNotifications() {
    const listContainer = document.getElementById('NotifList');
    if (!listContainer) return; 

    try {
        // Use the 'credentials: include' to ensure the session cookie is sent
        const response = await fetch('/api/notifications', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include' 
        });
        
        if (response.status === 401) return; // Silent return if not logged in

        if (response.ok) {
            const data = await response.json();
            updateNotifUI(data.notifications, data.unread);
        }
    } catch (error) {
        console.error("Notification check skipped (offline or server error)");
    }
}
function updateNotifUI(list, unreadCount) {
    const badge = document.getElementById('NotifBadge');
    const container = document.getElementById('NotifList');
    if(!badge || !container) return;

    // Update Badge
    if (unreadCount > 0) {
        badge.style.display = 'block';
        badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
    } else {
        badge.style.display = 'none';
    }

    // Update List
    if (!list || list.length === 0) {
        container.innerHTML = '<p class="empty-notif">No notifications.</p>';
        return;
    }

    container.innerHTML = list.map(notif => `
        <div class="notif-item ${notif.isRead ? 'read' : 'unread'}" 
             onclick="window.location.href='${notif.link}'">
            <div class="notif-sender">${notif.sender}</div>
            <div class="notif-message">${notif.message}</div>
            <div class="notif-time">
                ${new Date(notif.timestamp).toLocaleDateString()}
            </div>
        </div>
    `).join('');
}

// --- C. INTERACTION ---
window.toggleNotifDropdown = async function() {
    const dd = document.getElementById('NotifDropdown');
    if (!dd) return;
    
    const isClosed = dd.style.display === 'none' || dd.style.display === '';
    dd.style.display = isClosed ? 'block' : 'none';

    if (isClosed) await markAllRead();
};

window.markAllRead = async function() {
    try {
        await fetch('/api/notifications/mark-read', { method: 'PUT' });
        const badge = document.getElementById('NotifBadge');
        if(badge) badge.style.display = 'none';
        
        // Visually mark items as read immediately
        document.querySelectorAll('.notif-item.unread').forEach(el => {
            el.classList.remove('unread');
            el.classList.add('read');
        });
    } catch (e) { console.error(e); }
};

// Close dropdown if clicking outside
window.addEventListener('click', (e) => {
    if (!e.target.closest('#NotifBtn') && !e.target.closest('#NotifDropdown')) {
        const dd = document.getElementById('NotifDropdown');
        if (dd) dd.style.display = 'none';
    }
});
// --- UPLOAD AVATAR FUNCTION ---
async function uploadAvatar() {
    const input = document.getElementById('AvatarInput');
    const file = input.files[0];

    if (!file) return;

    // 1. Prepare Data
    const formData = new FormData();
    formData.append('avatar', file); // 'avatar' matches the upload.single('avatar') in backend

    const imgElement = document.getElementById('FullProfilePic');
    const originalSrc = imgElement.src;

    try {
        // 2. Visual Feedback (Dim the image)
        imgElement.style.opacity = '0.5';

        // 3. Send Request
        const response = await fetch('/api/users/upload-avatar', {
            method: 'POST',
            body: formData 
            // Note: Do NOT set Content-Type header for FormData, browser does it automatically
        });

        const data = await response.json();

        if (response.ok) {
            // 4. Update Image Source Immediately
            imgElement.src = data.newUrl;
            
            // Also update the small header icon if it exists
            const headerIcon = document.getElementById('ProfilePicture');
            if(headerIcon) headerIcon.src = data.newUrl;

            window.showToast("Profile picture updated!");
        } else {
            throw new Error(data.message);
        }

    } catch (error) {
        console.error("Upload Error:", error);
        window.showToast("Failed to upload: " + error.message, "error");
        imgElement.src = originalSrc; // Revert on error
    } finally {
        imgElement.style.opacity = '1'; // Restore opacity
        input.value = ""; // Reset input so you can select the same file again if needed
    }
}


// --- TOGGLE DROPDOWN ---
window.toggleProfileDropdown = function() {
    const dd = document.getElementById('ProfileDropdown');
    if (dd) {
        const isVisible = dd.style.display === 'block';
        dd.style.display = isVisible ? 'none' : 'block';
    }
};

// --- UPLOAD LOGIC ---
window.uploadHeaderAvatar = async function() {
    const input = document.getElementById('HeaderAvatarInput');
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    const img = document.getElementById('HeaderProfilePic');
    const originalSrc = img.src;

    try {
        img.style.opacity = '0.5'; // Visual feedback

        const response = await fetch('/api/users/upload-avatar', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            // Update the image immediately on screen
            img.src = data.newUrl;
            window.showToast("Profile picture updated!");
            toggleProfileDropdown(); // Close menu
        } else {
            window.showToast("Upload failed: " + data.message, "error");
            img.src = originalSrc;
        }
    } catch (error) {
        console.error("Upload Error:", error);
        window.showToast("Error uploading image.", "error");
        img.src = originalSrc;
    } finally {
        img.style.opacity = '1';
        input.value = ""; 
    }
};

// --- CLOSE DROPDOWN WHEN CLICKING OUTSIDE ---
window.addEventListener('click', (e) => {
    if (!e.target.closest('.header-profile-wrapper')) {
        const dd = document.getElementById('ProfileDropdown');
        if (dd) dd.style.display = 'none';
    }
});

function logout() {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        window.location.href = "/Login/Login.html";
    });
}
// --- A. PREVIEW FUNCTION (Opens Modal) ---
window.previewHeaderAvatar = function() {
    const input = document.getElementById('HeaderAvatarInput');
    const file = input.files[0];
    
    if (!file) return;

    selectedAvatarFile = file; // Store file globally

    const reader = new FileReader();
    reader.onload = function(e) {
        // Set image source
        document.getElementById('CentralPreviewImg').src = e.target.result;
        
        // Close Dropdown & Open Modal
        const dd = document.getElementById('ProfileDropdown');
        if(dd) dd.style.display = 'none';

        // Show Modal (Flex ensures centering)
        const modal = document.getElementById('AvatarPreviewModal');
        modal.style.display = 'flex'; 
    };
    reader.readAsDataURL(file);
};

// --- B. CANCEL FUNCTION (Closes Modal) ---
window.cancelHeaderAvatar = function() {
    selectedAvatarFile = null;
    document.getElementById('HeaderAvatarInput').value = ""; // Clear input
    document.getElementById('AvatarPreviewModal').style.display = 'none'; // Hide Modal
};

// --- C. SAVE FUNCTION (Uploads File) ---
window.saveHeaderAvatar = async function() {
    if (!selectedAvatarFile) return;

    const btn = document.getElementById('SaveAvatarBtn');
    const originalText = btn.innerText;
    btn.innerText = "Uploading...";
    btn.disabled = true;

    const formData = new FormData();
    formData.append('avatar', selectedAvatarFile);

    try {
        const response = await fetch('/api/users/upload-avatar', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            // Update Header Image Immediately
            const img = document.getElementById('HeaderProfilePic');
            if(img) img.src = data.newUrl;

            window.showtoast("Profile picture updated!");
            cancelHeaderAvatar(); // Closes modal & clears memory
        } else {
            window.showtoast("Upload failed: " + data.message, "error");
        }
    } catch (error) {
        console.error("Upload Error:", error);
        window.showtoast("Error uploading image.", "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};
function injectInterestModal() {
    if (document.getElementById('InterestModal')) return; // Prevent duplicates

    const modalHTML = `
    <div id="InterestModal" class="modal" style="display:none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Customize Your Feed</h3>
                <span class="close-modal" onclick="closeInterestModal()">×</span>
            </div>
            <div class="modal-body">
                <p>Select topics you want to see more of:</p>
                <div class="tags-container" id="GlobalInterestTags">
                    <button class="filter-tag" onclick="toggleInterest(this, 'Academic')">Academic</button>
                    <button class="filter-tag" onclick="toggleInterest(this, 'Sports')">Sports</button>
                    <button class="filter-tag" onclick="toggleInterest(this, 'Social')">Social</button>
                    <button class="filter-tag" onclick="toggleInterest(this, 'Arts')">Arts</button>
                    <button class="filter-tag" onclick="toggleInterest(this, 'Performance')">Performance</button>
                    <button class="filter-tag" onclick="toggleInterest(this, 'Tech')">Tech</button>
                     <button class="filter-tag" onclick="toggleInterest(this, 'Leadership')">Leadership</button><div class="modal-footer">
                <button class="save-prefs-btn" onclick="saveUserInterests()">💾 Save Interests</button>
            </div>
                </div>
                </div>
            </div>
            
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}
window.openInterestModal = async function() {
    const modal = document.getElementById('InterestModal');
    if (!modal) return;
    modal.style.display = 'block';

    try {
        const res = await fetch('/api/auth/me');
        const user = await res.json();
        globalInterests = new Set(user.interests || []);
        
        // Update UI
        document.querySelectorAll('#GlobalInterestTags .filter-tag').forEach(btn => {
            const tag = btn.innerText; 
            if (globalInterests.has(tag)) btn.classList.add('selected');
            else btn.classList.remove('selected');
        });
    } catch (e) { console.error("Error loading interests", e); }
};

window.closeInterestModal = function() {
    document.getElementById('InterestModal').style.display = 'none';
};

window.toggleInterest = function(btn, tag) {
    if (globalInterests.has(tag)) {
        globalInterests.delete(tag);
        btn.classList.remove('selected');
    } else {
        globalInterests.add(tag);
        btn.classList.add('selected');
    }
};

window.saveUserInterests = async function() {
    const btn = document.querySelector('.save-prefs-btn');
    const originalText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;

    try {
        const response = await fetch('/api/users/interests', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interests: Array.from(globalInterests) })
        });

        if (response.ok) {
            btn.innerText = "✅ Saved!";
            setTimeout(() => {
                btn.innerText = originalText;
                btn.disabled = false;
                closeInterestModal();
                
                // SMART REFRESH: If we are on the Feed page, reload the posts!
                if (typeof loadPosts === "function") {
                    console.log("Refining feed...");
                    loadPosts(); 
                }
            }, 1000);
        }
    } catch (e) {
        window.showtoast("Error saving.", "error");
        btn.disabled = false;
    }
};
function injectPublicProfileModal() {
    if (document.getElementById('PublicProfileModal')) return;

    const modalHTML = `
    <div id="PublicProfileModal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:20000; justify-content:center; align-items:center;">
        <div class="modal-content" style="background:white; border-radius:15px; width:95%; max-width:450px; overflow:hidden;">
            <div class="share-header" style="background:#fa3737; color:white; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; font-size:1.1rem;">User Profile</span>
                <span onclick="document.getElementById('PublicProfileModal').style.display='none'" style="cursor:pointer; font-size:1.5rem; color:white;">&times;</span>
            </div>
            
            <div class="profile-modal-body" style="padding:20px; text-align:center; background:white;">
                <div class="profile-modal-avatar-container" style="width:120px; height:120px; margin:0 auto 15px auto; position:relative;">
                    <img id="PubModalImg" src="" style="width:100%; height:100%; border-radius:50%; object-fit:cover; border:4px solid #fa3737;">
                </div>

                <h2 id="PubModalName" style="margin:0; font-size:1.5rem; color:#333;"></h2>
                <p id="PubModalHandle" style="color:#666; font-size:0.9rem; margin-bottom:15px;"></p>

                <div id="PubModalBadges" class="user-badge-container" style="display:flex; justify-content:center; gap:8px; margin-bottom:20px;">
                    </div>

                <div style="text-align:left; padding: 0 10px;">
                    <label style="font-size:0.8rem; font-weight:bold; color:#888; text-transform:uppercase;">BIO</label>
                    <div id="PubModalBio" style="width:100%; margin-top:5px; padding:12px; border:1px solid #ddd; border-radius:8px; background:#f9f9f9; color:#444; font-size:0.95rem; line-height:1.5; white-space: pre-wrap;"></div>
                </div>

                <div id="PubModalClubContainer" class="club-membership-list" style="margin:20px 10px 10px 10px; padding:12px; border-radius:8px; text-align:left; border-left:4px solid #666; background:#f9f9f9;">
                    <label style="font-size:0.8rem; font-weight:bold; color:#888; text-transform:uppercase;">CLUB MEMBERSHIP</label>
                    <p id="PubModalClubText" style="margin:5px 0 0 0; font-weight:600; color:#333; display:flex; align-items:center;">
                        </p>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add dark mode CSS
    const style = document.createElement('style');
    style.innerHTML = `
        body.dark-mode #PublicProfileModal .modal-overlay { background: rgba(0, 0, 0, 0.8); }
        body.dark-mode #PublicProfileModal .modal-content { 
            background: #1e1e1e; 
            border: 1px solid #333;
            box-shadow: 0 15px 40px rgba(0,0,0,0.8);
        }
        body.dark-mode #PublicProfileModal .share-header { 
            background: #fa3737; 
        }
        body.dark-mode #PublicProfileModal .profile-modal-body {
            background: #1e1e1e;
        }
        body.dark-mode #PublicProfileModal #PubModalName,
        body.dark-mode #PublicProfileModal #PubModalBio {
            color: #fff;
        }
        body.dark-mode #PublicProfileModal #PubModalHandle {
            color: #aaa;
        }
        body.dark-mode #PublicProfileModal .profile-modal-body label {
            color: #aaa;
        }
        body.dark-mode #PublicProfileModal #PubModalBio {
            background: #2c2c2c;
            border-color: #444;
            color: #fff;
        }
        body.dark-mode #PublicProfileModal #PubModalClubContainer {
            background: #2c2c2c !important;
            border-left-color: #666 !important;
        }
        body.dark-mode #PublicProfileModal #PubModalClubText {
            color: #fff;
        }
    `;
    document.head.appendChild(style);
}

// Close modal if clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('InterestModal');
    if (event.target == modal) closeInterestModal();
};
(function setFavicon() {
    let link = document.querySelector("link[rel~='icon']");
    
    // If no favicon link exists, create one
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    
    // Set the path to your image
    link.href = '/public/favicon.png'; 
})();
function setupMobileMenu() {
    const header = document.getElementById('HomeHeader');
    if (!header || document.getElementById('HamburgerBtn')) return;

    // 1. Create Button
    const btn = document.createElement('button');
    btn.id = 'HamburgerBtn';
    btn.innerHTML = '☰';
    btn.onclick = toggleSidebar;
    
    // 2. Insert at the START of Header (Left side)
    header.insertBefore(btn, header.firstChild);

    // 3. Create Overlay (Dark background when menu is open)
    const overlay = document.createElement('div');
    overlay.id = 'SidebarOverlay';
    overlay.onclick = toggleSidebar; // Clicking overlay closes menu
    document.body.appendChild(overlay);
}

window.toggleSidebar = function() {
    const sidebar = document.getElementById('MainSideBar');
    const overlay = document.getElementById('SidebarOverlay');
    
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    } else {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    }
};

// Auto-close menu when clicking a link
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('SidebarItem')) {
        const sidebar = document.getElementById('MainSideBar');
        const overlay = document.getElementById('SidebarOverlay');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        }
    }
}); 
(function loadIcons() {
    if (!document.querySelector('link[href*="boxicons"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css';
        document.head.appendChild(link);
    }
})();
(function loadFonts() {
    if (!document.getElementById('GoogleFonts')) {
        const link = document.createElement('link');
        link.id = 'GoogleFonts';
        link.rel = 'stylesheet';
        
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700;800&display=swap';
        document.head.appendChild(link);
    }
})();
window.openFullProfileModal = async function() {
    const modal = document.getElementById('FullProfileModal');
    if (!modal) return;

    modal.style.display = 'flex';

    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const user = await res.json();
            document.getElementById('FullModalImg').src = user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff&size=128`;
            document.getElementById('UserProfileBio').value = user.bio || "";
            const position = user.clubPosition || 'Member';

            // --- POPULATE ROLE BADGES ---
            const badgeContainer = document.getElementById('FullModalBadges');
            let badgesHTML = '';
            
            // Admin Badge
            if (user.usertype === 'Admin') {
                badgesHTML += '<span class="role-badge badge-admin" style="background:black; color:white; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold;">Administrator</span>';
            } 
            // Adviser Badge
            else if (user.usertype === 'Teacher') {
                badgesHTML += '<span class="role-badge badge-adviser" style="background:#fa3737; color:white; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold;">Club Adviser</span>';
            } 
            // Officer Badge (President, VP, etc.) - Use role colors
            else if (position !== 'Member' && position !== 'Active Member') {
                const roleColor = getRoleColor(position);
                badgesHTML += `<span class="role-badge" style="background:${roleColor.border}; color:white; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><i class='bx bxs-star'></i> ${position}</span>`;
            }
            // Active Member Badge (Cyan)
            else if (position === 'Active Member') {
                badgesHTML += `<span class="role-badge" style="background:#00ced1; color:white; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold;"><i class='bx bxs-bolt'></i> ${position}</span>`;
            }
            // Standard Member Badge
            else {
                badgesHTML += '<span class="role-badge badge-member" style="background:#666; color:white; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold;">University Student</span>';
            }
            badgeContainer.innerHTML = badgesHTML;

            // --- POPULATE CLUB MEMBERSHIP ---
            const clubContainer = document.getElementById('FullModalClubContainer');
            const clubText = document.getElementById('FullModalClubText');
            const hasClub = user.club && user.club !== 'none' && user.club !== 'Pending';

            if (hasClub) {
                const isStaff = user.usertype === 'Teacher' || user.usertype === 'Admin';
                let borderColor, bgColor, roleLabel, tagColor, icon;

                if (isStaff) {
                    borderColor = "#fa3737";
                    bgColor = "#fff5f5";
                    roleLabel = 'Adviser';
                    tagColor = '#fa3737';
                    icon = 'bx-briefcase-alt-2';
                } else if (position !== 'Member') {
                    // Use role-specific colors for officers
                    const roleColor = getRoleColor(position);
                    borderColor = roleColor.border;
                    bgColor = roleColor.bg;
                    roleLabel = position;
                    tagColor = roleColor.border;
                    icon = 'bx-user-check';
                } else {
                    // Regular member
                    borderColor = "#666";
                    bgColor = "#f9f9f9";
                    roleLabel = 'Member';
                    tagColor = '#666';
                    icon = 'bx-user-check';
                }

                clubContainer.style.borderLeft = `4px solid ${borderColor}`;
                clubContainer.style.background = bgColor;

                clubText.innerHTML = `
                    <i class='bx ${icon}' style="color:${tagColor}; margin-right:8px; font-size:1.2rem;"></i> 
                    ${user.club}
                    <span style="background:${tagColor}; color:white; font-size:0.7rem; padding:2px 8px; border-radius:4px; margin-left:10px; vertical-align:middle;">${roleLabel}</span>
                `;
            } else {
                clubContainer.style.borderLeft = "4px solid #ccc";
                clubText.innerHTML = `<i class='bx bx-x-circle' style="color:#ccc; margin-right:8px; font-size:1.2rem;"></i> No Active Affiliation`;
            }
        }
    } catch (e) { console.error("Profile Load Error:", e); }
};

window.closeFullProfileModal = function() {
    const modal = document.getElementById('FullProfileModal');
    if (modal) modal.style.display = 'none';
};

window.saveProfileChanges = async function() {
    const bioElement = document.getElementById('UserProfileBio');
    if (!bioElement) return;

    const bio = bioElement.value; // Get the latest text typed by user
    const btn = event.target;
    const originalText = btn.innerText;

    try {
        btn.innerText = "Saving...";
        btn.disabled = true;

        const response = await fetch('/api/users/profile-update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bio: bio }) // Ensure the key is "bio"
        });

        if (response.ok) {
            const data = await response.json();
            btn.innerText = "✅ Saved!";
            
            // Optional: Alert the user or update a local variable
            setTimeout(() => {
                btn.innerText = originalText;
                btn.disabled = false;
                // closeFullProfileModal(); // Keep it open if you want them to see the success
            }, 1500);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || "Update failed");
        }
    } catch (e) {
        window.showtoast("Error saving: " + e.message, "error");
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// Update previewHeaderAvatar to target the new Modal image ID
window.previewHeaderAvatar = function() {
    const input = document.getElementById('HiddenAvatarInput');
    const file = input.files[0];
    if (!file) return;

    selectedAvatarFile = file;
    const reader = new FileReader();
    reader.onload = function(e) {
        // Open the existing preview modal logic we built earlier
        document.getElementById('CentralPreviewImg').src = e.target.result;
        document.getElementById('AvatarPreviewModal').style.display = 'flex'; 
    };
    reader.readAsDataURL(file);
};


// 2. Function to fetch and show any user's profile
// Helper function to get role color (matches ClubChat.css styling)
function getRoleColor(position) {
    const roleColors = {
        'President': { border: '#FFD700', bg: '#FFF8DC' },
        'Vice President': { border: '#C0C0C0', bg: '#F5F5F5' },
        'Secretary': { border: '#FF69B4', bg: '#FFE4E1' },
        'Treasurer': { border: '#2ecc71', bg: '#E8F5E9' },
        'Auditor': { border: '#9b59b6', bg: '#F3E5F5' },
        'PIO': { border: '#e67e22', bg: '#FFF3E0' },
        'Active Member': { border: '#00ced1', bg: '#E0F7FA' }
    };
    return roleColors[position] || { border: '#666', bg: '#f9f9f9' };
}
function injectFullProfileModal() {
    // 1. Prevent duplicate injection
    if (document.getElementById('FullProfileModal')) return;

    const modalHTML = `
    <div id="FullProfileModal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:20000; justify-content:center; align-items:center; backdrop-filter: blur(4px);">
        <div class="modal-content" style="background:white; border-radius:15px; width:95%; max-width:400px; overflow:hidden; box-shadow: 0 15px 40px rgba(0,0,0,0.3); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            
            <div class="share-header" style="background:#fa3737; color:white; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; font-family:'Montserrat', sans-serif;">My Profile Settings</span>
                <span onclick="window.closeFullProfileModal()" style="cursor:pointer; font-size:1.8rem; line-height:1; color:white;">&times;</span>
            </div>
            
            <div class="profile-modal-body" style="padding:25px; text-align:center; background:white;">
                
                <div class="profile-modal-avatar-container" 
                     onclick="document.getElementById('HiddenAvatarInput').click()" 
                     style="width:120px; height:120px; margin:0 auto 20px auto; position:relative; cursor:pointer; group;">
                    
                    <img id="FullModalImg" src="/uploads/default_pfp.png" 
                         style="width:100%; height:100%; border-radius:50%; object-fit:cover; border:4px solid #fa3737; transition: filter 0.3s;">
                    
                    <div class="avatar-edit-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); border-radius:50%; display:flex; align-items:center; justify-content:center; opacity:0; transition: opacity 0.3s;">
                        <i class='bx bx-camera' style="color:white; font-size:2rem;"></i>
                    </div>
                    
                    <input type="file" id="HiddenAvatarInput" style="display:none;" accept="image/*" onchange="window.previewHeaderAvatar()">
                </div>

                <div id="FullModalBadges" class="user-badge-container" style="display:flex; justify-content:center; gap:8px; margin-bottom:20px;">
                </div>

                <div style="text-align:left; margin-bottom:20px;">
                    <label style="font-size:0.75rem; font-weight:800; color:#888; text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:8px;">
                        About Me
                    </label>
                    <textarea id="UserProfileBio" 
                              placeholder="Tell the community about yourself..."
                              style="width:100%; height:120px; padding:12px; border-radius:10px; border:1px solid #ddd; resize:none; font-family:'Inter', sans-serif; font-size:0.95rem; line-height:1.5; color:#333; outline:none; transition: border-color 0.2s; background:white;"></textarea>
                </div>

                <div id="FullModalClubContainer" class="club-membership-list" style="margin:20px 0 20px 0; padding:12px; border-radius:8px; text-align:left; border-left:4px solid #666; background:#f9f9f9;">
                    <label style="font-size:0.8rem; font-weight:bold; color:#888; text-transform:uppercase;">CLUB MEMBERSHIP</label>
                    <p id="FullModalClubText" style="margin:5px 0 0 0; font-weight:600; color:#333; display:flex; align-items:center;">
                    </p>
                </div>

                <button onclick="window.saveProfileChanges(event)" 
                        class="save-prefs-btn" 
                        style="width:100%; background:#fa3737; color:white; border:none; padding:12px; border-radius:30px; font-weight:bold; font-family:'Montserrat', sans-serif; cursor:pointer; box-shadow: 0 4px 12px rgba(250, 55, 55, 0.2); transition: transform 0.2s;">
                    Save Profile Changes
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add CSS for the hover effect and dark mode support
    const style = document.createElement('style');
    style.innerHTML = `
        .profile-modal-avatar-container:hover .avatar-edit-overlay { opacity: 1 !important; }
        .profile-modal-avatar-container:hover img { filter: brightness(80%); }
        
        /* DARK MODE STYLES */
        body.dark-mode #FullProfileModal .modal-overlay { background: rgba(0, 0, 0, 0.8); }
        body.dark-mode #FullProfileModal .modal-content { 
            background: #1e1e1e; 
            border: 1px solid #333;
            box-shadow: 0 15px 40px rgba(0,0,0,0.8);
        }
        body.dark-mode #FullProfileModal .share-header { 
            background: #fa3737; 
            color: white;
        }
        body.dark-mode #FullProfileModal .profile-modal-body {
            background: #1e1e1e;
        }
        body.dark-mode #FullProfileModal .profile-modal-body label { 
            color: #aaa;
        }
        body.dark-mode #FullProfileModal .profile-modal-body h2,
        body.dark-mode #FullProfileModal .profile-modal-body p {
            color: #fff;
        }
        body.dark-mode #UserProfileBio { 
            background: #2c2c2c; 
            border-color: #444; 
            color: #fff;
        }
        body.dark-mode #UserProfileBio::placeholder {
            color: #666;
        }
        body.dark-mode #FullModalClubContainer { 
            background: #2c2c2c !important;
            border-left: 4px solid #666 !important;
        }
        body.dark-mode #FullModalClubContainer label {
            color: #aaa;
        }
        body.dark-mode #FullModalClubText {
            color: #fff;
        }
        body.dark-mode #FullProfileModal .save-prefs-btn {
            background: #fa3737;
            color: white;
            border: 1px solid #c92a2a;
        }
        body.dark-mode #FullProfileModal .save-prefs-btn:hover {
            background: #e62222;
        }
        body.dark-mode #FullModalBadges {
            background: transparent;
        }
    `;
    document.head.appendChild(style);
}

window.viewUserProfile = async function(userName) {
    injectPublicProfileModal(); 
    const modal = document.getElementById('PublicProfileModal');
    
    try {
        const res = await fetch(`/api/users/public-profile/${encodeURIComponent(userName)}`);
        if (!res.ok) throw new Error("User not found");
        
        const user = await res.json();
        const position = user.clubPosition || 'Member'; // Get officer role

        // --- 1. SET BASIC INFO ---
        document.getElementById('PubModalImg').src = user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff&size=128`;
        document.getElementById('PubModalName').innerText = user.name;
        document.getElementById('PubModalHandle').innerText = `@${user.usertype.toLowerCase()}`;
        document.getElementById('PubModalBio').innerText = user.bio || "No bio available.";

        // --- 2. DYNAMIC BADGE LOGIC (Including Officers) ---
        const badgeContainer = document.getElementById('PubModalBadges');
        let badgesHTML = '';
        
        // Admin Badge
        if (user.usertype === 'Admin') {
            badgesHTML += '<span class="role-badge badge-admin" style="background:black; color:white; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold;">Administrator</span>';
        } 
        // Adviser Badge
        else if (user.usertype === 'Teacher') {
            badgesHTML += '<span class="role-badge badge-adviser" style="background:#fa3737; color:white; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold;">CLUB Adviser</span>';
        } 
        // Officer Badge (President, VP, etc.) - Use role colors
        else if (position !== 'Member' && position !== 'Active Member') {
            const roleColor = getRoleColor(position);
            badgesHTML += `<span class="role-badge" style="background:${roleColor.border}; color:white; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><i class='bx bxs-star'></i> ${position}</span>`;
        }
        // Active Member Badge (Cyan)
        else if (position === 'Active Member') {
            badgesHTML += `<span class="role-badge" style="background:#00ced1; color:white; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold;"><i class='bx bxs-bolt'></i> ${position}</span>`;
        }
        // Standard Member Badge
        else {
            badgesHTML += '<span class="role-badge badge-member" style="background:#666; color:white; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold;">University Student</span>';
        }
        badgeContainer.innerHTML = badgesHTML;

        // --- 3. CLUB MEMBERSHIP STYLING ---
        const clubContainer = document.getElementById('PubModalClubContainer');
        const clubText = document.getElementById('PubModalClubText');
        const hasClub = user.club && user.club !== 'none' && user.club !== 'Pending';

        if (hasClub) {
            const isStaff = user.usertype === 'Teacher' || user.usertype === 'Admin';
            let borderColor, bgColor, roleLabel, tagColor, icon;

            if (isStaff) {
                borderColor = "#fa3737";
                bgColor = "#fff5f5";
                roleLabel = 'Adviser';
                tagColor = '#fa3737';
                icon = 'bx-briefcase-alt-2';
            } else if (position !== 'Member') {
                // Use role-specific colors for officers
                const roleColor = getRoleColor(position);
                borderColor = roleColor.border;
                bgColor = roleColor.bg;
                roleLabel = position;
                tagColor = roleColor.border;
                icon = 'bx-user-check';
            } else {
                // Regular member
                borderColor = "#666";
                bgColor = "#f9f9f9";
                roleLabel = 'Member';
                tagColor = '#666';
                icon = 'bx-user-check';
            }

            clubContainer.style.borderLeft = `4px solid ${borderColor}`;
            clubContainer.style.background = bgColor;

            clubText.innerHTML = `
                <i class='bx ${icon}' style="color:${tagColor}; margin-right:8px; font-size:1.2rem;"></i> 
                ${user.club}
                <span style="background:${tagColor}; color:white; font-size:0.7rem; padding:2px 8px; border-radius:4px; margin-left:10px; vertical-align:middle;">${roleLabel}</span>
            `;
        } else {
            clubContainer.style.borderLeft = "4px solid #ccc";
            clubText.innerHTML = `<i class='bx bx-x-circle' style="color:#ccc; margin-right:8px; font-size:1.2rem;"></i> No Active Affiliation`;
        }
        
        modal.style.display = 'flex';
    } catch (e) {
        console.error("Error showing profile:", e);
    }
};
// Update DOMContentLoaded to include the injection
document.addEventListener("DOMContentLoaded", () => {
    // ... existing loads
    injectPublicProfileModal();
});
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

// 2. Global variables to track PDF state
window.currentPdfDoc = null;
window.currentPdfPage = 1;
window.totalPdfPages = 1;
window.currentPdfUrl = "";

// 3. Main Viewer Function
window.viewDocument = async function(url, fileName) {
    const container = document.getElementById('PreviewContainer');
    const title = document.getElementById('PreviewDocTitle');
    const downloadLink = document.getElementById('DownloadLink');
    const modal = document.getElementById('DocPreviewFull');

    // Reset state for new document
    window.currentPdfUrl = url;
    window.currentPdfDoc = null;
    window.currentPdfPage = 1;
    window.totalPdfPages = 1;

    if (modal) modal.style.display = 'flex';
    if (title) title.innerText = fileName || "Document Preview";
    if (downloadLink) downloadLink.href = url;

    container.innerHTML = '<div style="color:white; text-align:center; padding:40px; font-size:1.2rem;">Loading Document...</div>';

    const isPDF = url.toLowerCase().endsWith('.pdf');

    // Handle standard images (PNG/JPG) normally
    if (!isPDF) {
        container.innerHTML = `
            <div class="pdf-page-wrapper" data-page="1" style="position:relative; box-shadow: 0 0 20px rgba(0,0,0,0.5); background:white; line-height:0; display:inline-block; margin:auto;">
                <img src="${url}" style="max-width:100%; height:auto; display:block;" id="DocImagePreview">
            </div>
        `;
        return;
    }

    // Handle PDFs using PDF.js (Single Page Render)
    try {
        const loadingTask = pdfjsLib.getDocument(url);
        window.currentPdfDoc = await loadingTask.promise;
        window.totalPdfPages = window.currentPdfDoc.numPages;
        window.currentPdfPage = 1;

        // Setup Toolbar & Container 
        container.innerHTML = `
            <div style="text-align:center; padding: 10px; background: #333; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); flex-shrink: 0; width: 100%; max-width: 800px; margin: 0 auto 15px auto;">
                <button onclick="changePdfPage(-1)" class="btn-cancel" style="padding: 5px 15px; font-weight:bold; cursor:pointer;">◀ Prev</button>
                <span style="color:white; margin:0 20px; font-weight:bold; font-size:1.1rem;">Page <span id="PdfPageNum">1</span> of ${window.totalPdfPages}</span>
                <button onclick="changePdfPage(1)" class="btn-cancel" style="padding: 5px 15px; font-weight:bold; cursor:pointer;">Next ▶</button>
            </div>
            
            <div class="pdf-page-wrapper" data-page="1" style="position:relative; box-shadow: 0 0 20px rgba(0,0,0,0.5); background:white; line-height:0; display:inline-block; margin:auto;">
                <canvas id="PdfCanvas" style="display:block; max-width:100%; height:auto;"></canvas>
            </div>
        `;

        // Render the first page
        await renderCurrentPage();

    } catch (err) {
        console.error("PDF.js Render Error:", err);
        container.innerHTML = '<div style="color:#fa3737; text-align:center; padding:20px; background:white; border-radius:8px; margin:auto;">Failed to load PDF preview.</div>';
    }
};

// 4. Page Navigation Function
window.changePdfPage = async function(delta) {
    if (!window.currentPdfDoc) return;
    
    let newPage = window.currentPdfPage + delta;
    if (newPage < 1 || newPage > window.totalPdfPages) return; // Prevent going out of bounds
    
    window.currentPdfPage = newPage;
    document.getElementById('PdfPageNum').innerText = newPage;
    
    const wrapper = document.querySelector('.pdf-page-wrapper');
    if (wrapper) wrapper.dataset.page = newPage; // Update the tracking dataset for signature logic
    
    await renderCurrentPage();
};

window.renderCurrentPage = async function() {
    if (!window.currentPdfDoc) return;
    
    try {
        const page = await window.currentPdfDoc.getPage(window.currentPdfPage);
        const viewport = page.getViewport({ scale: 1.5 }); // 1.5x scale for crisp text resolution
        
        const canvas = document.getElementById('PdfCanvas');
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Clear any existing signature overlays when flipping pages
        document.querySelectorAll('.SignaturePlacementOverlay, .GhostSignature').forEach(el => el.remove());

        await page.render({ canvasContext: context, viewport: viewport }).promise;
    } catch (err) {
        console.error("Error rendering page:", err);
    }
};

// Ensure close function is also present
window.closeDocPreview = function() {
    const modal = document.getElementById('DocPreviewFull');
    if (modal) modal.style.display = 'none';
    
    const container = document.getElementById('PreviewContainer');
    if (container) container.innerHTML = ""; // Clear HTML content
    
    // Reset global PDF state to free up browser memory
    window.currentPdfDoc = null;
    window.currentPdfPage = 1;
    window.totalPdfPages = 1;
    window.currentPdfUrl = "";
};
(function injectToastStyles() {
    if (document.getElementById('ToastStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'ToastStyles';
    style.innerHTML = `
        #ToastContainer {
            position: fixed;
            top: 90px; /* Sits just below your top header */
            right: 20px;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none; /* Lets you click through the empty space */
        }
        .custom-toast {
            min-width: 250px;
            max-width: 350px;
            background: #fff;
            color: #333;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.95rem;
            font-weight: 500;
            pointer-events: auto; /* Makes the toast itself clickable */
            transform: translateX(120%);
            opacity: 0;
            transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.4s;
            border-left: 5px solid #ccc;
        }
        .custom-toast.show {
            transform: translateX(0);
            opacity: 1;
        }
        .custom-toast.hide {
            transform: translateX(120%);
            opacity: 0;
        }
        .toast-success { border-left-color: #28a745; }
        .toast-error { border-left-color: #fa3737; }
        .toast-info { border-left-color: #007bff; }
        
        /* Dark Mode Support */
        body.dark-mode .custom-toast {
            background: #1e1e1e;
            color: #fff;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        }
    `;
    document.head.appendChild(style);
})();

// 2. The Universal Toast Function
window.showToast = function(message, type = 'info') {
    // Check if container exists, build if not
    let container = document.getElementById('ToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'ToastContainer';
        document.body.appendChild(container);
    }

    // Create the toast element
    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;

    // Assign Boxicons based on type
    let icon = "<i class='bx bx-info-circle' style='color:#007bff; font-size:1.5rem;'></i>";
    if (type === 'success') icon = "<i class='bx bx-check-circle' style='color:#28a745; font-size:1.5rem;'></i>";
    if (type === 'error') icon = "<i class='bx bx-x-circle' style='color:#fa3737; font-size:1.5rem;'></i>";

    // Build the HTML structure
    toast.innerHTML = `
        ${icon}
        <div style="flex:1; line-height:1.4;">${message}</div>
        <i class='bx bx-x' style='cursor:pointer; font-size:1.2rem; color:#888;' 
           onclick="this.parentElement.classList.add('hide'); setTimeout(() => this.parentElement.remove(), 400);"></i>
    `;

    // Add to container
    container.appendChild(toast);

    // Trigger Slide-In Animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto Slide-Out after 4 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            toast.classList.add('hide');
            // Remove from DOM after transition
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 400); 
        }
    }, 4000);
};
// Global.js - ADD TO VERY TOP
(function deterConsoleSnoopers() {
    // 1. Print a massive warning
    console.log("%cSTOP!", "color: red; font-size: 50px; font-weight: bold; text-shadow: 2px 2px 0px black;");
    console.log("%cThis is a browser feature intended for developers. If someone told you to copy-paste something here to enable a feature or 'hack' an account, it is a scam and will give them access to your account.", "font-size: 18px; color: #333;");
    
    // 2. Optional: Clear the console immediately if they aren't quick enough
    // setInterval(() => console.clear(), 2000); 
})();(function(){
    window.unlockConsole = function(passcode) {
        // Use a specific developer passcode (Do NOT use your actual admin account password here)
        if (passcode === "MeowMeowhahaha") {
            
            // 3. If correct, attach the dev tools to the window so you can use them
            
            console.clear();
            console.log("%c🔓 CONSOLE UNLOCKED", "color: #28a745; font-size: 24px; font-weight: bold;");
            console.log("%cDeveloper tools have been mounted to 'NexusAdmin'.", "color: #333; font-size: 14px;");
            console.log("Type %cNexusAdmin.%c to see available commands.", "color: #fa3737; font-weight: bold;", "color: inherit;");
            
            return "Welcome back, Admin.";
        } else {
            console.log("%c❌ ACCESS DENIED", "color: #fa3737; font-size: 24px; font-weight: bold;");
            return "Intruder logged.";
        }
    };
})();
(function injectConfirmModal() {
    if (document.getElementById('CustomConfirmModal')) return;

    const modalHTML = `
    <div id="CustomConfirmModal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999999; justify-content:center; align-items:center; backdrop-filter: blur(2px);">
        <div class="modal-content" style="background:white; border-radius:12px; width:90%; max-width:400px; padding:25px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); text-align:center; animation: popIn 0.2s ease-out;">
            <h3 id="ConfirmModalTitle" style="margin-top:0; color:#333; font-size:1.3rem;">Confirm Action</h3>
            <p id="ConfirmModalMessage" style="color:#666; font-size:1rem; margin-bottom:25px; line-height:1.5;"></p>
            
            <div style="display:flex; justify-content:center; gap:15px;">
                <button id="ConfirmCancelBtn" class="btn-cancel" style="padding:10px 20px; font-weight:bold; width:100%;">Cancel</button>
                <button id="ConfirmAcceptBtn" class="btn-confirm" style="padding:10px 20px; font-weight:bold; width:100%;">Confirm</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const style = document.createElement('style');
    style.innerHTML = `
        body.dark-mode #CustomConfirmModal .modal-content { background: #1e1e1e; border: 1px solid #444; }
        body.dark-mode #ConfirmModalTitle { color: #fff !important; }
        body.dark-mode #ConfirmModalMessage { color: #aaa !important; }
    `;
    document.head.appendChild(style);
})();

// Promise-based Confirm Function
window.showConfirm = function(title, message, confirmText = "Confirm", confirmColor = "#fa3737") {
    return new Promise((resolve) => {
        const modal = document.getElementById('CustomConfirmModal');
        const titleEl = document.getElementById('ConfirmModalTitle');
        const messageEl = document.getElementById('ConfirmModalMessage');
        const acceptBtn = document.getElementById('ConfirmAcceptBtn');
        const cancelBtn = document.getElementById('ConfirmCancelBtn');

        // Set Content
        titleEl.innerText = title;
        messageEl.innerHTML = message;
        acceptBtn.innerText = confirmText;
        acceptBtn.style.backgroundColor = confirmColor;

        modal.style.display = 'flex';

        // Cleanup function to remove listeners
        const cleanup = () => {
            modal.style.display = 'none';
            acceptBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        // Handle Clicks
        acceptBtn.onclick = () => { cleanup(); resolve(true); };
        cancelBtn.onclick = () => { cleanup(); resolve(false); };
    });
};
(function injectReportModal() {
    if (document.getElementById('ReportModalOverlay')) return;

    const modalHTML = `
    <div id="ReportModalOverlay" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999999; justify-content:center; align-items:center; backdrop-filter: blur(2px);">
        <div class="modal-content" style="background:white; border-radius:12px; width:90%; max-width:400px; padding:25px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); animation: popIn 0.2s ease-out;">
            <h3 style="margin-top:0; color:#fa3737; font-size:1.3rem; display:flex; align-items:center; gap:8px;">
                <i class='bx bx-flag'></i> Report Content
            </h3>
            <p style="color:#666; font-size:0.95rem; margin-bottom:15px; line-height:1.4;">
                Please provide a reason for reporting this <span id="ReportModalType" style="font-weight:bold; text-transform:lowercase;"></span>. Our administrators will review it shortly.
            </p>
            
            <textarea id="ReportModalReason" placeholder="Inappropriate content, spam, harassment..." style="width:100%; height:100px; padding:12px; border-radius:8px; border:1px solid #ddd; resize:none; font-family:inherit; font-size:0.95rem; margin-bottom:20px; outline:none; box-sizing:border-box;"></textarea>
            
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="ReportCancelBtn" class="btn-cancel" style="padding:10px 20px; font-weight:bold; border-radius:6px; cursor:pointer;">Cancel</button>
                <button id="ReportSubmitBtn" class="btn-confirm" style="padding:10px 20px; font-weight:bold; background:#fa3737; color:white; border:none; border-radius:6px; cursor:pointer;">Submit Report</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Dark Mode Support
    const style = document.createElement('style');
    style.innerHTML = `
        body.dark-mode #ReportModalOverlay .modal-content { background: #1e1e1e; border: 1px solid #444; }
        body.dark-mode #ReportModalOverlay p { color: #aaa !important; }
        body.dark-mode #ReportModalReason { background: #2c2c2c; border-color: #444; color: #fff; }
        body.dark-mode #ReportModalReason::placeholder { color: #777; }
    `;
    document.head.appendChild(style);
})();

// 2. The new Modal-based Report Function
window.reportContent = function(type, id) {
    const modal = document.getElementById('ReportModalOverlay');
    const typeSpan = document.getElementById('ReportModalType');
    const reasonInput = document.getElementById('ReportModalReason');
    const submitBtn = document.getElementById('ReportSubmitBtn');
    const cancelBtn = document.getElementById('ReportCancelBtn');

    // Reset and Show Modal
    typeSpan.innerText = type;
    reasonInput.value = ""; 
    modal.style.display = 'flex';
    reasonInput.focus();

    // Cleanup function
    const closeModal = () => {
        modal.style.display = 'none';
        submitBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    // Handle Cancel
    cancelBtn.onclick = closeModal;

    // Handle Submit
    submitBtn.onclick = async () => {
        const reason = reasonInput.value.trim();
        if (!reason) {
            if (window.showToast) window.showToast("Please enter a reason.", "error");
            else alert("Please enter a reason.");
            return;
        }

        // UI Feedback while loading
        const originalText = submitBtn.innerText;
        submitBtn.innerText = "Submitting...";
        submitBtn.disabled = true;

        try {
            const res = await fetch('/api/reports/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetType: type, targetId: id, reason })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                if (window.showToast) window.showToast("✅ Report submitted successfully.", "success");
                else alert("Report submitted successfully.");
                closeModal();
            } else {
                if (window.showToast) window.showToast("❌ Failed to submit: " + data.message, "error");
                else alert("Failed to submit: " + data.message);
            }
        } catch(e) { 
            console.error("Report error:", e);
            if (window.showToast) window.showToast("❌ Network error.", "error"); 
            else alert("Network error.");
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    };
};
window.addEventListener('focus', () => {
    checkNotifications(); // Refresh badges when user returns to the app
});