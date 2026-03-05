// ==========================================
// 1. GLOBAL VARIABLES
// ==========================================
let chatRoom = "";       
let chatType = "group";  
let myName = "";
let myRole = "Student";     // General role (Adviser vs Student)
let globalUserType = "";    // DB Usertype (Admin, Teacher, Student)
let myClubPosition = "";    // Specific Officer role (President, etc.)
let isFirstLoad = true;
let currentPreviewURL = null; 

// ==========================================
// 2. INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/Login/Login.html';
            return;
        }

        // A. Get User Info
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // If token is expired or invalid, force redirect to Login
        if (!response.ok) {
            localStorage.removeItem('token');
            window.location.href = '/Login/Login.html';
            return;
        }
        
        const user = await response.json();
        
        myName = user.name;
        globalUserType = user.usertype;
        myClubPosition = user.clubPosition || 'Member'; 
        myRole = (user.usertype === 'Teacher' || user.usertype === 'Admin') ? 'Adviser' : 'Member';

        // B. Read URL Parameters
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room'); 
        const typeParam = urlParams.get('type'); 

        // C. Determine Chat Mode & Enforce Security
        if (roomParam && typeParam === 'private') {
            chatType = 'private';
            chatRoom = roomParam;
            const titleEl = document.getElementById('ChatTitle');
            if(titleEl) titleEl.innerText = `${chatRoom}`;
        } else {
            chatType = 'group';
            chatRoom = roomParam || user.club;

            // --- STRICT SECURITY GUARD: URL TAMPERING PREVENTION ---
            // If they are trying to access a specific group chat via URL...
            if (roomParam) {
                const isAdmin = user.usertype === 'Admin';
                const isMyClub = user.club && (user.club.toLowerCase() === roomParam.toLowerCase());

                // If they aren't an admin and the URL doesn't match their assigned club, kick them out.
                if (!isAdmin && !isMyClub) {
                    window.showtoast("Access Denied: You are not a member of this organization.", "error");
                    window.location.href = '/ClubPortalFeed/ClubPortalFeed.html';
                    return;
                }
            }

            // General check for users without any club
            if (!chatRoom || chatRoom === "none" || chatRoom === "Pending") {
                window.showtoast("Access Denied: You must be assigned to an organization to view this chat.", "error");
                window.location.href = '/ClubPortalFeed/ClubPortalFeed.html';
                return;
            }
            
            const titleEl = document.getElementById('ChatTitle');
            if(titleEl) titleEl.innerText = `${chatRoom} Group Chat`;
        }

        setupMediaHandlers();
        loadMessages();
        setInterval(loadMessages, 3000); // Poll every 3 seconds

    } catch (error) {
        console.error("Init Error:", error);
        // Failsafe redirect if server crashes during auth
        window.location.href = '/Login/Login.html';
    }
});

// ==========================================
// 3. CORE MESSAGING LOGIC
// ==========================================

// ClubChat.js - Fixed loadMessages function

async function loadMessages() {
    const container = document.getElementById('MessageArea'); 
    if (!container || !chatRoom) return; 

    const token = localStorage.getItem('token');

    try {
        const endpoint = (chatType === 'private') 
            ? `/api/chat/private/${encodeURIComponent(chatRoom)}` 
            : `/api/chat/${encodeURIComponent(chatRoom)}`;
            
        const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return; 

        const messages = await res.json();
        const shouldScroll = isFirstLoad || (container.scrollTop + container.clientHeight >= container.scrollHeight - 100);

        // Create placeholders for lazy loading
        container.innerHTML = messages.map(msg => {
            const placeholder = document.createElement('div');
            placeholder.className = 'message-placeholder';
            placeholder.id = `placeholder-${msg._id}`;
            placeholder.style.minHeight = '60px';
            placeholder.style.marginBottom = '10px';
            placeholder.dataset.messageData = JSON.stringify(msg);
            placeholder.dataset.isMe = (msg.sender === 'Me' || msg.sender === myName) ? 'true' : 'false';
            return placeholder.outerHTML;
        }).join('');

        // Setup lazy loading for messages
        setupChatMessageLazyLoading(messages);

        if (shouldScroll) { container.scrollTop = container.scrollHeight; isFirstLoad = false; }
        checkAndHighlightMessage(); // Call the highlight logic after rendering

    } catch (e) { console.error("Load Msg Error:", e); }
}

