// 실종동물 게시판 JavaScript
let lostPets = [];
let currentEditId = null;

// DOM 요소들
const writeBtn = document.getElementById('writeBtn');
const writeModal = document.getElementById('writeModal');
const closeWriteModal = document.getElementById('closeWriteModal');
const writeForm = document.getElementById('writeForm');
const lostPetsList = document.getElementById('lostPetsList');
const noLostPetsMsg = document.getElementById('noLostPetsMsg');

const editModal = document.getElementById('editModal');
const closeEditModal = document.getElementById('closeEditModal');
const editForm = document.getElementById('editForm');

const detailModal = document.getElementById('detailModal');
const closeDetailModal = document.getElementById('closeDetailModal');
const detailContent = document.getElementById('detailContent');

// 이벤트 리스너 등록
writeBtn.addEventListener('click', () => {
    writeModal.style.display = 'block';
    writeForm.reset();
});

closeWriteModal.addEventListener('click', () => {
    writeModal.style.display = 'none';
});

closeEditModal.addEventListener('click', () => {
    editModal.style.display = 'none';
    currentEditId = null;
});

closeDetailModal.addEventListener('click', () => {
    detailModal.style.display = 'none';
});

// 등록·수정 폼은 배경 클릭으로 닫지 않음 — X만. 상세만 배경 클릭 닫기.
window.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.style.display = 'none';
});

// 글 작성 폼 제출
writeForm.addEventListener('submit', async (e) => {
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
                await submitLostPet(uploadResult.url);
            }
        } catch (error) {
            console.error('이미지 업로드 실패:', error);
            alert('이미지 업로드에 실패했습니다.');
        }
    } else {
        await submitLostPet('');
    }
});

async function submitLostPet(photoUrl) {
    const formData = {
        petType: document.getElementById('petType').value,
        breed: document.getElementById('breed').value,
        gender: document.getElementById('gender').value,
        petName: (document.getElementById('petName') && document.getElementById('petName').value) || '',
        age: document.getElementById('age').value,
        color: document.getElementById('color').value,
        description: document.getElementById('description').value,
        lostDate: document.getElementById('lostDate').value,
        lostTime: document.getElementById('lostTime').value,
        address: document.getElementById('address').value,
        contactName: document.getElementById('contactName').value,
        contactPhone: document.getElementById('contactPhone').value,
        photoUrl: photoUrl,
        author: document.getElementById('author').value,
        password: document.getElementById('password').value
    };

    try {
        const response = await fetch('/api/lost-pets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert('실종 동물이 등록되었습니다.');
            writeModal.style.display = 'none';
            writeForm.reset();
            loadLostPets();
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
                await updateLostPet(uploadResult.url);
            }
        } catch (error) {
            console.error('이미지 업로드 실패:', error);
            alert('이미지 업로드에 실패했습니다.');
        }
    } else {
        await updateLostPet('');
    }
});

