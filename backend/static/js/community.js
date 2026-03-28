// 커뮤니티 게시판 — 목록, 작성, 수정, 삭제, 상세, 답글(운영진: staff-mode.js + getStaffSecret)
/** 카드·상세에 삽입할 때 XSS 방지 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', function () {
    const communityList = document.getElementById('communityList');
    const noCommunityMsg = document.getElementById('noCommunityMsg');
    const writeBtn = document.getElementById('writeBtn');
    const writeModal = document.getElementById('writeModal');
    const closeWriteModal = document.getElementById('closeWriteModal');
    const writeForm = document.getElementById('writeForm');
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');
    const authorInput = document.getElementById('author');
    const tagsInput = document.getElementById('tags');

    const editModal = document.getElementById('editModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const editForm = document.getElementById('editForm');

    const detailModal = document.getElementById('detailModal');
    const closeDetailModal = document.getElementById('closeDetailModal');
    const detailContent = document.getElementById('detailContent');

    /** 목록 캐시(수정 시 기존 사진 URL 유지용) */
    let communityPostsCache = [];
    /** 현재 수정 중인 글 id */
    let currentEditId = null;
    /** 상세 모달에 표시 중인 글 id (답글 API용) */
    let detailPostId = null;

    writeBtn.onclick = () => {
        writeModal.style.display = 'flex';
    };

    closeWriteModal.onclick = () => {
        writeModal.style.display = 'none';
        writeForm.reset();
    };

    closeEditModal.onclick = () => {
        editModal.style.display = 'none';
        currentEditId = null;
        editForm.reset();
    };

    closeDetailModal.onclick = () => {
        detailModal.style.display = 'none';
        detailContent.innerHTML = '';
        detailPostId = null;
    };

    window.addEventListener('click', function (event) {
        if (event.target === detailModal) {
            detailModal.style.display = 'none';
            detailContent.innerHTML = '';
            detailPostId = null;
        }
    });

    writeForm.onsubmit = async function (e) {
        e.preventDefault();
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        const author = authorInput.value.trim();
        const password = document.getElementById('password').value.trim();
        const tags = (tagsInput && tagsInput.value.trim()) || '';
        let photoUrl = '';
        const photoInput = document.getElementById('photo');
        if (photoInput.files && photoInput.files[0]) {
            const formData = new FormData();
            formData.append('file', photoInput.files[0]);
            const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
            if (uploadRes.ok) {
                const data = await uploadRes.json();
                photoUrl = data.url || '';
            }
        }
        if (!title || !content || !author || !password) {
            alert('모든 항목을 입력해 주세요.');
            return;
        }
        const res = await fetch('/api/community', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, author, password, photoUrl, tags }),
        });
        const regJson = await res.json().catch(() => ({}));
        if (res.ok) {
            writeModal.style.display = 'none';
            writeForm.reset();
            loadCommunity();
        } else {
            alert(regJson.error || '글 등록에 실패했습니다.');
        }
    };

    editForm.onsubmit = async function (e) {
        e.preventDefault();
        if (currentEditId == null) return;
        const title = document.getElementById('editTitle').value.trim();
        const content = document.getElementById('editContent').value.trim();
        const author = document.getElementById('editAuthor').value.trim();
        const password = document.getElementById('editPassword').value.trim();
        const tags = document.getElementById('editTags').value.trim();
        if (!title || !content || !author || !password) {
            alert('제목·내용·작성자·비밀번호를 입력해 주세요.');
            return;
        }
        let uploaded = '';
        const editPhotoInput = document.getElementById('editPhoto');
        if (editPhotoInput.files && editPhotoInput.files[0]) {
            const formData = new FormData();
            formData.append('file', editPhotoInput.files[0]);
            const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
            if (uploadRes.ok) {
                const data = await uploadRes.json();
                uploaded = (data.url || '').trim();
            } else {
                alert('이미지 업로드에 실패했습니다.');
                return;
            }
        }
        let photoUrl = uploaded;
        if (!photoUrl) {
            const prev = communityPostsCache.find((p) => Number(p.id) === Number(currentEditId));
            if (prev && prev.photoUrl) photoUrl = prev.photoUrl;
        }
        const res = await fetch(`/api/community/${currentEditId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, author, password, photoUrl, tags }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
            editModal.style.display = 'none';
            currentEditId = null;
            editForm.reset();
            loadCommunity();
        } else {
            alert(body.error || '수정에 실패했습니다.');
        }
    };

    /** 상세 모달 안 답글 목록 새로고침 */
    async function refreshRepliesInModal(postId) {
        const listEl = document.getElementById('repliesList');
        if (!listEl) return;
        const res = await fetch(`/api/community/${postId}/replies`);
        if (!res.ok) {
            listEl.innerHTML = '<p class="text-red-600 text-sm">답글을 불러오지 못했습니다.</p>';
            return;
        }
        const replies = await res.json();
        const badge = document.getElementById('replyCountBadge');
        if (badge) badge.textContent = `(${replies.length})`;
        if (replies.length === 0) {
            listEl.innerHTML = '<p class="text-gray-500 text-sm">아직 답글이 없습니다. 첫 답글을 남겨 보세요.</p>';
            return;
        }
        listEl.innerHTML = replies
            .map(
                (r) => `
            <div class="reply-item border border-gray-200 rounded-lg p-3 mb-2 bg-gray-50" data-reply-id="${r.id}">
                <div class="flex justify-between text-sm text-gray-600 mb-1">
                    <span>${escapeHtml(r.author)}</span>
                    <span>${escapeHtml(r.created_at)}</span>
                </div>
                <div class="text-gray-800 whitespace-pre-line">${escapeHtml(r.content)}</div>
                <button type="button" class="reply-del-btn mt-2 btn-danger text-xs px-2 py-1 rounded" data-reply-id="${r.id}">삭제</button>
            </div>`
            )
            .join('');

        listEl.querySelectorAll('.reply-del-btn').forEach((btn) => {
            btn.onclick = async (ev) => {
                ev.stopPropagation();
                const rid = parseInt(btn.getAttribute('data-reply-id'), 10);
                const staff = getStaffSecret();
                let delBody;
                if (staff) {
                    if (!confirm('운영진 권한으로 이 답글을 삭제할까요?')) return;
                    delBody = JSON.stringify({ staffSecret: staff });
                } else {
                    const password = prompt('이 답글을 삭제하려면 등록 시 입력한 비밀번호를 입력하세요.');
                    if (!password) return;
                    delBody = JSON.stringify({ password });
                }
                const dr = await fetch(`/api/community/${postId}/replies/${rid}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: delBody,
                });
                if (dr.ok) {
                    await refreshRepliesInModal(postId);
                    loadCommunity();
                } else {
                    const err = await dr.json().catch(() => ({}));
                    alert(err.error || '삭제에 실패했습니다.');
                }
            };
        });
    }

    async function showDetailModal(post) {
        detailPostId = post.id;
        let tagHtml = '';
        if (post.tags) {
            const tagArr = post.tags.split(/[#\s]+/).filter(Boolean);
            tagHtml = tagArr
                .map(
                    (tag) =>
                        `<span class='tag text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded mr-1'>#${escapeHtml(tag)}</span>`
                )
                .join(' ');
        }
        let imgHtml = '';
        if (post.photoUrl) {
            imgHtml = `<img src='${escapeHtml(post.photoUrl)}' alt='이미지' class='popup-image' onerror="this.onerror=null;this.src='https://placehold.co/400x300?text=No+Image';">`;
        } else {
            imgHtml = `<img src='https://placehold.co/400x300?text=No+Image' alt='No Image' class='popup-image'>`;
        }
        detailContent.innerHTML = `
            ${imgHtml}
            <div class='text-2xl font-bold mb-2'>${escapeHtml(post.title)}</div>
            <div class='text-gray-700 mb-3' style='white-space:pre-line;'>${escapeHtml(post.content)}</div>
            <div class='flex flex-wrap gap-1 mb-2'>${tagHtml}</div>
            <div class='flex justify-between items-center text-sm text-gray-500 mb-2'>
                <span>작성자: ${escapeHtml(post.author)}</span>
                <span>${escapeHtml(post.created_at)}</span>
            </div>
            <div class="community-replies-section mt-6 border-t border-gray-200 pt-4">
                <h3 class="font-bold text-gray-800 mb-2">답글 <span id="replyCountBadge" class="text-indigo-600 font-semibold"></span></h3>
                <div id="repliesList"></div>
                <form id="replyForm" class="mt-4 space-y-2 rounded-lg bg-violet-50/50 p-3 border border-violet-100">
                    <p class="text-sm font-semibold text-gray-700">답글 작성</p>
                    <textarea id="replyContent" class="form-input h-20 resize-y" placeholder="답글 내용" required></textarea>
                    <input type="text" id="replyAuthor" class="form-input" placeholder="작성자 (닉네임)" required>
                    <input type="password" id="replyPassword" class="form-input" placeholder="답글 비밀번호 (삭제 시 필요)" required>
                    <button type="submit" class="btn-secondary text-sm px-4 py-2">답글 등록</button>
                </form>
            </div>
        `;
        detailModal.style.display = 'flex';

        const replyForm = document.getElementById('replyForm');
        if (replyForm) {
            replyForm.onsubmit = async (e) => {
                e.preventDefault();
                const pid = detailPostId;
                if (!pid) return;
                const content = document.getElementById('replyContent').value.trim();
                const author = document.getElementById('replyAuthor').value.trim();
                const password = document.getElementById('replyPassword').value;
                if (!content || !author || !password) {
                    alert('답글 내용·작성자·비밀번호를 모두 입력해 주세요.');
                    return;
                }
                const res = await fetch(`/api/community/${pid}/replies`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content, author, password }),
                });
                const body = await res.json().catch(() => ({}));
                if (res.ok) {
                    replyForm.reset();
                    await refreshRepliesInModal(pid);
                    loadCommunity();
                } else {
                    alert(body.error || '답글 등록에 실패했습니다.');
                }
            };
        }

        await refreshRepliesInModal(post.id);
    }

    async function loadCommunity() {
        const res = await fetch('/api/community');
        if (!res.ok) {
            communityList.innerHTML = '<div class="text-red-500">서버 오류</div>';
            return;
        }
        const posts = await res.json();
        communityPostsCache = posts;
        communityList.innerHTML = '';
        if (posts.length === 0) {
            noCommunityMsg.classList.remove('hidden');
            return;
        }
        noCommunityMsg.classList.add('hidden');

        posts.forEach((post) => {
            const card = document.createElement('div');
            card.className = 'card p-4 flex flex-col rounded-xl shadow-md cursor-pointer';
            let tagHtml = '';
            if (post.tags) {
                const tagArr = post.tags.split(/[#\s]+/).filter(Boolean);
                tagHtml = tagArr
                    .map(
                        (tag) =>
                            `<span class="tag cursor-pointer text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded mr-1" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</span>`
                    )
                    .join(' ');
            }
            let imgHtml = '';
            if (post.photoUrl) {
                imgHtml = `<img src="${escapeHtml(post.photoUrl)}" alt="이미지" class="w-full h-48 object-cover rounded mb-2" onerror="this.onerror=null;this.src='https://placehold.co/400x300?text=No+Image';">`;
            } else {
                imgHtml = `<img src="https://placehold.co/400x300?text=No+Image" alt="No Image" class="w-full h-48 object-cover rounded mb-2">`;
            }
            const rc = post.reply_count != null ? Number(post.reply_count) : 0;
            const replyBadge =
                rc > 0
                    ? `<span class="text-xs font-semibold text-indigo-600 ml-2">답글 ${rc}</span>`
                    : '';
            card.innerHTML = `
                ${imgHtml}
                <div class="text-lg font-bold mb-2">${escapeHtml(post.title)}${replyBadge}</div>
                <div class="text-gray-700 mb-3" style="white-space:pre-line;">${escapeHtml(post.content)}</div>
                <div class="flex flex-wrap gap-1 mb-2">${tagHtml}</div>
                <div class="flex justify-between items-center text-sm text-gray-500 mb-2">
                    <span>작성자: ${escapeHtml(post.author)}</span>
                    <span>${escapeHtml(post.created_at)}</span>
                </div>
                <div class="flex gap-2 mt-2">
                    <button type="button" class="edit-btn btn-secondary text-xs px-2 py-1 rounded" data-id="${post.id}">수정</button>
                    <button type="button" class="delete-btn btn-danger text-xs px-2 py-1 rounded" data-id="${post.id}">삭제</button>
                </div>
            `;
            card.onclick = function (evt) {
                if (
                    evt.target.classList.contains('edit-btn') ||
                    evt.target.classList.contains('delete-btn') ||
                    evt.target.classList.contains('tag')
                ) {
                    return;
                }
                showDetailModal(post);
            };
            communityList.appendChild(card);
        });

        document.querySelectorAll('.delete-btn').forEach((btn) => {
            btn.onclick = async function (ev) {
                ev.stopPropagation();
                const postId = this.getAttribute('data-id');
                const staff = getStaffSecret();
                let delBody;
                if (staff) {
                    if (!confirm('운영진 권한으로 이 글과 답글을 모두 삭제할까요?')) return;
                    delBody = JSON.stringify({ staffSecret: staff });
                } else {
                    const password = prompt('글 삭제를 위해 비밀번호를 입력하세요.');
                    if (!password) return;
                    delBody = JSON.stringify({ password });
                }
                const delRes = await fetch(`/api/community/${postId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: delBody,
                });
                if (delRes.ok) {
                    alert('삭제되었습니다.');
                    loadCommunity();
                } else {
                    const err = await delRes.json().catch(() => ({}));
                    alert(err.error || '비밀번호가 틀렸거나 삭제에 실패했습니다.');
                }
            };
        });

        document.querySelectorAll('.edit-btn').forEach((btn) => {
            btn.onclick = function (ev) {
                ev.stopPropagation();
                const postId = parseInt(this.getAttribute('data-id'), 10);
                const post = communityPostsCache.find((p) => Number(p.id) === postId);
                if (!post) {
                    alert('글을 찾을 수 없습니다.');
                    return;
                }
                currentEditId = postId;
                document.getElementById('editTitle').value = post.title || '';
                document.getElementById('editContent').value = post.content || '';
                document.getElementById('editAuthor').value = post.author || '';
                document.getElementById('editPassword').value = '';
                document.getElementById('editTags').value = post.tags || '';
                document.getElementById('editPhoto').value = '';
                editModal.style.display = 'flex';
            };
        });

        document.querySelectorAll('.tag').forEach((tagEl) => {
            tagEl.onclick = function (e) {
                e.stopPropagation();
            };
        });
    }

    loadCommunity();
});