// ==========================================
// SETUP CHAT MESSAGE LAZY LOADING
// ==========================================
function setupChatMessageLazyLoading(messages) {
    if ('IntersectionObserver' in window) {
        const messageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const placeholder = entry.target;
                    const msg = JSON.parse(placeholder.dataset.messageData);
                    const isMe = placeholder.dataset.isMe === 'true';

                    // --- PERMISSION LOGIC ---
                    const isAdmin = globalUserType === 'Admin';
                    const isAdviserOfThisClub = globalUserType === 'Teacher' && chatRoom === (msg.clubname || chatRoom);
                    const canDelete = isMe || isAdmin || isAdviserOfThisClub;

                    // 1. Identify Role and Assign Border Class
                    const role = msg.officerRole || 'Member';
                    const roleKey = role.toLowerCase().replace(/\s+/g, '-');
                    const borderClass = (role !== 'Member' && role !== 'Student') ? `border-${roleKey}` : '';

                    // 2. Fixed Profile Picture Fallback
                    const avatarSrc = (msg.senderAvatar && msg.senderAvatar.trim() !== "") 
                        ? msg.senderAvatar 
                        : `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender)}&background=random&color=fff&size=64`;

                    // --- DELETED MESSAGE LOGIC ---
                    if (msg.isDeleted) {
                        placeholder.outerHTML = `<div class="message-row ${isMe ? 'me' : 'others'}">
                                    <div class="message-bubble deleted"><i class='bx bx-block'></i> Message removed</div>
                                </div>`;
                        messageObserver.unobserve(placeholder);
                        return;
                    }

                    // --- MEDIA RENDERING ---
                    let mediaHTML = "";
                    if (msg.mediaUrl) {
                        if (msg.mediaType === 'image') {
                            mediaHTML = `<img src="${msg.mediaUrl}" class="chat-media" loading="lazy" onclick="window.open(this.src)">`;
                        } else if (msg.mediaType === 'video') {
                            mediaHTML = `<video src="${msg.mediaUrl}" controls class="chat-media"></video>`;
                        } else {
                            let fileName = "Attachment";
                            try { fileName = decodeURIComponent(msg.mediaUrl.split('/').pop().split('?')[0]).replace(/^\d+-/, ''); } catch(e) {}
                            mediaHTML = `
                            <a href="${msg.mediaUrl}" download target="_blank" class="file-attachment-card">
                                <div class="file-icon-box"><i class='bx bx-file'></i></div>
                                <div class="file-details"><span class="file-name">${fileName}</span></div>
                            </a>`;
                        }
                    }

                    const msgDate = new Date(msg.timestamp);
                    const date = msgDate.toLocaleDateString([], {month: 'short', day: 'numeric'});
                    const time = msgDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const timestamp = `${date} ${time}`;
                    const contentHTML = linkify(msg.content);

                    // --- ACTION BUTTONS (Delete & Report) ---
                    const deleteBtn = canDelete ? `<button class="delete-btn" onclick="deleteMessage('${msg._id}')"><i class='bx bx-trash'></i></button>` : '';
                    const reportBtn = (!isMe) ? `<button class="msg-report-btn" onclick="reportContent('Message', '${msg._id}')" title="Report"><i class='bx bx-flag'></i></button>` : '';

                    // 3. RENDER MESSAGE
                    const messageHTML = `
                    <div class="message-row ${isMe ? 'me' : 'others'}" id="msg-${msg._id}">
                        ${!isMe ? `
                            <img src="${avatarSrc}" 
                                 class="chat-avatar ${borderClass}" 
                                 loading="lazy"
                                 onclick="viewUserProfile('${msg.sender}')" 
                                 title="${role}">
                        ` : ''}
                        
                        <div class="msg-content-wrapper"> 
                            ${chatType === 'group' && !isMe ? `<div class="sender-name">${msg.sender}${reportBtn}</div>` : ''}
                            
                            <div class="message-bubble ${isMe ? 'me' : 'others'}">
                                ${mediaHTML}
                                ${contentHTML ? `<div class="message-text">${contentHTML}</div>` : ''}
                            </div>
                            
                            ${deleteBtn}
                            <div class="msg-footer" style="text-align:${isMe ? 'right' : 'left'};">${timestamp}</div>
                        </div>
                    </div>`;

                    placeholder.outerHTML = messageHTML;
                    messageObserver.unobserve(placeholder);
                }
            });
        }, {
            rootMargin: '200px' // Start rendering 200px before entering viewport
        });

        // Observe all message placeholders
        document.querySelectorAll('.message-placeholder').forEach(placeholder => {
            messageObserver.observe(placeholder);
        });
    }
}

