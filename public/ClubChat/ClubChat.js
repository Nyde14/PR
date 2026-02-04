// ==========================================
// 1. GLOBAL VARIABLES
// ==========================================
let chatRoom = "";       
let chatType = "group";  
let myName = "";
let myRole = "Student";
let seenIds = new Set();
let isFirstLoad = true;
let currentPreviewURL = null; 

// ==========================================
// 2. INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // --- AUTH FIX: Get Token ---
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/Login/Login.html';
            return;
        }

        // A. Get User Info (With Headers)
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Not logged in");
        const user = await response.json();
        
        myName = user.name;
        myRole = (user.usertype === 'Teacher' || user.usertype === 'Admin') ? 'Adviser' : 'Member';

        // B. Read URL Parameters
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room'); 
        const typeParam = urlParams.get('type'); 

        // C. Determine Chat Mode
        if (roomParam && typeParam === 'private') {
            chatType = 'private';
            chatRoom = roomParam;
            const titleEl = document.getElementById('ChatTitle');
            if(titleEl) titleEl.innerText = `Chat with ${chatRoom}`;
        } else {
            chatType = 'group';
            chatRoom = roomParam || user.club;

            if (!chatRoom || chatRoom === "none" || chatRoom === "Pending") {
                document.getElementById('MessageArea').innerHTML = 
                    "<p style='text-align:center; padding:20px; color:#666;'>You must be a member of a club to access chat.</p>";
                const inputArea = document.querySelector('.chat-input-area');
                if (inputArea) inputArea.style.display = 'none';
                return;
            }
            const titleEl = document.getElementById('ChatTitle');
            if(titleEl) titleEl.innerText = `${chatRoom} Group Chat`;
        }

        // D. Setup Event Listeners
        setupMediaHandlers();

        // E. Start Polling
        loadMessages();
        setInterval(loadMessages, 2000);

    } catch (error) {
        console.error("Init Error:", error);
    }
});

// ==========================================
// 3. CORE MESSAGING LOGIC
// ==========================================

