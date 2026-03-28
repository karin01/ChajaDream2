// 성공사례 게시판 JavaScript
let successStories = [];
let currentEditId = null;

// DOM 요소들
const writeBtn = document.getElementById('writeBtn');
const writeModal = document.getElementById('writeModal');
const closeWriteModal = document.getElementById('closeWriteModal');
const writeForm = document.getElementById('writeForm');
const successStoriesList = document.getElementById('successStoriesList');
const noSuccessStoriesMsg = document.getElementById('noSuccessStoriesMsg');

const editModal = document.getElementById('editModal');
const closeEditModal = document.getElementById('closeEditModal');
const editForm = document.getElementById('editForm');

const detailModal = document.getElementById('detailModal');
const closeDetailModal = document.getElementById('closeDetailModal');
const detailContent = document.getElementById('detailContent');

// 이벤트 리스너 등록 (다른 게시판과 동일하게 flex 모달)
writeBtn.addEventListener('click', () => {
    writeModal.style.display = 'flex';
    writeForm.reset();
});

closeWriteModal.addEventListener('click', () => {
    writeModal.style.display = 'none';
});

closeEditModal.addEventListener('click', () => {
    editModal.style.display = 'none';
    currentEditId = null;
    editForm.reset();
});

closeDetailModal.addEventListener('click', () => {
    detailModal.style.display = 'none';
});

// 등록·수정 폼은 배경 클릭으로 닫지 않음 — X만 닫기. 상세만 배경 클릭 닫기.
window.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.style.display = 'none';
});

// 글 작성 폼 제출
writeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let beforePhotoUrl = '';
    let afterPhotoUrl = '';
    
    // 이전 사진 업로드
    const beforePhotoFile = document.getElementById('beforePhoto').files[0];
    if (beforePhotoFile) {
        const formData = new FormData();
        formData.append('file', beforePhotoFile);
        try {
            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadResponse.json();
            if (uploadResult.url) {
                beforePhotoUrl = uploadResult.url;
            }
        } catch (error) {
            console.error('이전 사진 업로드 실패:', error);
            alert('이전 사진 업로드에 실패했습니다.');
            return;
        }
    }
    
    // 이후 사진 업로드
    const afterPhotoFile = document.getElementById('afterPhoto').files[0];
    if (afterPhotoFile) {
        const formData = new FormData();
        formData.append('file', afterPhotoFile);
        try {
            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadResponse.json();
            if (uploadResult.url) {
                afterPhotoUrl = uploadResult.url;
            }
        } catch (error) {
            console.error('이후 사진 업로드 실패:', error);
            alert('이후 사진 업로드에 실패했습니다.');
            return;
        }
    }
    
    await submitSuccessStory(beforePhotoUrl, afterPhotoUrl);
});

async function submitSuccessStory(beforePhotoUrl, afterPhotoUrl) {
    const formData = {
        title: document.getElementById('title').value,
        content: document.getElementById('content').value,
        petType: document.getElementById('petType').value,
        beforePhotoUrl: beforePhotoUrl,
        afterPhotoUrl: afterPhotoUrl,
        author: document.getElementById('author').value,
        password: document.getElementById('password').value
    };

    try {
        const response = await fetch('/api/success-stories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert('성공 사례가 등록되었습니다.');
            writeModal.style.display = 'none';
            writeForm.reset();
            loadSuccessStories();
        } else {
            const error = await response.json();
            alert('등록 실패: ' + error.error);
        }
    } catch (error) {
        console.error('등록 실패:', error);
        alert('등록에 실패했습니다.');
    }
}