// ==========================================
// 4. ACTION FUNCTIONS
// ==========================================

async function updateDocStatus(msgId, status) {
    const isConfirmed = await window.showConfirm(
        "Update Document Status",
        `Are you sure you want to mark this document as ${status.toUpperCase()}?`,
        "Confirm"
    );
    if (!isConfirmed) return;
    
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/chat/document/${msgId}/status`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ status })
        });
        
        if (res.ok) {
            loadMessages(); // Refresh UI immediately
        } else {
            window.showtoast("Failed to update status.", "error");
        }
    } catch (e) {
        console.error(e);
    }
}

async function sendMessage() {
    const input = document.getElementById('MessageInput');
    const fileInput = document.getElementById('MediaInput');
    const container = document.getElementById('MessageArea');
    const token = localStorage.getItem('token');
    
    const text = input.value.trim();
    const file = fileInput.files[0];
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB

    if (file && file.size > MAX_SIZE) {
        window.showtoast("File is too large! Max 100MB.", "error");
        clearFile();
        return;
    }

    if (!text && !file) return;

    // OPTIMISTIC UI (Show fake message instantly)
    const tempId = 'temp-msg-' + Date.now();
    
    // We render the optimistic bubble with the current user's role
    const roleClass = myClubPosition.replace(/\s+/g, '-').toLowerCase();

    if (container) {
        let mediaHTML = "";
        if (file) {
            if (file.type.startsWith('image/')) {
                mediaHTML = `<div style="padding:10px; background:#f0f0f0; border-radius:8px; text-align:center;"><i class='bx bx-image'></i> Uploading Image...</div>`;
            } else {
                mediaHTML = `<div style="padding:10px; background:#f0f0f0; border-radius:8px;"><i class='bx bx-file'></i> ${file.name} (Uploading...)</div>`;
            }
        }

        const tempHTML = `
            <div id="${tempId}" class="message-row me" style="display:flex; justify-content:flex-end; margin-bottom:15px; opacity:0.6;">
                <div style="max-width:70%;">
                    ${mediaHTML}
                    <div class="message-bubble me bubble-${roleClass}" style="background:#fa3737; color:white;">${linkify(text)}</div>
                    <div style="font-size:0.7rem; text-align:right; color:#888;">⏳ Sending...</div>
                </div>
            </div>`;
        container.insertAdjacentHTML('beforeend', tempHTML);
        container.scrollTop = container.scrollHeight;
    }

    // Prepare Data
    input.value = "";
    clearFile();

    const formData = new FormData();
    formData.append('sender', myName); 
    formData.append('clubrole', myRole); 
    // IMPORTANT: Backend automatically sets 'officerRole' from User DB, but we send it implicitly via session
    formData.append('content', text);
    if (file) formData.append('media', file);

    if (chatType === 'private') {
        formData.append('recipient', chatRoom); 
        formData.append('clubname', ''); 
    } else {
        formData.append('clubname', chatRoom);
        formData.append('recipient', '');
    }

    try {
        const response = await fetch('/api/chat/send', { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData 
        });

        if (!response.ok) throw new Error("Send failed");

        // Remove temp message (Poll will replace it with real one)
        const tempMsgElement = document.getElementById(tempId);
        if (tempMsgElement) tempMsgElement.remove();
        loadMessages(); // Force immediate refresh

    } catch (error) {
        console.error("Send Failed:", error);
        window.showtoast("Failed to send message.", "error");
        if(document.getElementById(tempId)) document.getElementById(tempId).remove();
    }
}

window.deleteMessage = async function(msgId) {
    const isConfirmed = await window.showConfirm(
        "Delete Message",
        "Delete this message?",
        "Delete"
    );
    if (!isConfirmed) return;
    const token = localStorage.getItem('token');

    try {
        await fetch(`/api/chat/delete/${msgId}`, { 
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadMessages(); 
    } catch (e) { console.error(e); }
};

// ==========================================
// 5. UTILITIES (Linkify, DragDrop, Preview)
// ==========================================

function linkify(text) {
    if (!text) return "";
    const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return safeText.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" style="color:inherit; text-decoration:underline;">${url}</a>`;
    });
}

