// ================================================================
//  BMD APP - MAIN APPLICATION LOGIC (FIXED FOR FCM v10+)
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
//  LIKE REWARD NOTIFICATION
// ================================================================
let likeNotificationTimer = null;

function showLikeRewardNotification(postId) {
    // Find the post to check current likes
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;

    const likes = post.likes || 0;
    const rewardAmount = 10000; // UGX
    const targetLikes = 1000;

    // Show notification with current progress
    const message = `❤️ You liked this post! Keep going!\n\n` +
        `📊 Current likes: ${likes}\n` +
        `🎯 Target: ${targetLikes} likes\n` +
        `💰 Reward: ${rewardAmount.toLocaleString()} UGX for reaching ${targetLikes} likes!\n\n` +
        `📢 Keep posting and sharing your posts to increase visibility of our BMD app!`;

    // Show the notification as a toast for 5 seconds
    showToast(message, 5000);

    // Also show a more prominent notification if likes are near target
    if (likes >= targetLikes) {
        setTimeout(() => {
            showToast(`🎉 CONGRATULATIONS! Your post reached ${targetLikes} likes! You earned ${rewardAmount.toLocaleString()} UGX! 🎉`, 8000);
        }, 3000);
    } else if (likes >= targetLikes * 0.8) {
        setTimeout(() => {
            const remaining = targetLikes - likes;
            showToast(`🔥 Your post is almost there! Only ${remaining} more likes to reach ${targetLikes}! Keep sharing!`, 5000);
        }, 3000);
    }
}

// ================================================================
//  NOTIFICATION PERMISSION (FIXED FOR FCM v10+)
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
        // Step 1: Register service worker
        const swPath = '/BMD-APP/firebase-messaging-sw.js';
        const registration = await navigator.serviceWorker.register(swPath);
        console.log('Service Worker registered:', registration);

        // Step 2: Request permission using Notification API (browser native)
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);

        if (permission !== 'granted') {
            showToast('Permission denied. You can enable it later.');
            notifBanner.classList.remove('show');
            return;
        }

        // Step 3: Get FCM token using the registration
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

        // Step 4: Save token to Firestore
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
                <h3>Bad network connection</h3>
                <p>Check your network,WiFi,data or hotspot</p>
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

    // ===== Click anywhere on post card to open full post =====
    document.querySelectorAll('.post-card').forEach(card => {
        card.addEventListener('click', function(e) {
            // Ignore clicks on buttons, audio, video, or inside post-actions
            if (e.target.closest('.post-actions') || 
                e.target.closest('.media-player') ||
                e.target.tagName === 'BUTTON' || 
                e.target.tagName === 'AUDIO' || 
                e.target.tagName === 'VIDEO' || 
                e.target.tagName === 'SOURCE' ||
                e.target.closest('.btn-action') ||
                e.target.closest('.btn-read-more')) {
                return;
            }
            const postId = this.dataset.id;
            if (postId) {
                openFullPost(postId);
            }
        });
    });
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
            
            // ===== SHOW LIKE REWARD NOTIFICATION =====
            showLikeRewardNotification(postId);
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

    // Calculate like progress for reward
    const likes = post.likes || 0;
    const targetLikes = 1000;
    const progress = Math.min((likes / targetLikes) * 100, 100);
    const rewardAmount = 10000;

    fullPostBody.innerHTML = `
        <div class="full-post-author"><i class="fas fa-user-circle"></i> ${escapeHtml(post.authorName || 'Anonymous')}</div>
        <h1 class="full-post-title">${escapeHtml(post.title || '')}</h1>
        <div class="full-post-date">${post.createdAt ? post.createdAt.toLocaleString() : ''}</div>
        
        <!-- Reward Progress Bar -->
        <div style="background:#f0ebe4; border-radius:10px; padding:10px 14px; margin:8px 0 12px;">
            <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#666; margin-bottom:4px;">
                <span><i class="fas fa-heart" style="color:#e74c3c;"></i> ${likes} likes</span>
                <span>🎯 ${targetLikes} target</span>
                <span>💰 ${rewardAmount.toLocaleString()} UGX</span>
            </div>
            <div style="width:100%; height:6px; background:#e5e7eb; border-radius:4px; overflow:hidden;">
                <div style="width:${progress}%; height:100%; background:linear-gradient(90deg, var(--accent-gold, #d4a743), #e74c3c); border-radius:4px; transition:width 0.5s;"></div>
            </div>
            <div style="font-size:0.6rem; color:#999; margin-top:4px; text-align:center;">
                ${likes >= targetLikes ? '🎉 Target reached! You earned ' + rewardAmount.toLocaleString() + ' UGX!' : `${targetLikes - likes} more likes to earn ${rewardAmount.toLocaleString()} UGX`}
            </div>
        </div>
        
        ${mediaHtml}
        <div class="full-post-body">${contentDisplay}</div>
        
        <div class="full-actions">
            <button class="action-btn like-btn ${likedPosts.has(post.id) ? 'liked' : ''}" data-postid="${post.id}" style="display:flex;align-items:center;gap:4px;font-size:0.9rem;background:none;border:none;cursor:pointer;font-family:inherit;padding:4px 10px;border-radius:20px;">
                <i class="${likedPosts.has(post.id) ? 'fas' : 'far'} fa-heart"></i> <span class="count">${likes}</span>
            </button>
            <button class="action-btn share-btn" data-postid="${post.id}" style="display:flex;align-items:center;gap:4px;font-size:0.9rem;background:none;border:none;cursor:pointer;font-family:inherit;padding:4px 10px;border-radius:20px;color:#25D366;">
                <i class="fas fa-share-alt"></i> Share
            </button>
            <button style="margin-left:auto;background:none;border:none;color:#888;cursor:pointer;font-size:0.8rem;" id="fullPostCloseBtn2"><i class="fas fa-times"></i> Close</button>
        </div>
    `;

    fullPostOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    fullPostBody.querySelector('.like-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = e.currentTarget.dataset.postid;
        toggleLike(pid);
        setTimeout(() => openFullPost(pid), 300);
    });
    fullPostBody.querySelector('.share-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openShareModal(post.id);
    });
    fullPostBody.querySelector('#fullPostCloseBtn2')?.addEventListener('click', closeFullPost);
}

function closeFullPost() {
    fullPostOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

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
            case 'activities': window.location.href = 'activities.html'; break;
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

console.log('🚀 BMD App loaded with FCM v10+ notification fix and like rewards.');
