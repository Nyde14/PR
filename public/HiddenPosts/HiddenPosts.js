document.addEventListener("DOMContentLoaded", async () => {
    // 1. Check Auth
    const authRes = await fetch('/api/auth/me');
    if (!authRes.ok) {
        window.location.href = "/Login/Login.html";
        return;
    }

    // 2. Load Hidden Posts
    loadHiddenPosts();
});

async function loadHiddenPosts() {
    const container = document.getElementById('HiddenPostsContainer');
    
    try {
        const response = await fetch('/api/users/hidden-posts');
        const posts = await response.json();

        container.innerHTML = "";

        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px; color:#888;">
                    <span style="font-size:3rem;">📭</span>
                    <p>No hidden posts found.</p>
                </div>
            `;
            return;
        }

        posts.forEach(post => {
            const date = new Date(post.timestamp).toLocaleDateString();
            const card = document.createElement('div');
            card.className = 'hidden-post-card';
            card.id = `post-${post._id}`;
            
            card.innerHTML = `
                <div class="post-meta">
                    <span>${post.clubname} • ${date}</span>
                    <span>By ${post.author}</span>
                </div>
                <h3 class="post-title">${post.title}</h3>
                <div class="post-excerpt">${post.content.substring(0, 150)}${post.content.length > 150 ? '...' : ''}</div>
                
                <button onclick="unhidePost('${post._id}')" class="unhide-btn">
                    👁️ Unhide Post
                </button>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Error:", error);
        container.innerHTML = "<p>Error loading posts.</p>";
    }
}

async function unhidePost(postId) {
    if (!confirm("Unhide this post? It will reappear in your feed.")) return;

    const btn = document.querySelector(`#post-${postId} .unhide-btn`);
    if(btn) {
        btn.disabled = true;
        btn.innerText = "Restoring...";
    }

    try {
        const res = await fetch(`/api/users/unhide-post/${postId}`, { method: 'PUT' });
        
        if (res.ok) {
            // Remove from UI immediately with animation
            const card = document.getElementById(`post-${postId}`);
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 300);
            
            // Check if empty
            const container = document.getElementById('HiddenPostsContainer');
            if (container.children.length <= 1) { // 1 because we haven't removed it yet
                setTimeout(loadHiddenPosts, 300); // Reload empty state
            }
        } else {
            alert("Failed to unhide.");
            if(btn) {
                btn.disabled = false;
                btn.innerText = "👁️ Unhide Post";
            }
        }
    } catch (e) {
        console.error(e);
        alert("Network error.");
    }
} 