function setupMediaHandlers() {
    const msgInput = document.getElementById('MessageInput');
    const mediaInput = document.getElementById('MediaInput');
    const dropZone = document.querySelector('.club-chat-container'); 

    if (msgInput) {
        msgInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") sendMessage();
        });
    }

    if (mediaInput) {
        mediaInput.addEventListener('change', function() {
            if (this.files[0]) showFilePreview(this.files[0]);
        });
    }

    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
        });

        dropZone.addEventListener('dragenter', () => dropZone.classList.add('drag-active'));
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));

        dropZone.addEventListener('drop', (e) => {
            dropZone.classList.remove('drag-active');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                mediaInput.files = files;
                showFilePreview(files[0]);
            }
        });
    }
}

function showFilePreview(file) {
    const previewBox = document.getElementById('FilePreview');
    const container = document.getElementById('PreviewContainer');
    const nameLabel = document.getElementById('FileName');
    const typeLabel = document.getElementById('FileType');

    if (!previewBox || !file) return;

    if (currentPreviewURL) URL.revokeObjectURL(currentPreviewURL);
    container.innerHTML = ""; 

    nameLabel.innerText = file.name;
    previewBox.style.display = 'flex'; 

    currentPreviewURL = URL.createObjectURL(file);

    if (file.type.startsWith('image/')) {
        typeLabel.innerText = "Image";
        container.innerHTML = `<img src="${currentPreviewURL}" class="preview-media">`;
    } else if (file.type.startsWith('video/')) {
        typeLabel.innerText = "Video";
        container.innerHTML = `<video src="${currentPreviewURL}" class="preview-media" muted></video>`;
    } else {
        typeLabel.innerText = "Document";
        container.innerHTML = `<i class='bx bx-file' style="font-size:2rem; color:#555;"></i>`;
    }
}

window.clearFile = function() {
    const input = document.getElementById('MediaInput');
    const preview = document.getElementById('FilePreview');
    if (input) input.value = "";
    if (preview) preview.style.display = 'none'; 
    if (currentPreviewURL) {
        URL.revokeObjectURL(currentPreviewURL);
        currentPreviewURL = null;
    }
};

function checkAndHighlightMessage() {
    const urlParams = new URLSearchParams(window.location.search);
    const msgId = urlParams.get('msgId');

    if (msgId && !document.querySelector('.highlight-message')) {
        const targetMsg = document.getElementById(`msg-${msgId}`);
        if (targetMsg) {
            targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetMsg.classList.add('highlight-message');
            setTimeout(() => {
                targetMsg.classList.remove('highlight-message');
            }, 3000);
        }
    }
}