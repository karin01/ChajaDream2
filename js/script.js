// Firestore 인스턴스
const db = window.db;
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Get DOM elements
const petForm = document.getElementById('petForm');
const postsContainer = document.getElementById('postsContainer');
const noPostsMessage = document.getElementById('noPostsMessage');
const postTypeSelect = document.getElementById('postType');
const formTitle = document.getElementById('form-title');
const postModal = document.getElementById('postModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalPhoto = document.getElementById('modalPhoto');
const modalInfo = document.getElementById('modalInfo');

// 게시물 등록
petForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const photoFile = document.getElementById('photo').files[0];
    let photoUrl = '';
    if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        try {
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadRes.json();
            if (uploadResult.url) {
                photoUrl = uploadResult.url;
            }
        } catch (e) {
            alert('사진 업로드에 실패했습니다.');
            return;
        }
    }
    const postType = postTypeSelect.value;
    const petType = document.getElementById('petType').value;
    const breed = document.getElementById('breed').value;
    const gender = document.getElementById('gender').value;
    const age = document.getElementById('age').value;
    const color = document.getElementById('color').value;
    const description = document.getElementById('description').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const address = document.getElementById('address').value;
    const contactName = document.getElementById('contactName').value;
    const contactPhone = document.getElementById('contactPhone').value;
    const password = prompt('게시물 수정/삭제용 비밀번호를 입력하세요:');
    if (!password) {
        alert('비밀번호는 필수입니다.');
        return;
    }
    const newPost = {
        postType, petType, breed, gender, age, color, description, date, time, address, contactName, contactPhone, photoUrl: photoUrl || '',
        password,
        createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, "mainPosts"), newPost);
    petForm.reset();
    showMessageBox('게시물이 성공적으로 등록되었습니다!', 'success');
    renderPosts();
});

