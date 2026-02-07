document.addEventListener("DOMContentLoaded", () => {
    loadSidebar();
    injectInterestModal();
    loadUserHeader();
    setupDarkMode(); // <--- Initialize Dark Mode
    setupMobileMenu();    
    checkNotifications();

    setInterval(checkNotifications, 30000);
});
let selectedAvatarFile = null;
let globalInterests = new Set();

// ==========================================
// 1. SIDEBAR LOADER
// ==========================================
function loadSidebar() {
    const sidebarList = document.getElementById('MainSideBarList');
    if (!sidebarList) return;

    // Standard Menu Items (Using Boxicons classes)
    const menuItems = [
        { name: "Home", link: "/ClubPortalFeed/ClubPortalFeed.html", icon: "bx bx-home-alt-2" },
        { name: "Clubs", link: "/ApplyClub/Clublist.html", icon: "bx bx-shield-quarter" },
        { name: "Messages", link: "/public/ClubChat/ChatInbox.html", icon: "bx bx-message-square-dots" },
        { name: "Following", link: "/FollowedClubs/FollowedClubs.html", icon: "bx bx-star" },
        { name: "Hidden Posts", link: "/HiddenPosts/HiddenPosts.html", icon: "bx bx-hide" },
        // Role Based
        { name: "Club Dashboard", link: "/TeacherDashboard/ClubAdviserDashboard.html", role: ['Teacher', 'Admin'], icon: "bx bxs-dashboard" },
        { name: "Admin Panel", link: "/AdminDashboard/AdminDashboard.html", role: ['Admin'], icon: "bx bx-cog" },
        // Actions
        { name: "Customize Feed", link: "#", onclick: "openInterestModal()", icon: "bx bx-slider-alt" },
        { name: "Logout", link: "#", onclick: "logout()", icon: "bx bx-log-out" }
    ];

    // 1. Generate Menu HTML
    let html = menuItems.map(item => {
        // (Optional: You can add role filtering logic here later)
        
        // Structure: Icon <i> + Name <span>
        const content = `<i class='${item.icon} sidebar-icon'></i> <span class="sidebar-text">${item.name}</span>`;

        if (item.onclick) {
            return `<li><a href="#" onclick="${item.onclick}" class="SidebarItem">${content}</a></li>`;
        }
        return `<li><a href="${item.link}" class="SidebarItem">${content}</a></li>`;
    }).join('');

    // 2. Add Dark Mode Switch (Update Icon here too)
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

        const isAdviser = user.usertype === 'Teacher' || user.usertype === 'Admin';
        const clubLabel = isAdviser ? 'FACULTY ADVISER' : 'CLUB MEMBERSHIP';
        const rowClass = isAdviser ? 'adviser-row' : 'member-row';
        const roleIcon = isAdviser ? 'bx-briefcase-alt-2' : 'bx-user-check';
        const roleTag = isAdviser ? `<span class="membership-tag tag-adviser">${isAdviser ? 'Adviser' : 'Staff'}</span>` : '<span class="membership-tag tag-member">Member</span>';
        
        const nameEl = document.getElementById('Name');
        if (nameEl) nameEl.innerText = user.name;
        
        const profileContainer = document.getElementById('UserProfile');
        if (profileContainer) {
            const imgSrc = user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff&size=128`;

            profileContainer.innerHTML = `
                <div class="header-profile-wrapper">
                    <img id="HeaderProfilePic" src="${imgSrc}" alt="Profile" 
                         onclick="openFullProfileModal()"
                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; cursor: pointer; border: 2px solid white;">
                </div>

                <div id="FullProfileModal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:10000; justify-content:center; align-items:center;">
                    <div class="modal-content" style="background:white; border-radius:15px; width:95%; max-width:450px; overflow:hidden;">
                        <div class="share-header" style="background:#fa3737; color:white; padding:15px; display:flex; justify-content:space-between;">
                            <span style="font-weight:bold;">User Profile</span>
                            <span onclick="closeFullProfileModal()" style="cursor:pointer; font-size:1.5rem;">&times;</span>
                        </div>
                        
                        <div class="profile-modal-body">
                            <div class="profile-modal-avatar-container" onclick="document.getElementById('HiddenAvatarInput').click()">
                                <img id="ModalProfileImg" src="${imgSrc}" class="profile-modal-avatar">
                                <i class='bx bx-camera avatar-overlay-icon'></i>
                            </div>
                            <input type="file" id="HiddenAvatarInput" accept="image/*" style="display:none;" onchange="previewHeaderAvatar()">

                            <h2 style="margin:0;">${user.name}</h2>
                            <p style="color:#666; font-size:0.9rem; margin-bottom:10px;">@${user.usertype.toLowerCase()}</p>

                            <div class="user-badge-container">
                                ${user.usertype === 'Admin' ? '<span class="role-badge badge-admin">Administrator</span>' : ''}
                                ${user.usertype === 'Teacher' ? '<span class="role-badge badge-adviser">Club Adviser</span>' : ''}
                                <span class="role-badge badge-member">University Member</span>
                            </div>

                            <div style="text-align:left; padding: 0 20px;">
                                <label style="font-size:0.8rem; font-weight:bold; color:#888;">BIO</label>
                                <textarea id="UserProfileBio" rows="3" placeholder="Tell us about yourself..." style="width:100%; margin-top:5px; padding:10px; border:1px solid #ddd; border-radius:8px;">${user.bio || ''}</textarea>
                            </div>

                            <div class="club-membership-list ${rowClass}" style="margin:15px 20px; padding:10px; border-radius:8px; text-align:left; background:#f9f9f9;">
                                <label style="font-size:0.8rem; font-weight:bold; color:#888;">${clubLabel}</label>
                                <p style="margin:5px 0 0 0; font-weight:600; color:#333; display:flex; align-items:center;">
                                    <i class='bx ${roleIcon}' style="color:#fa3737; margin-right:8px;"></i> 
                                    ${(user.club && user.club !== 'none') ? user.club : 'No Active Affiliation'}
                                    ${(user.club && user.club !== 'none') ? roleTag : ''}
                                </p>
                            </div>

                            <div style="margin:20px; display:flex; gap:10px;">
                                <button onclick="saveProfileChanges()" style="flex:1; padding:12px; background:#fa3737; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Save Profile</button>
                                <button onclick="logout()" style="padding:12px; background:#eee; color:#333; border:none; border-radius:8px; cursor:pointer;"><i class='bx bx-log-out'></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            createNotificationBell();
        }
    } catch (e) {
        console.error("Header Error:", e);
    }
}
function logout() {
    // Clear session/token
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        window.location.href = "/Login/Login.html";
    });
}
function createNotificationBell() {
    // 1. Target the User Profile container
    const profileContainer = document.getElementById('UserProfile');
    
    // Safety check: If profile doesn't exist, try header (Fallback)
    if (!profileContainer) {
        const header = document.getElementById('HomeHeader');
        if(header) {
            const wrapper = document.createElement('div');
            wrapper.className = 'notification-wrapper';
            wrapper.innerHTML = getBellHTML();
            header.appendChild(wrapper);
        }
        return; 
    }

    // 2. Create the Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'notification-wrapper';
    wrapper.style.display = "flex";       
    wrapper.style.alignItems = "center";  
    wrapper.style.marginRight = "15px";   
    
    wrapper.innerHTML = `
        <button id="NotifBtn" onclick="toggleNotifDropdown()">
            <i class='bx bx-bell'></i> <span id="NotifBadge">0</span>
        </button>
        
        <div id="NotifDropdown" class="notif-dropdown">
            <div class="notif-header-row">
                <span>Notifications</span>
                <button onclick="markAllRead()" class="mark-read-btn">Mark all read</button>
            </div>
            <div id="NotifList">
                <p class="empty-notif">Loading...</p>
            </div>
        </div>
    `;

    // 3. INJECT
    profileContainer.insertBefore(wrapper, profileContainer.firstChild);
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

// Helper to keep code clean
function getBellHTML() {
    return `
        <button id="NotifBtn" onclick="toggleNotifDropdown()">
            🔔
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
window.openFullProfileModal = function() {
    const modal = document.getElementById('FullProfileModal');
    if (modal) modal.style.display = 'flex';
};

window.closeFullProfileModal = function() {
    const modal = document.getElementById('FullProfileModal');
    if (modal) modal.style.display = 'none';
};

window.saveProfileChanges = async function() {
    const bio = document.getElementById('UserProfileBio').value;
    const btn = event.target;
    const originalText = btn.innerText;

    try {
        btn.innerText = "Saving...";
        btn.disabled = true;

        const response = await fetch('/api/users/profile-update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bio })
        });

        if (response.ok) {
            btn.innerText = "✅ Saved!";
            setTimeout(() => {
                btn.innerText = originalText;
                btn.disabled = false;
                closeFullProfileModal();
            }, 1500);
        } else {
            throw new Error("Update failed");
        }
    } catch (e) {
        alert("Error saving profile details.");
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