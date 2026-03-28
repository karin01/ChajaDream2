// 메인 페이지: 최신 피드 + 등록 모달

const petForm = document.getElementById('petForm');
const postsContainer = document.getElementById('postsContainer');
const noPostsMessage = document.getElementById('noPostsMessage');
const postTypeSelect = document.getElementById('postType');
const formTitle = document.getElementById('form-title');
const postModal = document.getElementById('postModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalPhoto = document.getElementById('modalPhoto');
const modalInfo = document.getElementById('modalInfo');
const registerModal = document.getElementById('registerModal');
const closeRegisterModalBtn = document.getElementById('closeRegisterModal');
const registerModalPanel = document.getElementById('registerModalPanel');

/** HTML 이스케이프 (카드 텍스트 삽입용) */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function openRegisterModal(mode) {
    if (!registerModal || !petForm || !postTypeSelect) return;
    petForm.reset();
    postTypeSelect.value = mode === 'found' ? 'found' : 'lost';
    updateFormTitle(postTypeSelect.value);
    registerModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeRegisterModal() {
    if (!registerModal) return;
    registerModal.style.display = 'none';
    document.body.style.overflow = '';
}

document.getElementById('btnRegisterLost')?.addEventListener('click', () => openRegisterModal('lost'));
document.getElementById('btnRegisterFound')?.addEventListener('click', () => openRegisterModal('found'));
closeRegisterModalBtn?.addEventListener('click', closeRegisterModal);
// 배경 클릭으로 닫지 않음(폼 입력 중 실수 방지) — 닫기는 X만
registerModalPanel?.addEventListener('click', (e) => e.stopPropagation());

// 메인 폼: 사진 업로드 후 실종/발견 API 저장
if (petForm && postTypeSelect) {
    petForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const postType = postTypeSelect.value;
        if (!postType) {
            showMessageBox('게시물 종류(실종/발견)를 선택해 주세요.', 'info');
            return;
        }

        const submitBtn = petForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        let photoUrl = '';
        const photoInput = document.getElementById('photo');
        const photoFile = photoInput && photoInput.files && photoInput.files[0];
        if (photoFile) {
            const formData = new FormData();
            formData.append('file', photoFile);
            try {
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                const uploadJson = await uploadRes.json();
                if (!uploadRes.ok || !uploadJson.url) {
                    throw new Error(uploadJson.error || '업로드 실패');
                }
                photoUrl = uploadJson.url;
            } catch (err) {
                console.error(err);
                showMessageBox('사진 업로드에 실패했습니다. 네트워크와 서버를 확인해 주세요.', 'info');
                if (submitBtn) submitBtn.disabled = false;
                return;
            }
        }

        const authorEl = document.getElementById('author');
        const passwordEl = document.getElementById('password');
        const author = authorEl ? authorEl.value.trim() : '';
        const password = passwordEl ? passwordEl.value : '';
        if (!author || !password) {
            showMessageBox('작성자와 비밀번호를 입력해 주세요.', 'info');
            if (submitBtn) submitBtn.disabled = false;
            return;
        }

        const payload = {
            petType: document.getElementById('petType').value,
            breed: document.getElementById('breed').value,
            gender: document.getElementById('gender').value,
            age: document.getElementById('age').value,
            color: document.getElementById('color').value,
            description: document.getElementById('description').value,
            address: document.getElementById('address').value,
            contactName: document.getElementById('contactName').value,
            contactPhone: document.getElementById('contactPhone').value,
            photoUrl: photoUrl,
            author: author,
            password: password,
        };

        const dateVal = document.getElementById('date').value;
        const timeVal = document.getElementById('time').value;
        const petNameInput = document.getElementById('petName');
        payload.petName = petNameInput ? petNameInput.value.trim() : '';
        let apiUrl;
        if (postType === 'lost') {
            payload.lostDate = dateVal;
            payload.lostTime = timeVal;
            apiUrl = '/api/lost-pets';
        } else {
            payload.foundDate = dateVal;
            payload.foundTime = timeVal;
            apiUrl = '/api/found-pets';
        }

        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(body.error || `서버 오류 (${res.status})`);
            }
            petForm.reset();
            closeRegisterModal();
            showMessageBox('게시물이 등록되었습니다!', 'success');
            loadLatestPostsFeed();
            loadCommunityPreview();
        } catch (err) {
            console.error(err);
            showMessageBox(String(err.message || err), 'info');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

function showMessageBox(message, type = 'info') {
    const messageBox = document.createElement('div');
    messageBox.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-xl text-white z-[1200] transition-transform transform ${type === 'success' ? 'bg-green-600' : 'bg-blue-600'} translate-y-full opacity-0`;
    messageBox.textContent = message;
    document.body.appendChild(messageBox);
    setTimeout(() => {
        messageBox.style.transform = 'translateY(0)';
        messageBox.style.opacity = '1';
    }, 100);
    setTimeout(() => {
        messageBox.style.transform = 'translateY(100%)';
        messageBox.style.opacity = '0';
        messageBox.addEventListener('transitionend', () => messageBox.remove());
    }, 3000);
}

/** 예전 스크롤 유틸 → 모달로 대체 */
function scrollToForm(type) {
    openRegisterModal(type === 'found' ? 'found' : 'lost');
}

if (postTypeSelect && formTitle) {
    postTypeSelect.addEventListener('change', (event) => {
        updateFormTitle(event.target.value);
    });
}

function updateFormTitle(type) {
    if (!formTitle) return;
    if (type === 'lost') {
        formTitle.textContent = '실종 동물 등록';
    } else if (type === 'found') {
        formTitle.textContent = '발견 동물 알리기';
    } else {
        formTitle.textContent = '게시물 등록';
    }
}

function showPostModal(post) {
    if (!postModal || !modalPhoto || !modalInfo) return;
    modalPhoto.src = post.photoUrl;
    modalInfo.innerHTML = `
        <div style='font-size:1.15rem; font-weight:700; margin-bottom:0.5rem;'>${post.breed} (${post.petType === 'dog' ? '강아지' : post.petType === 'cat' ? '고양이' : '기타'})</div>
        <div style='margin-bottom:0.5rem;'>종류: ${post.postType === 'lost' ? '실종' : '발견'}</div>
        <div style='margin-bottom:0.5rem;'>성별: ${post.gender === 'male' ? '수컷' : post.gender === 'female' ? '암컷' : '미상'}</div>
        <div style='margin-bottom:0.5rem;'>나이: ${post.age || '미상'}</div>
        <div style='margin-bottom:0.5rem;'>특징: ${post.color}</div>
        <div style='margin-bottom:0.5rem;'>장소: ${post.address}</div>
        <div style='margin-bottom:0.5rem;'>날짜: ${post.date} ${post.time ? post.time : ''}</div>
        <div style='margin-bottom:0.5rem;'>연락처: ${post.contactPhone}</div>
        <div style='margin-bottom:0.5rem;'>등록자: ${post.contactName}</div>
        <div style='margin-bottom:0.5rem; color:#888; font-size:0.95rem;'>등록일: ${post.createdAt}</div>
    `;
    postModal.style.display = 'flex';
}

if (closeModalBtn && postModal) {
    closeModalBtn.onclick = function() {
        postModal.style.display = 'none';
        modalPhoto.src = '';
        modalInfo.innerHTML = '';
    };
}

window.addEventListener('click', function(event) {
    if (postModal && event.target === postModal) {
        postModal.style.display = 'none';
        if (modalPhoto) modalPhoto.src = '';
        if (modalInfo) modalInfo.innerHTML = '';
    }
});

/** 실종+발견 API를 합쳐 메인 최신 게시물 그리드에 표시 */
async function loadLatestPostsFeed() {
    if (!postsContainer || !noPostsMessage) return;
    try {
        const [lr, fr] = await Promise.all([
            fetch('/api/lost-pets'),
            fetch('/api/found-pets'),
        ]);
        if (!lr.ok || !fr.ok) throw new Error('서버 오류');
        const lost = await lr.json();
        const found = await fr.json();

        const merged = [
            ...lost.map((p) => ({ ...p, _kind: 'lost', _sort: Number(p.id) || 0 })),
            ...found.map((p) => ({ ...p, _kind: 'found', _sort: Number(p.id) || 0 })),
        ].sort((a, b) => b._sort - a._sort);

        postsContainer.innerHTML = '';
        if (merged.length === 0) {
            noPostsMessage.classList.remove('hidden');
            return;
        }
        noPostsMessage.classList.add('hidden');

        merged.slice(0, 9).forEach((pet) => {
            const isLost = pet._kind === 'lost';
            const dateStr = isLost ? pet.lostDate : pet.foundDate;
            const badge = isLost ? '실종' : '발견';
            const badgeCls = isLost ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
            const ph = isLost ? 'FF6B6B' : '4CAF50';
            const imgSrc =
                pet.photoUrl ||
                `https://placehold.co/400x200/${ph}/FFFFFF?text=${encodeURIComponent(badge)}`;

            const card = document.createElement('div');
            card.className =
                'card p-4 flex flex-col rounded-xl shadow-md transition-transform hover:scale-[1.02] cursor-pointer';
            card.onclick = () => {
                window.location.href = isLost ? 'lost-pets.html' : 'found-pets.html';
            };
            card.innerHTML = `
                <span class="inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${badgeCls} mb-2 w-fit">${badge}</span>
                <img src="${imgSrc}" alt="" class="w-full h-40 object-cover rounded-lg mb-3 shadow-sm" loading="lazy"
                     onerror="this.onerror=null;this.src='https://placehold.co/400x200/${ph}/FFFFFF?text=photo';">
                <h4 class="text-lg font-semibold text-gray-800">${escapeHtml(getPetTypeText(pet.petType))} · ${escapeHtml(pet.breed)}</h4>
                <p class="text-gray-600 text-sm mt-1"><strong>특징:</strong> ${escapeHtml(pet.color)}</p>
                <p class="text-gray-600 text-sm"><strong>장소:</strong> ${escapeHtml(pet.address)}</p>
                <p class="text-gray-600 text-sm"><strong>일자:</strong> ${escapeHtml(dateStr || '')}</p>
            `;
            postsContainer.appendChild(card);
        });
    } catch (error) {
        console.error('최신 게시물 로드 실패:', error);
        postsContainer.innerHTML =
            '<p class="text-red-500 text-center col-span-full py-8">게시물을 불러오지 못했습니다. 서버를 실행했는지 확인해 주세요.</p>';
        noPostsMessage.classList.add('hidden');
    }
}

