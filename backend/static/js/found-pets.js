// 발견동물 게시판 JavaScript
let foundPets = [];
let currentEditId = null;

// DOM 요소들
const writeBtn = document.getElementById('writeBtn');
const writeModal = document.getElementById('writeModal');
const closeWriteModal = document.getElementById('closeWriteModal');
const writeForm = document.getElementById('writeForm');
const foundPetsList = document.getElementById('foundPetsList');
const noFoundPetsMsg = document.getElementById('noFoundPetsMsg');

const editModal = document.getElementById('editModal');
const closeEditModal = document.getElementById('closeEditModal');
const editForm = document.getElementById('editForm');

const detailModal = document.getElementById('detailModal');
const closeDetailModal = document.getElementById('closeDetailModal');
const detailContent = document.getElementById('detailContent');

// 이벤트 리스너 등록 (실종 게시판과 동일: flex 모달·요소 없으면 생략)
if (writeBtn && writeModal && writeForm) {
    writeBtn.addEventListener('click', () => {
        writeModal.style.display = 'flex';
        writeForm.reset();
    });
}

if (closeWriteModal && writeModal) {
    closeWriteModal.addEventListener('click', () => {
        writeModal.style.display = 'none';
    });
}

if (closeEditModal && editModal) {
    closeEditModal.addEventListener('click', () => {
        editModal.style.display = 'none';
        currentEditId = null;
    });
}

if (closeDetailModal && detailModal) {
    closeDetailModal.addEventListener('click', () => {
        detailModal.style.display = 'none';
    });
}

// 등록·수정 폼은 배경 클릭으로 닫지 않음 — X만 닫기. 상세만 배경 클릭 닫기.
window.addEventListener('click', (e) => {
    if (detailModal && e.target === detailModal) detailModal.style.display = 'none';
});

// 글 작성 폼 제출
if (writeForm) writeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    const photoFile = document.getElementById('photo').files[0];
    
    if (photoFile) {
        formData.append('file', photoFile);
        try {
            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadResponse.json();
            if (uploadResult.url) {
                await submitFoundPet(uploadResult.url);
            }
        } catch (error) {
            console.error('이미지 업로드 실패:', error);
            alert('이미지 업로드에 실패했습니다.');
        }
    } else {
        await submitFoundPet('');
    }
});