// 글 수정 폼 제출
editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let beforePhotoUrl = '';
    let afterPhotoUrl = '';
    
    // 이전 사진 업로드
    const beforePhotoFile = document.getElementById('editBeforePhoto').files[0];
    if (beforePhotoFile) {
        const formData = new FormData();
        formData.append('file', beforePhotoFile);
        try {
            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadResponse.json();
            if (uploadResult.url) {
                beforePhotoUrl = uploadResult.url;
            }
        } catch (error) {
            console.error('이전 사진 업로드 실패:', error);
            alert('이전 사진 업로드에 실패했습니다.');
            return;
        }
    }
    
    // 이후 사진 업로드
    const afterPhotoFile = document.getElementById('editAfterPhoto').files[0];
    if (afterPhotoFile) {
        const formData = new FormData();
        formData.append('file', afterPhotoFile);
        try {
            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadResponse.json();
            if (uploadResult.url) {
                afterPhotoUrl = uploadResult.url;
            }
        } catch (error) {
            console.error('이후 사진 업로드 실패:', error);
            alert('이후 사진 업로드에 실패했습니다.');
            return;
        }
    }
    
    await updateSuccessStory(beforePhotoUrl, afterPhotoUrl);
});

async function updateSuccessStory(beforePhotoUrl, afterPhotoUrl) {
    let b = (beforePhotoUrl || '').trim();
    let a = (afterPhotoUrl || '').trim();
    if ((!b || !a) && currentEditId != null) {
        const prev = successStories.find((s) => s.id === currentEditId);
        if (prev) {
            if (!b && prev.beforePhotoUrl) b = prev.beforePhotoUrl;
            if (!a && prev.afterPhotoUrl) a = prev.afterPhotoUrl;
        }
    }
    const formData = {
        title: document.getElementById('editTitle').value,
        content: document.getElementById('editContent').value,
        petType: document.getElementById('editPetType').value,
        beforePhotoUrl: b,
        afterPhotoUrl: a,
        author: document.getElementById('editAuthor').value,
        password: document.getElementById('editPassword').value
    };
    const staff = typeof getStaffSecret === 'function' ? getStaffSecret() : '';
    if (staff) {
        formData.staffSecret = staff;
    }

    try {
        const response = await fetch(`/api/success-stories/${currentEditId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert('수정되었습니다.');
            editModal.style.display = 'none';
            currentEditId = null;
            document.getElementById('editForm').reset();
            loadSuccessStories();
        } else {
            const error = await response.json();
            alert('수정 실패: ' + error.error);
        }
    } catch (error) {
        console.error('수정 실패:', error);
        alert('수정에 실패했습니다.');
    }
}

// 성공사례 목록 로드
async function loadSuccessStories() {
    try {
        const response = await fetch('/api/success-stories');
        successStories = await response.json();
        displaySuccessStories();
    } catch (error) {
        console.error('성공사례 목록 로드 실패:', error);
    }
}

// 성공사례 목록 표시
function displaySuccessStories() {
    if (successStories.length === 0) {
        successStoriesList.innerHTML = '';
        noSuccessStoriesMsg.classList.remove('hidden');
        return;
    }

    noSuccessStoriesMsg.classList.add('hidden');
    successStoriesList.innerHTML = successStories.map(story => `
        <div class="card p-4 hover:shadow-lg transition-shadow duration-200">
            <div class="flex items-start space-x-4">
                <div class="flex-shrink-0">
                    <div class="relative">
                        ${story.afterPhotoUrl ? 
                            `<img src="${story.afterPhotoUrl}" alt="성공 후 사진" class="w-20 h-20 object-cover rounded-lg">` :
                            `<img src="https://placehold.co/100x100/2196F3/FFFFFF?text=성공" alt="성공 사례" class="w-20 h-20 object-cover rounded-lg">`
                        }
                        ${story.beforePhotoUrl ? 
                            `<div class="absolute -top-1 -left-1 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">전</div>` : ''
                        }
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="text-lg font-semibold text-gray-800 truncate">
                            ${story.title}
                        </h3>
                        <span class="text-sm text-gray-500">${formatDate(story.created_at)}</span>
                    </div>
                    <p class="text-sm text-gray-600 mb-2">
                        <strong>동물:</strong> ${story.petType ? getPetTypeText(story.petType) : '미상'}
                    </p>
                    <p class="text-sm text-gray-600 mb-3 line-clamp-2">
                        ${story.content.length > 100 ? story.content.substring(0, 100) + '...' : story.content}
                    </p>
                    <div class="flex space-x-2">
                        <button onclick="viewSuccessStoryDetail(${story.id})" 
                                class="btn-secondary text-sm px-3 py-1">
                            상세보기
                        </button>
                        <button onclick="editSuccessStory(${story.id})" 
                                class="btn-secondary text-sm px-3 py-1">
                            수정
                        </button>
                        <button onclick="deleteSuccessStory(${story.id})" 
                                class="btn-secondary text-sm px-3 py-1 text-red-600">
                            삭제
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 성공사례 상세보기
async function viewSuccessStoryDetail(id) {
    const story = successStories.find(s => s.id === id);
    if (!story) return;

    detailContent.innerHTML = `
        <h3 class="text-xl font-bold mb-4">성공 사례 상세</h3>
        <div class="space-y-4">
            <div>
                <h4 class="text-lg font-semibold text-gray-800 mb-2">${story.title}</h4>
                <p class="text-sm text-gray-600 mb-2">
                    <strong>동물 종류:</strong> ${story.petType ? getPetTypeText(story.petType) : '미상'}
                </p>
                <p class="text-sm text-gray-600 mb-2">
                    <strong>작성자:</strong> ${story.author}
                </p>
                <p class="text-sm text-gray-600 mb-4">
                    <strong>등록일:</strong> ${formatDate(story.created_at)}
                </p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${story.beforePhotoUrl ? `
                    <div>
                        <h5 class="font-semibold text-gray-700 mb-2">이전 사진 (실종/발견 당시)</h5>
                        <img src="${story.beforePhotoUrl}" alt="이전 사진" class="w-full rounded-lg">
                    </div>
                ` : ''}
                ${story.afterPhotoUrl ? `
                    <div>
                        <h5 class="font-semibold text-gray-700 mb-2">이후 사진 (재회/입양 후)</h5>
                        <img src="${story.afterPhotoUrl}" alt="이후 사진" class="w-full rounded-lg">
                    </div>
                ` : ''}
            </div>
            
            <div>
                <h5 class="font-semibold text-gray-700 mb-2">성공 사례 내용</h5>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <p class="text-gray-700 whitespace-pre-wrap">${story.content}</p>
                </div>
            </div>
        </div>
    `;
    detailModal.style.display = 'flex';
}

// 성공사례 수정
async function editSuccessStory(id) {
    const story = successStories.find(s => s.id === id);
    if (!story) return;

    currentEditId = id;
    
    // 폼에 기존 데이터 채우기
    document.getElementById('editTitle').value = story.title;
    document.getElementById('editContent').value = story.content;
    document.getElementById('editPetType').value = story.petType || '';
    document.getElementById('editAuthor').value = story.author;
    document.getElementById('editPassword').value = '';
    document.getElementById('editBeforePhoto').value = '';
    document.getElementById('editAfterPhoto').value = '';

    editModal.style.display = 'flex';
}

// 성공사례 삭제
async function deleteSuccessStory(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const staff = typeof getStaffSecret === 'function' ? getStaffSecret() : '';
    let body;
    if (staff) {
        if (!confirm('운영진 권한으로 이 글을 삭제할까요?')) return;
        body = JSON.stringify({ staffSecret: staff });
    } else {
        const password = prompt('비밀번호를 입력하세요:');
        if (!password) return;
        body = JSON.stringify({ password });
    }

    try {
        const response = await fetch(`/api/success-stories/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body
        });

        if (response.ok) {
            alert('삭제되었습니다.');
            loadSuccessStories();
        } else {
            const error = await response.json();
            alert('삭제 실패: ' + error.error);
        }
    } catch (error) {
        console.error('삭제 실패:', error);
        alert('삭제에 실패했습니다.');
    }
}

// 유틸리티 함수들
function getPetTypeText(type) {
    const types = {
        'dog': '강아지',
        'cat': '고양이',
        'etc': '기타'
    };
    return types[type] || type;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
}

// 페이지 로드 시 성공사례 목록 로드
document.addEventListener('DOMContentLoaded', loadSuccessStories); 