async function loadLostPetsPreview() {
    const previewBox = document.getElementById('lostPetsPreview');
    const noMsg = document.getElementById('noLostPetsPreviewMsg');
    if (!previewBox) return;
    try {
        const response = await fetch('/api/lost-pets');
        if (!response.ok) throw new Error('서버 오류');
        const posts = await response.json();
        previewBox.innerHTML = '';
        if (posts.length === 0) {
            if (noMsg) noMsg.classList.remove('hidden');
            return;
        }
        if (noMsg) noMsg.classList.add('hidden');
        posts.slice(0, 3).forEach((pet) => {
            const card = document.createElement('div');
            card.className = 'card p-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer';
            card.onclick = () => (window.location.href = 'lost-pets.html');
            card.innerHTML = `
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0">
                        <img src="${pet.photoUrl || 'https://placehold.co/80x80/FF6B6B/FFFFFF?text=실종'}" alt="" class="w-16 h-16 object-cover rounded-lg">
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-gray-800 truncate">${getPetTypeText(pet.petType)} - ${escapeHtml(pet.breed)}</h4>
                        <p class="text-xs text-gray-600 mb-1"><strong>특징:</strong> ${escapeHtml(pet.color)}</p>
                        <p class="text-xs text-gray-600 mb-1"><strong>실종:</strong> ${escapeHtml(pet.lostDate)}</p>
                        <p class="text-xs text-gray-600"><strong>장소:</strong> ${escapeHtml(pet.address)}</p>
                    </div>
                </div>`;
            previewBox.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        previewBox.innerHTML = '<div class="text-red-500 text-center">서버 연결 오류</div>';
    }
}

async function loadFoundPetsPreview() {
    const previewBox = document.getElementById('foundPetsPreview');
    const noMsg = document.getElementById('noFoundPetsPreviewMsg');
    if (!previewBox) return;
    try {
        const response = await fetch('/api/found-pets');
        if (!response.ok) throw new Error('서버 오류');
        const posts = await response.json();
        previewBox.innerHTML = '';
        if (posts.length === 0) {
            if (noMsg) noMsg.classList.remove('hidden');
            return;
        }
        if (noMsg) noMsg.classList.add('hidden');
        posts.slice(0, 3).forEach((pet) => {
            const card = document.createElement('div');
            card.className = 'card p-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer';
            card.onclick = () => (window.location.href = 'found-pets.html');
            card.innerHTML = `
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0">
                        <img src="${pet.photoUrl || 'https://placehold.co/80x80/4CAF50/FFFFFF?text=발견'}" alt="" class="w-16 h-16 object-cover rounded-lg">
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-gray-800 truncate">${getPetTypeText(pet.petType)} - ${escapeHtml(pet.breed)}</h4>
                        <p class="text-xs text-gray-600 mb-1"><strong>특징:</strong> ${escapeHtml(pet.color)}</p>
                        <p class="text-xs text-gray-600 mb-1"><strong>발견:</strong> ${escapeHtml(pet.foundDate)}</p>
                        <p class="text-xs text-gray-600"><strong>장소:</strong> ${escapeHtml(pet.address)}</p>
                    </div>
                </div>`;
            previewBox.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        previewBox.innerHTML = '<div class="text-red-500 text-center">서버 연결 오류</div>';
    }
}

async function loadSuccessStoriesPreview() {
    const previewBox = document.getElementById('successStoriesPreview');
    const noMsg = document.getElementById('noSuccessStoriesPreviewMsg');
    if (!previewBox) return;
    try {
        const response = await fetch('/api/success-stories');
        if (!response.ok) throw new Error('서버 오류');
        const stories = await response.json();
        previewBox.innerHTML = '';
        if (stories.length === 0) {
            if (noMsg) noMsg.classList.remove('hidden');
            return;
        }
        if (noMsg) noMsg.classList.add('hidden');
        stories.slice(0, 3).forEach((story) => {
            const card = document.createElement('div');
            card.className = 'card p-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer';
            card.onclick = () => (window.location.href = 'success-stories.html');
            card.innerHTML = `
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0">
                        ${story.afterPhotoUrl ? `<img src="${story.afterPhotoUrl}" alt="" class="w-16 h-16 object-cover rounded-lg">` : `<img src="https://placehold.co/80x80/2196F3/FFFFFF?text=성공" alt="" class="w-16 h-16 object-cover rounded-lg">`}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(story.title)}</h4>
                        <p class="text-xs text-gray-600 line-clamp-2">${escapeHtml(story.content.length > 50 ? story.content.substring(0, 50) + '...' : story.content)}</p>
                    </div>
                </div>`;
            previewBox.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        previewBox.innerHTML = '<div class="text-red-500 text-center">서버 연결 오류</div>';
    }
}

async function loadCommunityPreview() {
    const previewBox = document.getElementById('communityPreview');
    const noMsg = document.getElementById('noCommunityPreviewMsg');
    if (!previewBox) return;
    try {
        const res = await fetch('/api/community');
        if (!res.ok) throw new Error('서버 오류');
        const posts = await res.json();
        previewBox.innerHTML = '';
        if (posts.length === 0) {
            if (noMsg) noMsg.classList.remove('hidden');
            return;
        }
        if (noMsg) noMsg.classList.add('hidden');
        posts.slice(0, 4).forEach((post) => {
            const card = document.createElement('div');
            card.className = 'card p-4 flex flex-col rounded-xl shadow-md';
            const rc = post.reply_count != null ? Number(post.reply_count) : 0;
            const replyHint = rc > 0 ? ` <span class="text-xs text-indigo-600 font-semibold">· 답글 ${rc}</span>` : '';
            card.innerHTML = `
                <div class="text-lg font-bold mb-2">${escapeHtml(post.title)}${replyHint}</div>
                <div class="text-gray-700 mb-3" style="white-space:pre-line;">${escapeHtml(post.content.length > 60 ? post.content.slice(0, 60) + '...' : post.content)}</div>
                <div class="flex justify-between items-center text-sm text-gray-500">
                    <span>작성자: ${escapeHtml(post.author)}</span>
                    <span>${escapeHtml(post.created_at)}</span>
                </div>`;
            previewBox.appendChild(card);
        });
    } catch (e) {
        previewBox.innerHTML = '<div class="text-red-500">커뮤니티 서버 오류</div>';
    }
}

function getPetTypeText(type) {
    const types = { dog: '강아지', cat: '고양이', etc: '기타' };
    return types[type] || type;
}

window.addEventListener('DOMContentLoaded', () => {
    loadLatestPostsFeed();
    loadCommunityPreview();
    // 다른 페이지에 미리보기 박스가 있으면 아래 함수들이 동작함
    loadLostPetsPreview();
    loadFoundPetsPreview();
    loadSuccessStoriesPreview();
});