async function submitFoundPet(photoUrl) {
    const formData = {
        petType: document.getElementById('petType').value,
        breed: document.getElementById('breed').value,
        gender: document.getElementById('gender').value,
        petName: (document.getElementById('petName') && document.getElementById('petName').value) || '',
        age: document.getElementById('age').value,
        color: document.getElementById('color').value,
        description: document.getElementById('description').value,
        foundDate: document.getElementById('foundDate').value,
        foundTime: document.getElementById('foundTime').value,
        address: document.getElementById('address').value,
        contactName: document.getElementById('contactName').value,
        contactPhone: document.getElementById('contactPhone').value,
        photoUrl: photoUrl,
        author: document.getElementById('author').value,
        password: document.getElementById('password').value
    };

    try {
        const response = await fetch('/api/found-pets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert('발견 동물이 등록되었습니다.');
            if (writeModal) writeModal.style.display = 'none';
            writeForm.reset();
            loadFoundPets();
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
if (editForm) editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    const photoFile = document.getElementById('editPhoto').files[0];
    
    if (photoFile) {
        formData.append('file', photoFile);
        try {
            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadResponse.json();
            if (uploadResult.url) {
                await updateFoundPet(uploadResult.url);
            }
        } catch (error) {
            console.error('이미지 업로드 실패:', error);
            alert('이미지 업로드에 실패했습니다.');
        }
    } else {
        await updateFoundPet('');
    }
});

async function updateFoundPet(photoUrl) {
    let finalPhoto = (photoUrl || '').trim();
    if (!finalPhoto && currentEditId != null) {
        const prev = foundPets.find((p) => p.id === currentEditId);
        if (prev && prev.photoUrl) finalPhoto = prev.photoUrl;
    }
    const formData = {
        petType: document.getElementById('editPetType').value,
        breed: document.getElementById('editBreed').value,
        gender: document.getElementById('editGender').value,
        petName: (document.getElementById('editPetName') && document.getElementById('editPetName').value) || '',
        age: document.getElementById('editAge').value,
        color: document.getElementById('editColor').value,
        description: document.getElementById('editDescription').value,
        foundDate: document.getElementById('editFoundDate').value,
        foundTime: document.getElementById('editFoundTime').value,
        address: document.getElementById('editAddress').value,
        contactName: document.getElementById('editContactName').value,
        contactPhone: document.getElementById('editContactPhone').value,
        photoUrl: finalPhoto,
        author: document.getElementById('editAuthor').value,
        password: document.getElementById('editPassword').value
    };
    const staff = typeof getStaffSecret === 'function' ? getStaffSecret() : '';
    if (staff) {
        formData.staffSecret = staff;
    }

    try {
        const response = await fetch(`/api/found-pets/${currentEditId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert('수정되었습니다.');
            if (editModal) editModal.style.display = 'none';
            currentEditId = null;
            loadFoundPets();
        } else {
            const error = await response.json();
            alert('수정 실패: ' + error.error);
        }
    } catch (error) {
        console.error('수정 실패:', error);
        alert('수정에 실패했습니다.');
    }
}

// 발견동물 목록 로드
async function loadFoundPets() {
    try {
        const response = await fetch('/api/found-pets');
        foundPets = await response.json();
        displayFoundPets();
    } catch (error) {
        console.error('발견동물 목록 로드 실패:', error);
    }
}

// 발견동물 목록 표시
function displayFoundPets() {
    if (foundPets.length === 0) {
        foundPetsList.innerHTML = '';
        noFoundPetsMsg.classList.remove('hidden');
        return;
    }

    noFoundPetsMsg.classList.add('hidden');
    foundPetsList.innerHTML = foundPets.map(pet => `
        <div class="card p-4 hover:shadow-lg transition-shadow duration-200">
            <div class="flex items-start space-x-4">
                <div class="flex-shrink-0">
                    <img src="${pet.photoUrl || 'https://placehold.co/100x100/4CAF50/FFFFFF?text=발견'}" 
                         alt="발견 동물 사진" 
                         class="w-20 h-20 object-cover rounded-lg">
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="text-lg font-semibold text-gray-800 truncate">
                            ${getPetTypeText(pet.petType)} - ${pet.breed}${pet.petName ? ` · ${pet.petName}` : ''}
                        </h3>
                        <span class="text-sm text-gray-500">${formatDate(pet.created_at)}</span>
                    </div>
                    <p class="text-sm text-gray-600 mb-2">
                        <strong>특징:</strong> ${pet.color}
                    </p>
                    <p class="text-sm text-gray-600 mb-2">
                        <strong>발견:</strong> ${pet.foundDate} ${pet.foundTime ? pet.foundTime : ''}
                    </p>
                    <p class="text-sm text-gray-600 mb-3">
                        <strong>장소:</strong> ${pet.address}
                    </p>
                    <div class="flex space-x-2">
                        <button onclick="viewFoundPetDetail(${pet.id})" 
                                class="btn-secondary text-sm px-3 py-1">
                            상세보기
                        </button>
                        <button onclick="editFoundPet(${pet.id})" 
                                class="btn-secondary text-sm px-3 py-1">
                            수정
                        </button>
                        <button onclick="deleteFoundPet(${pet.id})" 
                                class="btn-secondary text-sm px-3 py-1 text-red-600">
                            삭제
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 발견동물 상세보기
async function viewFoundPetDetail(id) {
    const pet = foundPets.find(p => p.id === id);
    if (!pet) return;

    detailContent.innerHTML = `
        <h3 class="text-xl font-bold mb-4">발견 동물 상세 정보</h3>
        ${pet.photoUrl ? `<img src="${pet.photoUrl}" alt="발견 동물 사진" class="w-full max-w-md mx-auto mb-4 rounded-lg">` : ''}
        <div class="space-y-3">
            <p><strong>동물 종류:</strong> ${getPetTypeText(pet.petType)}</p>
            <p><strong>품종:</strong> ${pet.breed}</p>
            <p><strong>성별:</strong> ${getGenderText(pet.gender)}</p>
            ${pet.petName ? `<p><strong>이름:</strong> ${pet.petName}</p>` : ''}
            ${pet.age ? `<p><strong>나이:</strong> ${pet.age}</p>` : ''}
            <p><strong>털색 및 특징:</strong> ${pet.color}</p>
            ${pet.description ? `<p><strong>기타 특이사항:</strong> ${pet.description}</p>` : ''}
            <p><strong>발견 날짜:</strong> ${pet.foundDate}</p>
            ${pet.foundTime ? `<p><strong>발견 시간:</strong> ${pet.foundTime}</p>` : ''}
            <p><strong>발견 장소:</strong> ${pet.address}</p>
            <p><strong>연락처:</strong> ${pet.contactName} (${pet.contactPhone})</p>
            <p><strong>작성자:</strong> ${pet.author}</p>
            <p><strong>등록일:</strong> ${formatDate(pet.created_at)}</p>
        </div>
    `;
    detailModal.style.display = 'flex';
}

// 발견동물 수정
async function editFoundPet(id) {
    const pet = foundPets.find(p => p.id === id);
    if (!pet) return;

    currentEditId = id;
    
    // 폼에 기존 데이터 채우기
    document.getElementById('editPetType').value = pet.petType;
    document.getElementById('editBreed').value = pet.breed;
    document.getElementById('editGender').value = pet.gender;
    const editPetNameEl = document.getElementById('editPetName');
    if (editPetNameEl) editPetNameEl.value = pet.petName || '';
    document.getElementById('editAge').value = pet.age || '';
    document.getElementById('editColor').value = pet.color;
    document.getElementById('editDescription').value = pet.description || '';
    document.getElementById('editFoundDate').value = pet.foundDate;
    document.getElementById('editFoundTime').value = pet.foundTime || '';
    document.getElementById('editAddress').value = pet.address;
    document.getElementById('editContactName').value = pet.contactName;
    document.getElementById('editContactPhone').value = pet.contactPhone;
    document.getElementById('editAuthor').value = pet.author;
    
    editModal.style.display = 'flex';
}

// 발견동물 삭제
async function deleteFoundPet(id) {
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
        const response = await fetch(`/api/found-pets/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body
        });

        if (response.ok) {
            alert('삭제되었습니다.');
            loadFoundPets();
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

function getGenderText(gender) {
    const genders = {
        'male': '수컷',
        'female': '암컷',
        'unknown': '미상'
    };
    return genders[gender] || gender;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
}

/** 텔레그램 등: ?register=1 이면 등록 모달 자동 오픈 */
function openWriteModalIfRegisterQuery() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('register') !== '1') return;
        if (writeModal && writeForm) {
            writeForm.reset();
            writeModal.style.display = 'flex';
        }
        const u = new URL(window.location.href);
        u.searchParams.delete('register');
        const qs = u.searchParams.toString();
        window.history.replaceState({}, '', u.pathname + (qs ? '?' + qs : '') + u.hash);
    } catch (e) {
        console.warn('register 쿼리 처리 생략:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadFoundPets();
    openWriteModalIfRegisterQuery();
});