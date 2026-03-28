// 성공사례 게시판 JavaScript
import { db } from './firebase-init.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let successStories = [];
let currentEditId = null;

// DOM 요소들
const writeBtn = document.getElementById('writeBtn');
const writeModal = document.getElementById('writeModal');
const closeWriteModal = document.getElementById('closeWriteModal');
const writeForm = document.getElementById('writeForm');
const storyList = document.getElementById('storyList');
const noStoryMsg = document.getElementById('noStoryMsg');

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

window.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.style.display = 'none';
});

// Firestore에서 성공사례 글 불러오기
async function loadSuccessStories() {
    const q = query(collection(db, "successStories"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const posts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderStoryList(posts);
}

function renderStoryList(posts) {
    storyList.innerHTML = '';
    if (posts.length === 0) {
        noStoryMsg.classList.remove('hidden');
        return;
    } else {
        noStoryMsg.classList.add('hidden');
    }
    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'card p-4 flex flex-col rounded-xl shadow-md';
        card.innerHTML = `
            <div class="text-lg font-bold mb-2">${post.title}</div>
            <div class="text-gray-700 mb-3" style="white-space:pre-line;">${post.content.length > 60 ? post.content.slice(0, 60) + '...' : post.content}</div>
            <div class="flex justify-between items-center text-sm text-gray-500 mb-2">
                <span>작성자: ${post.author}</span>
                <span>${formatDate(post.createdAt)}</span>
            </div>
            <div class="flex space-x-2 mt-2">
                <button class="btn-secondary text-xs px-2 py-1" onclick="editStoryPrompt('${post.id}')">수정</button>
                <button class="btn-secondary text-xs px-2 py-1 text-red-600" onclick="deleteStoryPrompt('${post.id}')">삭제</button>
                <button class="btn-secondary text-xs px-2 py-1" onclick="viewStoryDetail('${post.id}')">상세</button>
            </div>
        `;
        storyList.appendChild(card);
    });
}

window.editStoryPrompt = async function(id) {
    const q = query(collection(db, "successStories"));
    const querySnapshot = await getDocs(q);
    const post = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).find(p => p.id === id);
    if (!post) return;
    const input = prompt('비밀번호를 입력하세요:');
    if (input !== post.password) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }
    currentEditId = id;
    document.getElementById('editTitle').value = post.title;
    document.getElementById('editContent').value = post.content;
    document.getElementById('editAuthor').value = post.author;
    document.getElementById('editPassword').value = post.password;
    document.getElementById('editPetType').value = post.petType;
    editModal.style.display = 'block';
};

window.deleteStoryPrompt = async function(id) {
    const q = query(collection(db, "successStories"));
    const querySnapshot = await getDocs(q);
    const post = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).find(p => p.id === id);
    if (!post) return;
    const input = prompt('비밀번호를 입력하세요:');
    if (input !== post.password) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }
    if (confirm('정말 삭제하시겠습니까?')) {
        await deleteDoc(doc(db, "successStories", id));
        alert('삭제되었습니다.');
        loadSuccessStories();
    }
};

window.viewStoryDetail = async function(id) {
    const q = query(collection(db, "successStories"));
    const querySnapshot = await getDocs(q);
    const post = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).find(p => p.id === id);
    if (!post) return;
    detailContent.innerHTML = `
        <h3 class="text-xl font-bold mb-4">${post.title}</h3>
        <div class="mb-2 text-gray-700">${post.content.replace(/\n/g, '<br>')}</div>
        <div class="text-sm text-gray-500 mb-2">작성자: ${post.author}</div>
        <div class="text-sm text-gray-500">등록일: ${formatDate(post.createdAt)}</div>
    `;
    detailModal.style.display = 'block';
};

writeForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;
    const author = document.getElementById('author').value;
    const password = document.getElementById('password').value;
    const petType = document.getElementById('petType').value;
    // 파일 업로드(선택)
    let beforePhotoUrl = '';
    let afterPhotoUrl = '';
    const beforePhotoFile = document.getElementById('beforePhoto').files[0];
    if (beforePhotoFile) {
        const formData = new FormData();
        formData.append('file', beforePhotoFile);
        try {
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadRes.json();
            if (uploadResult.url) {
                beforePhotoUrl = uploadResult.url;
            }
        } catch (e) {
            alert('이전 사진 업로드에 실패했습니다.');
            return;
        }
    }
    const afterPhotoFile = document.getElementById('afterPhoto').files[0];
    if (afterPhotoFile) {
        const formData = new FormData();
        formData.append('file', afterPhotoFile);
        try {
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadRes.json();
            if (uploadResult.url) {
                afterPhotoUrl = uploadResult.url;
            }
        } catch (e) {
            alert('이후 사진 업로드에 실패했습니다.');
            return;
        }
    }
    await addDoc(collection(db, "successStories"), {
        title, content, author, password, petType, beforePhotoUrl, afterPhotoUrl, createdAt: new Date().toISOString()
    });
    writeModal.style.display = 'none';
    loadSuccessStories();
    alert('등록되었습니다!');
});

editForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!currentEditId) return;
    const title = document.getElementById('editTitle').value;
    const content = document.getElementById('editContent').value;
    const author = document.getElementById('editAuthor').value;
    const password = document.getElementById('editPassword').value;
    const petType = document.getElementById('editPetType').value;
    // 파일 업로드(선택)
    let beforePhotoUrl = '';
    let afterPhotoUrl = '';
    const beforePhotoFile = document.getElementById('editBeforePhoto').files[0];
    if (beforePhotoFile) {
        const formData = new FormData();
        formData.append('file', beforePhotoFile);
        try {
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadRes.json();
            if (uploadResult.url) {
                beforePhotoUrl = uploadResult.url;
            }
        } catch (e) {
            alert('이전 사진 업로드에 실패했습니다.');
            return;
        }
    }
    const afterPhotoFile = document.getElementById('editAfterPhoto').files[0];
    if (afterPhotoFile) {
        const formData = new FormData();
        formData.append('file', afterPhotoFile);
        try {
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadRes.json();
            if (uploadResult.url) {
                afterPhotoUrl = uploadResult.url;
            }
        } catch (e) {
            alert('이후 사진 업로드에 실패했습니다.');
            return;
        }
    }
    await updateDoc(doc(db, "successStories", currentEditId), {
        title, content, author, password, petType, beforePhotoUrl, afterPhotoUrl
    });
    editModal.style.display = 'none';
    currentEditId = null;
    loadSuccessStories();
    alert('수정되었습니다!');
});

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
}

document.addEventListener('DOMContentLoaded', loadSuccessStories); 