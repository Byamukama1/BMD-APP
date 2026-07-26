// ================================================================
//  BMD APP - MAIN APPLICATION LOGIC
// ================================================================

const db = firebase.firestore();
const auth = firebase.auth();
const messaging = firebase.messaging();

// ================================================================
//  STATE
// ================================================================
let allPosts = [];
let currentUser = null;
let likedPosts = new Set();
let activeSharePost = null;
let autoOpenedPost = false;

// ================================================================
//  DOM REFS
// ================================================================
const preloader = document.getElementById('pagePreloader');
const postsWrapper = document.getElementById('postsWrapper');
const headerAvatar = document.getElementById('headerAvatar');
const searchOverlay = document.getElementById('searchOverlay');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const fullPostOverlay = document.getElementById('fullPostOverlay');
const fullPostBody = document.getElementById('fullPostBody');
const shareModal = document.getElementById('shareModal');
const toast = document.getElementById('toast');
const notifBanner = document.getElementById('notificationBanner');
const notifAllowBtn = document.getElementById('notifAllowBtn');
const notifDismissBtn = document.getElementById('notifDismissBtn');

// ================================================================
//  TOAST
// ================================================================
let toastTimer = null;

function showToast(msg, duration = 2500) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ================================================================
//  NOTIFICATION PERMISSION (with correct service worker path)
// ================================================================
let notificationRequested = false;

async function requestNotificationPermission() {
    if (notificationRequested) return;
    notificationRequested = true;

    if (!('serviceWorker' in navigator)) {
        showToast('Notifications not supported in this browser.');
        notifBanner.classList.remove('show');
        return;
    }

    try {
        // CORRECT PATH for GitHub Pages subfolder
        const swPath = '/BMD-APP/firebase-messaging-sw.js';
        const registration = await navigator.serviceWorker.register(swPath);
        console.log('Service Worker registered:', registration);

        const permission = await messaging.requestPermission();
        if (permission !== 'granted') {
            showToast('Permission denied. You can enable it later.');
            notifBanner.classList.remove('show');
            return;
        }

        const token = await messaging.getToken({
            serviceWorkerRegistration: registration,
            vapidKey: "BE3D5sIL5umpsfzIPKcIxn8yNToSCR5v8r_pRwZivm6W-fvlv2zjxcGzrDKoTwcSPqUBfJ14xQLrsEfns58pd8D"
        });

        if (!token) {
            showToast('No token generated. Try again later.');
            notifBanner.classList.remove('show');
            return;
        }

        console.log('FCM Token:', token);

        await db.collection('notificationTokens')
            .doc(token)
            .set({
                token: token,
                userId: currentUser ? currentUser.uid : null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent
            }, { merge: true });

        showToast('✅ Notifications enabled!');
        notifBanner.classList.remove('show');

    } catch (error) {
        console.error('Notification setup error:', error);
        showToast('❌ Could not enable notifications: ' + error.message);
        notifBanner.classList.remove('show');
        notificationRequested = false;
    }
}

// ================================================================
//  BANNER EVENTS
// ================================================================
notifAllowBtn.addEventListener('click', requestNotificationPermission);
notifDismissBtn.addEventListener('click', () => {
    notifBanner.classList.remove('show');
    showToast('You can enable notifications later in settings.');
});

// ================================================================
//  CHECK AND SHOW BANNER (ONLY IF PERMISSION IS DEFAULT)
// ================================================================
function checkAndShowNotificationBanner() {
    if (Notification.permission === 'default') {
        setTimeout(() => {
            notifBanner.classList.add('show');
        }, 3000);
    } else if (Notification.permission === 'granted') {
        // Already granted, ensure token is saved
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/BMD-APP/firebase-messaging-sw.js')
                .then((registration) => {
                    return messaging.getToken({
                        serviceWorkerRegistration: registration,
                        vapidKey: "BE3D5sIL5umpsfzIPKcIxn8yNToSCR5v8r_pRwZivm6W-fvlv2zjxcGzrDKoTwcSPqUBfJ14xQLrsEfns58pd8D"
                    });
                })
                .then((token) => {
                    if (token) {
                        return db.collection('notificationTokens')
                            .doc(token)
                            .set({
                                token: token,
                                userId: currentUser ? currentUser.uid : null,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                                userAgent: navigator.userAgent
                            }, { merge: true });
                    }
                })
                .catch((err) => console.error('FCM token refresh error:', err));
        }
    }
}