async function updateLostPet(photoUrl) {
    let finalPhoto = (photoUrl || '').trim();
    if (!finalPhoto && currentEditId != null) {
        const prev = lostPets.find((p) => p.id === currentEditId);
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
        lostDate: document.getElementById('editLostDate').value,
        lostTime: document.getElementById('editLostTime').value,
        address: document.getElementById('editAddress').value,
        contactName: document.getElementById('editContactName').value,
        contactPhone: document.getElementById('editContactPhone').value,
        photoUrl: finalPhoto,
        author: document.getElementById('editAuthor').value,
        password: document.getElementById('editPassword').value
    };

    try {
        const response = await fetch(`/api/lost-pets/${currentEditId}`, {
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
            loadLostPets();
        } else {
            const error = await response.json();
            alert('수정 실패: ' + error.error);
        }
    } catch (error) {
        console.error('수정 실패:', error);
        alert('수정에 실패했습니다.');
    }
}

// 실종동물 목록 로드
async function loadLostPets() {
    try {
        const response = await fetch('/api/lost-pets');
        lostPets = await response.json();
        displayLostPets();
    } catch (error) {
        console.error('실종동물 목록 로드 실패:', error);
    }
}

// 실종동물 목록 표시
function displayLostPets() {
    if (lostPets.length === 0) {
        lostPetsList.innerHTML = '';
        noLostPetsMsg.classList.remove('hidden');
        return;
    }

    noLostPetsMsg.classList.add('hidden');
    lostPetsList.innerHTML = lostPets.map(pet => `
        <div class="card p-4 hover:shadow-lg transition-shadow duration-200">
            <div class="flex items-start space-x-4">
                <div class="flex-shrink-0">
                    <img src="${pet.photoUrl || 'https://placehold.co/100x100/FF6B6B/FFFFFF?text=실종'}" 
                         alt="실종 동물 사진" 
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
                        <strong>실종:</strong> ${pet.lostDate} ${pet.lostTime ? pet.lostTime : ''}
                    </p>
                    <p class="text-sm text-gray-600 mb-3">
                        <strong>장소:</strong> ${pet.address}
                    </p>
                    <div class="flex space-x-2">
                        <button onclick="viewLostPetDetail(${pet.id})" 
                                class="btn-secondary text-sm px-3 py-1">
                            상세보기
                        </button>
                        <button onclick="editLostPet(${pet.id})" 
                                class="btn-secondary text-sm px-3 py-1">
                            수정
                        </button>
                        <button onclick="deleteLostPet(${pet.id})" 
                                class="btn-secondary text-sm px-3 py-1 text-red-600">
                            삭제
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 실종동물 상세보기
async function viewLostPetDetail(id) {
    const pet = lostPets.find(p => p.id === id);
    if (!pet) return;

    detailContent.innerHTML = `
        <h3 class="text-xl font-bold mb-4">실종 동물 상세 정보</h3>
        ${pet.photoUrl ? `<img src="${pet.photoUrl}" alt="실종 동물 사진" class="w-full max-w-md mx-auto mb-4 rounded-lg">` : ''}
        <div class="space-y-3">
            <p><strong>동물 종류:</strong> ${getPetTypeText(pet.petType)}</p>
            <p><strong>품종:</strong> ${pet.breed}</p>
            <p><strong>성별:</strong> ${getGenderText(pet.gender)}</p>
            ${pet.petName ? `<p><strong>이름:</strong> ${pet.petName}</p>` : ''}
            ${pet.age ? `<p><strong>나이:</strong> ${pet.age}</p>` : ''}
            <p><strong>털색 및 특징:</strong> ${pet.color}</p>
            ${pet.description ? `<p><strong>기타 특이사항:</strong> ${pet.description}</p>` : ''}
            <p><strong>실종 날짜:</strong> ${pet.lostDate}</p>
            ${pet.lostTime ? `<p><strong>실종 시간:</strong> ${pet.lostTime}</p>` : ''}
            <p><strong>실종 장소:</strong> ${pet.address}</p>
            <p><strong>연락처:</strong> ${pet.contactName} (${pet.contactPhone})</p>
            <p><strong>작성자:</strong> ${pet.author}</p>
            <p><strong>등록일:</strong> ${formatDate(pet.created_at)}</p>
        </div>
    `;
    detailModal.style.display = 'block';
}

// 실종동물 수정
async function editLostPet(id) {
    const pet = lostPets.find(p => p.id === id);
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
    document.getElementById('editLostDate').value = pet.lostDate;
    document.getElementById('editLostTime').value = pet.lostTime || '';
    document.getElementById('editAddress').value = pet.address;
    document.getElementById('editContactName').value = pet.contactName;
    document.getElementById('editContactPhone').value = pet.contactPhone;
    document.getElementById('editAuthor').value = pet.author;
    
    editModal.style.display = 'block';
}

// 실종동물 삭제
async function deleteLostPet(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    const password = prompt('비밀번호를 입력하세요:');
    if (!password) return;

    try {
        const response = await fetch(`/api/lost-pets/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        if (response.ok) {
            alert('삭제되었습니다.');
            loadLostPets();
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

/** 텔레그램 등: ?register=1 이면 등록 모달 자동 오픈 후 주소창에서 파라미터 제거 */
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
    loadLostPets();
    openWriteModalIfRegisterQuery();
});