// Firestore에서 게시물 불러오기
async function fetchPostsFromFirestore() {
    const q = query(collection(db, "mainPosts"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// 게시물 렌더링
async function renderPosts() {
    postsContainer.innerHTML = '';
    const posts = await fetchPostsFromFirestore();
    if (posts.length === 0) {
        noPostsMessage.classList.remove('hidden');
        return;
    } else {
        noPostsMessage.classList.add('hidden');
    }
    posts.forEach(post => {
        const postCard = document.createElement('div');
        postCard.className = 'card p-4 flex flex-col rounded-xl shadow-md transition-transform duration-300 hover:scale-105';
        postCard.innerHTML = `
            <img src="${post.photoUrl || 'https://placehold.co/400x300/e0e0e0/000000?text=No+Image'}" alt="${post.breed} Photo" class="photo-preview mb-4">
            <div class="flex-grow">
                <span class="inline-block px-3 py-1 text-xs font-semibold rounded-full ${post.postType === 'lost' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} mb-2">
                    ${post.postType === 'lost' ? '실종' : '발견'}
                </span>
                <h4 class="text-xl font-semibold text-gray-800 mb-2">${post.breed} (${getPetTypeText(post.petType)})</h4>
                <p class="text-gray-600 text-sm mb-1"><strong>성별:</strong> ${getGenderText(post.gender)}</p>
                <p class="text-gray-600 text-sm mb-1"><strong>나이:</strong> ${post.age || '미상'}</p>
                <p class="text-gray-600 text-sm mb-1"><strong>특징:</strong> ${post.color}</p>
                <p class="text-gray-600 text-sm mb-1"><strong>장소:</strong> ${post.address}</p>
                <p class="text-gray-600 text-sm mb-1"><strong>날짜:</strong> ${post.date}</p>
                <p class="text-gray-600 text-sm mt-4"><strong>연락처:</strong> ${post.contactPhone}</p>
            </div>
            <p class="text-xs text-gray-500 mt-4 text-right">등록일: ${formatDate(post.createdAt)}</p>
            <div class="flex space-x-2 mt-2">
                <button class="btn-secondary text-xs px-2 py-1" onclick="editPostPrompt('${post.id}')">수정</button>
                <button class="btn-secondary text-xs px-2 py-1 text-red-600" onclick="deletePostPrompt('${post.id}')">삭제</button>
            </div>
        `;
        postCard.onclick = (e) => {
            if (e.target.tagName === 'BUTTON') return;
            showPostModal(post);
        };
        postsContainer.appendChild(postCard);
    });
}

window.editPostPrompt = async function(id) {
    const posts = await fetchPostsFromFirestore();
    const post = posts.find(p => p.id === id);
    if (!post) return;
    const input = prompt('비밀번호를 입력하세요:');
    if (input !== post.password) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }
    // 간단 예시: 품종만 수정
    const newBreed = prompt('새 품종을 입력하세요:', post.breed);
    if (newBreed && newBreed !== post.breed) {
        await updateDoc(doc(db, "mainPosts", id), { breed: newBreed });
        showMessageBox('수정되었습니다.', 'success');
        renderPosts();
    }
};

window.deletePostPrompt = async function(id) {
    const posts = await fetchPostsFromFirestore();
    const post = posts.find(p => p.id === id);
    if (!post) return;
    const input = prompt('비밀번호를 입력하세요:');
    if (input !== post.password) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }
    if (confirm('정말 삭제하시겠습니까?')) {
        await deleteDoc(doc(db, "mainPosts", id));
        showMessageBox('삭제되었습니다.', 'success');
        renderPosts();
    }
};

function showMessageBox(message, type = 'info') {
    const messageBox = document.createElement('div');
    messageBox.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-xl text-white z-50 transition-transform transform ${type === 'success' ? 'bg-green-600' : 'bg-blue-600'} translate-y-full opacity-0`;
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

postTypeSelect.addEventListener('change', (event) => {
    updateFormTitle(event.target.value);
});

function updateFormTitle(type) {
    if (type === 'lost') {
        formTitle.textContent = '실종 동물 등록';
    } else if (type === 'found') {
        formTitle.textContent = '발견 동물 알리기';
    } else {
        formTitle.textContent = '게시물 등록';
    }
}

window.onload = function() {
    renderPosts();
    updateFormTitle(postTypeSelect.value);
};

function showPostModal(post) {
    modalPhoto.src = post.photoUrl || 'https://placehold.co/400x300/e0e0e0/000000?text=No+Image';
    modalInfo.innerHTML = `
        <div style='font-size:1.15rem; font-weight:700; margin-bottom:0.5rem;'>${post.breed} (${getPetTypeText(post.petType)})</div>
        <div style='margin-bottom:0.5rem;'>종류: ${post.postType === 'lost' ? '실종' : '발견'}</div>
        <div style='margin-bottom:0.5rem;'>성별: ${getGenderText(post.gender)}</div>
        <div style='margin-bottom:0.5rem;'>나이: ${post.age || '미상'}</div>
        <div style='margin-bottom:0.5rem;'>특징: ${post.color}</div>
        <div style='margin-bottom:0.5rem;'>장소: ${post.address}</div>
        <div style='margin-bottom:0.5rem;'>날짜: ${post.date} ${post.time ? post.time : ''}</div>
        <div style='margin-bottom:0.5rem;'>연락처: ${post.contactPhone}</div>
        <div style='margin-bottom:0.5rem;'>등록자: ${post.contactName}</div>
        <div style='margin-bottom:0.5rem; color:#888; font-size:0.95rem;'>등록일: ${formatDate(post.createdAt)}</div>
        <div style='margin-top:1rem; color:#7f7fd5; font-size:0.98rem;'>※ 개인정보 보호를 위해 안심번호 사용을 권장합니다.</div>
    `;
    postModal.style.display = 'flex';
}

closeModalBtn.onclick = function() {
    postModal.style.display = 'none';
    modalPhoto.src = '';
    modalInfo.innerHTML = '';
};

window.addEventListener('click', function(event) {
    if (event.target === postModal) {
        postModal.style.display = 'none';
        modalPhoto.src = '';
        modalInfo.innerHTML = '';
    }
});

function getPetTypeText(type) {
    const types = { 'dog': '강아지', 'cat': '고양이', 'etc': '기타' };
    return types[type] || type;
}

function getGenderText(gender) {
    const genders = { 'male': '수컷', 'female': '암컷', 'unknown': '미상' };
    return genders[gender] || gender;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
}

// 실종동물 최신 게시물 미리보기 로드
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
            noMsg.classList.remove('hidden');
            return;
        } else {
            noMsg.classList.add('hidden');
        }
        
        posts.slice(0, 3).forEach(pet => {
            const card = document.createElement('div');
            card.className = 'card p-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer';
            card.onclick = () => window.location.href = 'lost-pets.html';
            card.innerHTML = `
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0">
                        <img src="${pet.photoUrl || 'https://placehold.co/80x80/FF6B6B/FFFFFF?text=실종'}" 
                             alt="실종 동물 사진" 
                             class="w-16 h-16 object-cover rounded-lg">
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-gray-800 truncate">
                            ${getPetTypeText(pet.petType)} - ${pet.breed}
                        </h4>
                        <p class="text-xs text-gray-600 mb-1">
                            <strong>특징:</strong> ${pet.color}
                        </p>
                        <p class="text-xs text-gray-600 mb-1">
                            <strong>실종:</strong> ${pet.lostDate}
                        </p>
                        <p class="text-xs text-gray-600">
                            <strong>장소:</strong> ${pet.address}
                        </p>
                    </div>
                </div>
            `;
            previewBox.appendChild(card);
        });
    } catch (error) {
        console.error('실종동물 미리보기 로드 실패:', error);
        previewBox.innerHTML = '<div class="text-red-500 text-center">서버 연결 오류</div>';
    }
}

// 발견동물 최신 게시물 미리보기 로드
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
            noMsg.classList.remove('hidden');
            return;
        } else {
            noMsg.classList.add('hidden');
        }
        
        posts.slice(0, 3).forEach(pet => {
            const card = document.createElement('div');
            card.className = 'card p-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer';
            card.onclick = () => window.location.href = 'found-pets.html';
            card.innerHTML = `
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0">
                        <img src="${pet.photoUrl || 'https://placehold.co/80x80/4CAF50/FFFFFF?text=발견'}" 
                             alt="발견 동물 사진" 
                             class="w-16 h-16 object-cover rounded-lg">
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-gray-800 truncate">
                            ${getPetTypeText(pet.petType)} - ${pet.breed}
                        </h4>
                        <p class="text-xs text-gray-600 mb-1">
                            <strong>특징:</strong> ${pet.color}
                        </p>
                        <p class="text-xs text-gray-600 mb-1">
                            <strong>발견:</strong> ${pet.foundDate}
                        </p>
                        <p class="text-xs text-gray-600">
                            <strong>장소:</strong> ${pet.address}
                        </p>
                    </div>
                </div>
            `;
            previewBox.appendChild(card);
        });
    } catch (error) {
        console.error('발견동물 미리보기 로드 실패:', error);
        previewBox.innerHTML = '<div class="text-red-500 text-center">서버 연결 오류</div>';
    }
}

// 성공사례 최신 게시물 미리보기 로드
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
            noMsg.classList.remove('hidden');
            return;
        } else {
            noMsg.classList.add('hidden');
        }
        
        stories.slice(0, 3).forEach(story => {
            const card = document.createElement('div');
            card.className = 'card p-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer';
            card.onclick = () => window.location.href = 'success-stories.html';
            card.innerHTML = `
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0">
                        <div class="relative">
                            ${story.afterPhotoUrl ? 
                                `<img src="${story.afterPhotoUrl}" alt="성공 후 사진" class="w-16 h-16 object-cover rounded-lg">` :
                                `<img src="https://placehold.co/80x80/2196F3/FFFFFF?text=성공" alt="성공 사례" class="w-16 h-16 object-cover rounded-lg">`
                            }
                            ${story.beforePhotoUrl ? 
                                `<div class="absolute -top-1 -left-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">전</div>` : ''
                            }
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-gray-800 truncate">
                            ${story.title}
                        </h4>
                        <p class="text-xs text-gray-600 mb-1">
                            <strong>동물:</strong> ${story.petType ? getPetTypeText(story.petType) : '미상'}
                        </p>
                        <p class="text-xs text-gray-600 line-clamp-2">
                            ${story.content.length > 50 ? story.content.substring(0, 50) + '...' : story.content}
                        </p>
                    </div>
                </div>
            `;
            previewBox.appendChild(card);
        });
    } catch (error) {
        console.error('성공사례 미리보기 로드 실패:', error);
        previewBox.innerHTML = '<div class="text-red-500 text-center">서버 연결 오류</div>';
    }
}

// 커뮤니티 최신 글 미리보기 렌더링
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
            noMsg.classList.remove('hidden');
            return;
        } else {
            noMsg.classList.add('hidden');
        }
        posts.slice(0, 4).forEach(post => {
            const card = document.createElement('div');
            card.className = 'card p-4 flex flex-col rounded-xl shadow-md';
            card.innerHTML = `
                <div class="text-lg font-bold mb-2">${post.title}</div>
                <div class="text-gray-700 mb-3" style="white-space:pre-line;">${post.content.length > 60 ? post.content.slice(0, 60) + '...' : post.content}</div>
                <div class="flex justify-between items-center text-sm text-gray-500">
                    <span>작성자: ${post.author}</span>
                    <span>${post.created_at}</span>
                </div>
            `;
            previewBox.appendChild(card);
        });
    } catch (e) {
        previewBox.innerHTML = '<div class="text-red-500">커뮤니티 서버 오류</div>';
    }
}

// 페이지 로드 시 모든 미리보기 로드
window.addEventListener('DOMContentLoaded', () => {
    loadLostPetsPreview();
    loadFoundPetsPreview();
    loadSuccessStoriesPreview();
    loadCommunityPreview();
});