// ================================================================
//  AUTH
// ================================================================
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            let photoURL = user.photoURL;
            if (userDoc.exists && userDoc.data().photoURL) {
                photoURL = userDoc.data().photoURL;
            }
            if (photoURL) {
                headerAvatar.innerHTML = `<img src="${photoURL}" style="width:100%;height:100%;object-fit:cover;" />`;
            }
        } catch (e) {
            console.error("Error fetching user profile:", e);
        }

        db.collection('likes').where('userId', '==', user.uid).get().then(snap => {
            likedPosts.clear();
            snap.forEach(doc => likedPosts.add(doc.data().postId));
            renderPosts(allPosts);
        });

        setTimeout(checkAndShowNotificationBanner, 1500);

    } else {
        headerAvatar.innerHTML = `<i class="fas fa-user"></i>`;
        likedPosts.clear();
        renderPosts(allPosts);
        setTimeout(checkAndShowNotificationBanner, 1500);
    }
});

// ================================================================
//  FETCH POSTS
// ================================================================
function listenPosts() {
    db.collection('posts').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const posts = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            posts.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
            });
        });
        allPosts = posts;
        renderPosts(posts);

        if (!autoOpenedPost && targetPostId) {
            const target = posts.find(p => p.id === targetPostId);
            if (target) {
                openFullPost(target.id);
                autoOpenedPost = true;
            }
        }

        hidePreloader();
    }, err => {
        console.error("Posts error:", err);
        hidePreloader();
    });
}

// ================================================================
//  RENDER POSTS
// ================================================================
function renderPosts(posts) {
    if (!posts.length) {
        postsWrapper.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-newspaper"></i>
                <h3>No posts yet</h3>
                <p>Be the first to share your voice!</p>
            </div>`;
        return;
    }

    let html = '';
    posts.forEach(post => {
        const isLiked = likedPosts.has(post.id);
        const likeCount = post.likes || 0;
        const author = post.authorName || 'Anonymous';
        const title = post.title || 'Untitled';
        const preview = post.preview || (post.content ? post.content.replace(/<[^>]*>?/gm, '').substring(0, 140) + '...' : '');
        const dateStr = post.createdAt ? post.createdAt.toLocaleDateString() : '';

        let mediaHtml = '';
        if (post.imageUrl) {
            mediaHtml = `<div class="card-media-wrap"><img src="${post.imageUrl}" alt="Post image" loading="lazy"/></div>`;
        } else if (post.videoUrl) {
            mediaHtml = `<div class="card-media-wrap"><video controls><source src="${post.videoUrl}" type="video/mp4"/></video></div>`;
        } else if (post.audioUrl) {
            mediaHtml = `<div class="card-media-wrap"><audio controls><source src="${post.audioUrl}" type="audio/mpeg"/></audio></div>`;
        }

        html += `
            <article class="post-card" data-id="${post.id}">
                <div class="card-header-author">
                    <img src="${post.authorPhoto || 'https://res.cloudinary.com/dp81zzxlh/image/upload/v1784978097/vhaafrigchmqnqbhehft.jpg'}" class="author-avatar" />
                    <div class="author-meta">
                        <span class="author-name">${escapeHtml(author)}</span>
                        <span class="post-date">${dateStr}</span>
                    </div>
                </div>

                <h2 class="card-post-title">${escapeHtml(title)}</h2>

                ${mediaHtml}

                <div class="card-preview-text">${escapeHtml(preview)}</div>

                <div class="post-actions">
                    <div class="actions-left">
                        <button class="btn-action like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}')">
                            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                            <span>${likeCount}</span>
                        </button>
                        <button class="btn-action share-btn" onclick="openShareModal('${post.id}')">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                    <button class="btn-read-more" onclick="openFullPost('${post.id}')">Read More</button>
                </div>
            </article>
        `;
    });

    postsWrapper.innerHTML = html;
}

// ================================================================
//  LIKE
// ================================================================
async function toggleLike(postId) {
    if (!currentUser) {
        showToast("Please sign in to like posts.");
        return;
    }
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;

    const isLiked = likedPosts.has(postId);
    const newCount = isLiked ? Math.max(0, (post.likes || 1) - 1) : (post.likes || 0) + 1;

    try {
        await db.collection('posts').doc(postId).update({ likes: newCount });
        if (isLiked) {
            likedPosts.delete(postId);
            const snap = await db.collection('likes').where('userId', '==', currentUser.uid).where('postId', '==', postId).get();
            snap.forEach(d => d.ref.delete());
        } else {
            likedPosts.add(postId);
            await db.collection('likes').add({ userId: currentUser.uid, postId: postId });
        }
        post.likes = newCount;
        renderPosts(allPosts);
    } catch (e) {
        console.error("Like error:", e);
    }
}

// ================================================================
//  FULL POST
// ================================================================
function openFullPost(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;

    let mediaHtml = '';
    if (post.imageUrl) mediaHtml = `<img src="${post.imageUrl}" style="width:100%;border-radius:10px;margin:12px 0;" />`;
    else if (post.videoUrl) mediaHtml = `<video controls style="width:100%;border-radius:10px;margin:12px 0;"><source src="${post.videoUrl}"/></video>`;
    else if (post.audioUrl) mediaHtml = `<audio controls style="width:100%;margin:12px 0;"><source src="${post.audioUrl}"/></audio>`;

    const rawContent = post.content || '';
    let contentDisplay = rawContent;
    if (!rawContent.includes('<div') && !rawContent.includes('<p')) {
        contentDisplay = rawContent.split('\n').filter(p => p.trim() !== '').map(p => `<p>${escapeHtml(p)}</p>`).join('');
    }

    fullPostBody.innerHTML = `
        <div class="full-post-author"><i class="fas fa-user-circle"></i> ${escapeHtml(post.authorName || 'Anonymous')}</div>
        <h1 class="full-post-title">${escapeHtml(post.title || '')}</h1>
        <div class="full-post-date">${post.createdAt ? post.createdAt.toLocaleString() : ''}</div>
        ${mediaHtml}
        <div class="full-post-body">${contentDisplay}</div>
    `;
    fullPostOverlay.classList.add('active');
}

document.getElementById('fullPostClose').onclick = () => fullPostOverlay.classList.remove('active');

// ================================================================
//  SHARE
// ================================================================
function openShareModal(postId) {
    activeSharePost = allPosts.find(p => p.id === postId);
    if (activeSharePost) {
        shareModal.classList.add('active');
    }
}

document.getElementById('closeShareModal').onclick = () => shareModal.classList.remove('active');

function getShareUrl() {
    if (!activeSharePost) return window.location.href;
    return `${window.location.origin}${window.location.pathname}?post=${activeSharePost.id}`;
}

document.getElementById('shareWA').onclick = () => {
    const shareUrl = getShareUrl();
    const text = `${activeSharePost.title}\n${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
};
document.getElementById('shareWB').onclick = () => {
    const shareUrl = getShareUrl();
    const text = `${activeSharePost.title}\n${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
};
document.getElementById('shareMSG').onclick = () => {
    const shareUrl = getShareUrl();
    window.open(`fb-messenger://share/?link=${encodeURIComponent(shareUrl)}`, '_blank');
};
document.getElementById('shareX').onclick = () => {
    const shareUrl = getShareUrl();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(activeSharePost.title)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
};
document.getElementById('shareTT').onclick = () => {
    const shareUrl = getShareUrl();
    navigator.clipboard.writeText(shareUrl);
    showToast("Link copied! Paste it on TikTok.");
};
document.getElementById('shareCopy').onclick = () => {
    const shareUrl = getShareUrl();
    navigator.clipboard.writeText(shareUrl);
    showToast("Link copied to clipboard!");
    shareModal.classList.remove('active');
};

// ================================================================
//  SEARCH
// ================================================================
document.getElementById('searchToggle').onclick = () => {
    searchOverlay.classList.add('active');
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchInput.focus();
};
document.getElementById('searchClose').onclick = () => searchOverlay.classList.remove('active');
searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) searchOverlay.classList.remove('active');
});