async function loadMessages() {
    const container = document.getElementById('MessageArea'); 
    if (!container) return;
    if (!chatRoom) return; 

    const token = localStorage.getItem('token');

    try {
        const endpoint = (chatType === 'private') 
            ? `/api/chat/private/${encodeURIComponent(chatRoom)}` 
            : `/api/chat/${encodeURIComponent(chatRoom)}`;
            
        const res = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return; 

        const messages = await res.json();
        const shouldScroll = isFirstLoad || (container.scrollTop + container.clientHeight >= container.scrollHeight - 100);

        // Check if Staff (Admin/Teacher)
        const isStaff = ['Admin', 'Teacher', 'Adviser'].includes(myRole);

        container.innerHTML = messages.map(msg => {
            const isMe = msg.sender === 'Me' || msg.sender === myName;
            
            // Avatars
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender)}&background=random&color=fff&size=64`;
            const avatarSrc = msg.senderAvatar ? msg.senderAvatar : fallbackAvatar;

            // --- DELETED MESSAGE LOGIC ---
            let specialClass = "";
            let contentPrefix = ""; // The "Mark" variable

            if (msg.isDeleted) {
                if (!isStaff) {
                    // 1. STUDENT VIEW: Hide content
                    return `
                    <div class="message-row ${isMe ? 'me' : 'others'}" style="margin-bottom:10px;">
                        <div class="message-bubble deleted-hidden" style="background:#f0f0f0; border:1px solid #ddd; padding:10px; border-radius:10px; color:#888;">
                            <small>🚫 <em>Message removed</em></small>
                        </div>
                    </div>`;
                } else {
                    // 2. STAFF VIEW: Mark as deleted & Show Content
                    specialClass = "deleted-visible"; 
                    // Add the visual label
                    contentPrefix = `<div style="font-size:0.7rem; color:#fa3737; font-weight:bold; text-transform:uppercase; margin-bottom:4px; border-bottom:1px dashed #fa3737; padding-bottom:2px;">🚫 Deleted</div>`;
                }
            }

            // Buttons
            const deleteBtn = isMe ? `<button class="delete-btn" onclick="deleteMessage('${msg._id}')" title="Delete">🗑️</button>` : '';
            const reportBtn = !isMe ? `<button onclick="reportMessage('${msg._id}')" class="msg-report-btn" title="Report">⚑</button>` : '';

            // Media
            let mediaHTML = "";
            if (msg.mediaUrl) {
                if (msg.mediaType === 'image') {
                    mediaHTML = `<img src="${msg.mediaUrl}" class="chat-media" onclick="window.open(this.src)">`;
                } else if (msg.mediaType === 'video') {
                    mediaHTML = `<video src="${msg.mediaUrl}" controls class="chat-media"></video>`;
                } else {
                    let fileName = "Attachment";
                    try {
                        let rawName = decodeURIComponent(msg.mediaUrl.split('/').pop().split('?')[0]);
                        fileName = rawName.replace(/^\d+-/, ''); 
                    } catch(e) {}

                    mediaHTML = `
                    <a href="${msg.mediaUrl}" download target="_blank" class="file-attachment-card">
                        <div class="file-icon-box">📄</div>
                        <div class="file-details">
                            <span class="file-name">${fileName}</span> <span class="file-action">Click to download</span>
                        </div>
                        <div class="download-icon">⬇️</div>
                    </a>`;
                }
            }

            const timestamp = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const contentHTML = linkify(msg.content);

            // RENDER
            if (isMe) {
                return `
                <div class="message-row me" id="msg-${msg._id}">
                    <div class="msg-content-wrapper" style="position: relative;"> 
                        ${mediaHTML}
                        ${contentHTML ? `<div class="message-bubble me ${specialClass}">${contentPrefix}${contentHTML}</div>` : ''}
                        ${deleteBtn} 
                        <div class="msg-footer" style="text-align:right; font-size:0.7rem; color:#ccc; margin-top:2px;">
                            ${timestamp}
                        </div>
                    </div>
                </div>`;
            } else {
                return `
                <div class="message-row others" id="msg-${msg._id}">
                    <img src="${avatarSrc}" 
                         class="chat-avatar" 
                         title="${msg.sender}" 
                         onerror="this.onerror=null; this.src='${fallbackAvatar}';"
                         style="width:35px; height:35px; border-radius:50%; object-fit:cover; margin-right:8px; border:1px solid #ddd; flex-shrink:0;">
                    
                    <div class="msg-content-wrapper"> 
                        ${chatType === 'group' ? `<div class="sender-name">${msg.sender}</div>` : ''}
                        ${mediaHTML}
                        ${contentHTML ? `<div class="message-bubble others ${specialClass}">${contentPrefix}${contentHTML}</div>` : ''}
                        <div class="msg-footer" style="font-size:0.7rem; color:#888; margin-top:2px;">
                            ${timestamp} ${reportBtn}
                        </div>
                    </div>
                </div>`;
            }
        }).join('');

        if (shouldScroll) {
            container.scrollTop = container.scrollHeight;
            isFirstLoad = false;
        }
        if (typeof checkAndHighlightMessage === 'function') checkAndHighlightMessage();

    } catch (e) { console.error("Load Msg Error:", e); }
}
async function sendMessage() {
    const input = document.getElementById('MessageInput');
    const fileInput = document.getElementById('MediaInput');
    const container = document.getElementById('MessageArea');
    const token = localStorage.getItem('token'); // --- AUTH FIX ---
    
    const text = input.value.trim();
    const file = fileInput.files[0];
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB

    if (file && file.size > MAX_SIZE) {
        alert("File is too large! Please upload files smaller than 100MB.");
        clearFile();
        return;
    }

    if (!text && !file) return;
    if (!myName) return console.warn("User data not loaded yet.");

    const tempId = 'temp-msg-' + Date.now();

    // OPTIMISTIC UI (Visual Feedback only)
    if (container) {
        let mediaHTML = "";
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            if (file.type.startsWith('image/')) {
                mediaHTML = `<img src="${objectUrl}" class="chat-media" style="max-width:200px; opacity:0.7;">`;
            } else if (file.type.startsWith('video/')) {
                mediaHTML = `<video src="${objectUrl}" class="chat-media" style="max-width:200px; opacity:0.7;"></video>`;
            } else {
                mediaHTML = `
                <div class="file-attachment-card" style="opacity:0.7;">
                    <div class="file-icon-box">📄</div>
                    <div class="file-details">
                        <span class="file-name">${file.name}</span>
                        <span class="file-action">Uploading...</span>
                    </div>
                </div>`;
            }
        }

        const tempHTML = `
            <div id="${tempId}" class="message-row me" style="display:flex; justify-content:flex-end; margin-bottom:15px;">
                <div style="max-width:70%;">
                    ${mediaHTML}
                    <div class="message-bubble me" style="background:#fa3737; color:white; padding:10px; border-radius:15px 15px 0 15px; opacity:0.7;">
                        ${linkify(text)}
                    </div>
                    <div class="sending-status" style="font-size:0.7rem; text-align:right; color:#888;">⏳ Sending...</div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', tempHTML);
        container.scrollTop = container.scrollHeight;
    }

    input.value = "";
    clearFile();

    const formData = new FormData();
    formData.append('sender', myName); 
    formData.append('clubrole', myRole); 
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
        // --- AUTH FIX: Add Headers (No Content-Type for FormData, browser sets it) ---
        const response = await fetch('/api/chat/send', { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData 
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Server Error: ${response.status}`);
        }

        const tempMsgElement = document.getElementById(tempId);
        if (tempMsgElement) tempMsgElement.remove();

    } catch (error) {
        console.error("Send Failed:", error);
        alert(`Failed to send: ${error.message}`);
    }
}

window.deleteMessage = async function(msgId) {
    if (!confirm("Delete this message?")) return;
    const token = localStorage.getItem('token'); // --- AUTH FIX ---

    try {
        await fetch(`/api/chat/delete/${msgId}`, { 
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadMessages(); 
    } catch (e) { console.error(e); }
};

function linkify(text) {
    if (!text) return "";
    const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return safeText.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:inherit; text-decoration:underline; word-break:break-all;">${url}</a>`;
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

        ['dragenter', 'dragover'].forEach(name => dropZone.classList.add('drag-active'));
        ['dragleave', 'drop'].forEach(name => dropZone.classList.remove('drag-active'));

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
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
        container.innerHTML = `<video src="${currentPreviewURL}" class="preview-media" muted preload="metadata"></video>`;
    } else {
        typeLabel.innerText = "File";
        container.innerHTML = `<div style="font-size:2rem;">📄</div>`;
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

async function reportMessage(messageId) {
    const reason = prompt("Why are you reporting this message?");
    if (!reason) return;
    const token = localStorage.getItem('token'); // --- AUTH FIX ---

    try {
        const res = await fetch('/api/reports/submit', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
                targetType: 'Message', 
                targetId: messageId, 
                reason: reason 
            })
        });
        const data = await res.json();
        alert(data.message);
    } catch (e) {
        alert("Failed to report message.");
    }
}

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