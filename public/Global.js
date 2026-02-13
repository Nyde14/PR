document.addEventListener("DOMContentLoaded", () => {
    loadSidebar();
    injectInterestModal();
    loadUserHeader();
    setupDarkMode(); // <--- Initialize Dark Mode
    setupMobileMenu();    
    checkNotifications();
    injectFullProfileModal();   // For "My Settings"
    injectPublicProfileModal(); // For "View Others"
    
    setInterval(checkNotifications, 30000);
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
        // Check if the user is assigned to a real club (not none or pending)
        const hasClubAssignment = user.club && user.club !== 'none' && user.club !== 'Pending';
        // Staff members are Teachers or Admins
        const isStaff = userRole === 'Teacher' || userRole === 'Admin';

        const menuItems = [
            { name: "Home", link: "/ClubPortalFeed/ClubPortalFeed.html", icon: "bx bx-home-alt-2" },
            { name: "Clubs", link: "/ApplyClub/Clublist.html", icon: "bx bx-shield-quarter" },
            { name: "Messages", link: "/public/ClubChat/ChatInbox.html", icon: "bx bx-message-square-dots" },
            { name: "Following", link: "/FollowedClubs/FollowedClubs.html", icon: "bx bx-star" },
            { name: "Hidden Posts", link: "/HiddenPosts/HiddenPosts.html", icon: "bx bx-hide" },
            
            // --- UPDATED CLUB DASHBOARD LOGIC ---
            // Now appears if (Teacher OR Admin) AND they have a club assigned
            { 
                name: "Club Dashboard", 
                link: "/TeacherDashboard/ClubAdviserDashboard.html", 
                visible: (isStaff && hasClubAssignment), 
                icon: "bx bxs-dashboard" 
            },
            
            // Admin Panel remains strictly for the Admin role
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
            .filter(item => item.visible !== false) // Removes items where 'visible' condition failed
            .map(item => {
                const content = `<i class='${item.icon} sidebar-icon'></i> <span class="sidebar-text">${item.name}</span>`;
                return item.onclick 
                    ? `<li><a href="#" onclick="${item.onclick}" class="SidebarItem">${content}</a></li>`
                    : `<li><a href="${item.link}" class="SidebarItem">${content}</a></li>`;
            })
            .join('');

        // Re-inject the standard bottom elements
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
        setupDarkMode(); // Re-attach listener to the newly created checkbox

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
            const roleLabel = isAdviser ? 'FACULTY ADVISER' : (user.clubPosition || 'MEMBER').toUpperCase();

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
    if (!listContainer) return; // Safety check

    try {
        // 1. Prepare Headers (Try to find a token)
        const token = localStorage.getItem('token'); 
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // 2. Make Request
        const response = await fetch('/api/notifications', {
            method: 'GET',
            headers: headers,
            credentials: 'include' 
        });
        
        // 3. Handle ALL Errors
        if (!response.ok) {
            console.error(`Notification Error: ${response.status} ${response.statusText}`);
            
            if (response.status === 401) {
                // Not Logged In
                listContainer.innerHTML = `
                    <div style="padding:20px; text-align:center;">
                        <p style="color:#666; margin-bottom:10px;">Please log in.</p>
                        <a href="/Login/Login.html" style="color:#fa3737; font-weight:bold;">Login</a>
                    </div>`;
            } else {
                // Any other error (404, 500, etc.)
                listContainer.innerHTML = `<p class="empty-notif">Error ${response.status}: Retrying...</p>`;
            }
            return; 
        }

        // 4. Success: Update UI
        const data = await response.json();
        
        // Debugging: Check if data is actually coming back
        // console.log("Notif Data:", data); 

        updateNotifUI(data.notifications, data.unread);

    } catch (error) {
        console.error("Notif fetch failed:", error);
        listContainer.innerHTML = '<p class="empty-notif">Connection Failed.</p>';
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

            alert("Profile picture updated!");
        } else {
            throw new Error(data.message);
        }

    } catch (error) {
        console.error("Upload Error:", error);
        alert("Failed to upload: " + error.message);
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
            alert("Profile picture updated!");
            toggleProfileDropdown(); // Close menu
        } else {
            alert("Upload failed: " + data.message);
            img.src = originalSrc;
        }
    } catch (error) {
        console.error("Upload Error:", error);
        alert("Error uploading image.");
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

            alert("Profile picture updated!");
            cancelHeaderAvatar(); // Closes modal & clears memory
        } else {
            alert("Upload failed: " + data.message);
        }
    } catch (error) {
        console.error("Upload Error:", error);
        alert("Error uploading image.");
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
                     <button class="filter-tag" onclick="toggleInterest(this, 'Leadership')">Leadership</button>
                </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="save-prefs-btn" onclick="saveUserInterests()">💾 Save Interests</button>
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
        alert("Error saving.");
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
                badgesHTML += '<span class="role-badge badge-adviser" style="background:#fa3737; color:white; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold;">Faculty Adviser</span>';
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
        alert("Error saving: " + e.message);
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
            badgesHTML += '<span class="role-badge badge-adviser" style="background:#fa3737; color:white; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold;">Faculty Adviser</span>';
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