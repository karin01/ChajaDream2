// 커뮤니티 게시판 JS
// 글 목록 불러오기, 글쓰기 모달, 글 등록, 카드형 렌더링

import { db } from './firebase-init.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
    const communityList = document.getElementById('communityList');
    const noCommunityMsg = document.getElementById('noCommunityMsg');
    const writeBtn = document.getElementById('writeBtn');
    const writeModal = document.getElementById('writeModal');
    const closeWriteModal = document.getElementById('closeWriteModal');
    const writeForm = document.getElementById('writeForm');
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');
    const authorInput = document.getElementById('author');
    const passwordInput = document.getElementById('password');
    const editModal = document.getElementById('editModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const editForm = document.getElementById('editForm');
    const editTitle = document.getElementById('editTitle');
    const editContent = document.getElementById('editContent');
    const editAuthor = document.getElementById('editAuthor');
    const editPassword = document.getElementById('editPassword');
    const photoInput = document.getElementById('photo');
    const tagsInput = document.getElementById('tags');
    const editPhotoInput = document.getElementById('editPhoto');
    const editTagsInput = document.getElementById('editTags');
    const detailModal = document.getElementById('detailModal');
    const closeDetailModal = document.getElementById('closeDetailModal');
    const detailContent = document.getElementById('detailContent');
    let editingPostId = null;
    let allPosts = [];
    let currentTag = null;

    // 글쓰기 모달 열기
    writeBtn.addEventListener('click', () => {
        writeModal.style.display = 'block';
        writeForm.reset();
    });
    // 모달 닫기
    closeWriteModal.addEventListener('click', () => {
        writeModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === detailModal) detailModal.style.display = 'none';
    });

    // 글 등록
    writeForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        const author = authorInput.value.trim();
        const password = passwordInput.value.trim();
        const tags = tagsInput.value.trim();
        let photoUrl = '';
        // 이미지 업로드
        const photoFile = photoInput.files[0];
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
        if (!title || !content || !author || !password) {
            alert('모든 항목을 입력해 주세요.');
            return;
        }
        // API로 글 등록
        await addDoc(collection(db, "communityPosts"), {
            title, content, author, password, photoUrl, tags, createdAt: new Date().toISOString()
        });
        writeModal.style.display = 'none';
        loadCommunityPosts();
        alert('등록되었습니다!');
    });

    // 글 목록 불러오기
    async function loadCommunityPosts() {
        const q = query(collection(db, "communityPosts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const posts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allPosts = posts;
        renderCommunityList(posts);
    }

    // 글 렌더링 함수
    function renderCommunityList(posts) {
        communityList.innerHTML = '';
        if (posts.length === 0) {
            noCommunityMsg.classList.remove('hidden');
            return;
        } else {
            noCommunityMsg.classList.add('hidden');
        }
        posts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'card p-4 flex flex-col rounded-xl shadow-md cursor-pointer';
            let tagHtml = '';
            if (post.tags) {
                const tagArr = post.tags.split(/[#\s]+/).filter(Boolean);
                tagHtml = tagArr.map(tag => `<span class="tag cursor-pointer text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded mr-1" data-tag="${tag}">#${tag}</span>`).join(' ');
            }
            card.innerHTML = `
                ${post.photoUrl ? `<img src="${post.photoUrl}" alt="이미지" class="w-full h-48 object-cover rounded mb-2" onerror=\"this.onerror=null;this.src='https://placehold.co/400x300?text=No+Image';\">` : ''}
                <div class="text-lg font-bold mb-2">${post.title}</div>
                <div class="text-gray-700 mb-3" style="white-space:pre-line;">${post.content.length > 60 ? post.content.slice(0, 60) + '...' : post.content}</div>
                <div class="flex flex-wrap gap-1 mb-2">${tagHtml}</div>
                <div class="flex justify-between items-center text-sm text-gray-500 mb-2">
                    <span>작성자: ${post.author}</span>
                    <span>${formatDate(post.createdAt)}</span>
                </div>
                <div class="flex space-x-2 mt-2">
                    <button class="btn-secondary text-xs px-2 py-1" onclick="editCommunityPrompt('${post.id}')">수정</button>
                    <button class="btn-secondary text-xs px-2 py-1 text-red-600" onclick="deleteCommunityPrompt('${post.id}')">삭제</button>
                    <button class="btn-secondary text-xs px-2 py-1" onclick="viewCommunityDetail('${post.id}')">상세</button>
                </div>
            `;
            // 카드 클릭 시 상세 모달 표시
            card.onclick = function(e) {
                // 수정/삭제 버튼 클릭 시는 무시
                if (e.target.classList.contains('edit-btn') || e.target.classList.contains('delete-btn') || e.target.classList.contains('tag')) return;
                showDetailModal(post);
            };
            communityList.appendChild(card);
        });
        // 태그 클릭 이벤트(검색)
        document.querySelectorAll('.tag').forEach(tagEl => {
            tagEl.onclick = function(e) {
                e.stopPropagation();
                const tag = this.getAttribute('data-tag');
                currentTag = tag;
                const filtered = allPosts.filter(post => post.tags && post.tags.includes(tag));
                renderCommunityList(filtered);
            };
        });
        // 삭제 버튼 이벤트
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = async function() {
                const postId = this.getAttribute('data-id');
                const password = prompt('비밀번호를 입력하세요');
                if (!password) return;
                await deleteDoc(doc(db, "communityPosts", postId));
                alert('삭제되었습니다.');
                loadCommunityPosts();
            };
        });
        // 수정 버튼 이벤트
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = function() {
                const postId = this.getAttribute('data-id');
                // 해당 글 정보 가져오기
                const post = posts.find(p => p.id == postId);
                if (!post) return;
                editingPostId = postId;
                editTitle.value = post.title;
                editContent.value = post.content;
                editAuthor.value = post.author;
                editPassword.value = '';
                editPhotoInput.value = '';
                editTagsInput.value = '';
                editModal.style.display = 'block';
            };
        });
        // 수정 폼 제출
        editForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const title = editTitle.value.trim();
            const content = editContent.value.trim();
            const author = editAuthor.value.trim();
            const password = editPassword.value.trim();
            const tags = editTagsInput.value.trim();
            let photoUrl = '';
            // 이미지 업로드
            const photoFile = editPhotoInput.files[0];
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
            if (!title || !content || !author || !password) {
                alert('모든 항목을 입력해 주세요.');
                return;
            }
            // API로 글 수정
            await updateDoc(doc(db, "communityPosts", editingPostId), {
                title, content, author, password, photoUrl, tags
            });
            editModal.style.display = 'none';
            currentEditId = null;
            loadCommunityPosts();
            alert('수정되었습니다!');
        });
    }

    // 상세 모달 표시 함수
    function showDetailModal(post) {
        let tagHtml = '';
        if (post.tags) {
            const tagArr = post.tags.split(/[#\s]+/).filter(Boolean);
            tagHtml = tagArr.map(tag => `<span class='tag text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded mr-1'>#${tag}</span>`).join(' ');
        }
        detailContent.innerHTML = `
            ${post.photoUrl ? `<img src='${post.photoUrl}' alt='이미지' class='w-full h-56 object-cover rounded mb-3' onerror="this.onerror=null;this.src='https://placehold.co/400x300?text=No+Image';">` : ''}
            <div class='text-2xl font-bold mb-2'>${post.title}</div>
            <div class='text-gray-700 mb-3' style='white-space:pre-line;'>${post.content.replace(/\n/g, '<br>')}</div>
            <div class='flex flex-wrap gap-1 mb-2'>${tagHtml}</div>
            <div class='flex justify-between items-center text-sm text-gray-500 mb-2'>
                <span>작성자: ${post.author}</span>
                <span>${formatDate(post.createdAt)}</span>
            </div>
        `;
        detailModal.style.display = 'block';
    }

    // 상세 모달 닫기
    closeDetailModal.addEventListener('click', () => {
        detailModal.style.display = 'none';
        detailContent.innerHTML = '';
    });

    // 최초 로딩
    loadCommunityPosts();

    // 날짜 포맷 함수
    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR');
    }
});