searchInput.oninput = (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
        searchResults.innerHTML = '';
        return;
    }
    const filtered = allPosts.filter(p => (p.title && p.title.toLowerCase().includes(query)) || (p.content && p.content.toLowerCase().includes(query)));

    searchResults.innerHTML = filtered.map(p => `
        <div class="search-item" onclick="openFullPost('${p.id}'); searchOverlay.classList.remove('active');">
            <strong>${escapeHtml(p.title || 'Untitled')}</strong>
            <div style="font-size:0.75rem; color:#666;">${escapeHtml(p.authorName || 'Anonymous')}</div>
        </div>
    `).join('');
};

// ================================================================
//  UTILITY
// ================================================================
function escapeHtml(str) {
    return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function hidePreloader() {
    if (preloader) {
        preloader.classList.add('hidden');
    }
}

// ================================================================
//  NAVIGATION
// ================================================================
document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        switch (tab) {
            case 'home': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
            case 'register': window.location.href = 'register.html'; break;
            case 'activities': showToast('📅 Activities page coming soon!'); break;
            case 'post': window.location.href = 'post.html'; break;
            case 'account': window.location.href = 'account.html'; break;
            default: break;
        }
    });
});

headerAvatar.addEventListener('click', () => window.location.href = 'account.html');

// ================================================================
//  INIT
// ================================================================
postsWrapper.innerHTML = `
    <div class="skeleton"><div class="s-image"></div><div class="s-line med"></div><div class="s-line"></div><div class="s-line short"></div></div>
    <div class="skeleton"><div class="s-image"></div><div class="s-line med"></div><div class="s-line"></div><div class="s-line short"></div></div>
`;

listenPosts();

setTimeout(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('post');
    if (pid) {
        const check = setInterval(() => {
            if (allPosts.length > 0) {
                clearInterval(check);
                const p = allPosts.find(x => x.id === pid);
                if (p) openFullPost(pid);
            }
        }, 300);
    }
}, 600);

console.log('🚀 BMD App loaded with white header, larger preloader, and split files.');
