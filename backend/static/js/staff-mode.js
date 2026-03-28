/**
 * 운영진 모드 — sessionStorage 에 STAFF_MODE_SECRET 과 동일한 값 보관.
 * 커뮤니티·메인 등 어느 페이지에서든 같은 키를 쓰므로 한 번 로그인하면 다른 페이지에서도 삭제 시 적용됨.
 */
(function () {
    const STAFF_STORAGE_KEY = 'chajadream_staff_secret';

    function getStaffSecret() {
        try {
            return sessionStorage.getItem(STAFF_STORAGE_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    function setStaffSecret(secret) {
        try {
            if (secret) sessionStorage.setItem(STAFF_STORAGE_KEY, secret);
            else sessionStorage.removeItem(STAFF_STORAGE_KEY);
        } catch (e) {
            /* ignore */
        }
    }

    window.getStaffSecret = getStaffSecret;
    window.setStaffSecret = setStaffSecret;

    function initStaffModeUI() {
        const staffLoginModal = document.getElementById('staffLoginModal');
        const closeStaffLoginModal = document.getElementById('closeStaffLoginModal');
        const staffHiddenTrigger = document.getElementById('staffHiddenTrigger');
        const staffLoginForm = document.getElementById('staffLoginForm');
        const staffLoginInput = document.getElementById('staffLoginInput');
        const staffActiveSection = document.getElementById('staffActiveSection');
        const staffLoginSection = document.getElementById('staffLoginSection');
        const staffLogoutBtn = document.getElementById('staffLogoutBtn');

        if (!staffLoginModal && !staffHiddenTrigger) {
            return;
        }

        function syncStaffModalPanels() {
            const on = Boolean(getStaffSecret());
            if (staffActiveSection && staffLoginSection) {
                staffActiveSection.classList.toggle('hidden', !on);
                staffLoginSection.classList.toggle('hidden', on);
            }
        }

        function openStaffModal() {
            if (!staffLoginModal) return;
            syncStaffModalPanels();
            staffLoginModal.style.display = 'flex';
            staffLoginModal.setAttribute('aria-hidden', 'false');
            if (staffLoginInput && !getStaffSecret()) {
                staffLoginInput.value = '';
                staffLoginInput.focus();
            }
        }

        function closeStaffModal() {
            if (!staffLoginModal) return;
            staffLoginModal.style.display = 'none';
            staffLoginModal.setAttribute('aria-hidden', 'true');
            if (staffLoginInput) staffLoginInput.value = '';
        }

        if (staffHiddenTrigger) {
            staffHiddenTrigger.addEventListener('click', function (e) {
                e.preventDefault();
                openStaffModal();
            });
        }
        if (closeStaffLoginModal) {
            closeStaffLoginModal.addEventListener('click', closeStaffModal);
        }
        if (staffLoginModal) {
            staffLoginModal.addEventListener('click', function (e) {
                if (e.target === staffLoginModal) closeStaffModal();
            });
        }
        if (staffLogoutBtn) {
            staffLogoutBtn.addEventListener('click', function () {
                setStaffSecret('');
                syncStaffModalPanels();
                closeStaffModal();
            });
        }
        if (staffLoginForm) {
            staffLoginForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                const secret = (staffLoginInput && staffLoginInput.value.trim()) || '';
                if (!secret) {
                    alert('비밀번호를 입력해 주세요.');
                    return;
                }
                const vr = await fetch('/api/staff/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ staffSecret: secret }),
                });
                const j = await vr.json().catch(function () {
                    return {};
                });
                if (!j.ok) {
                    alert(j.error || '확인에 실패했습니다.');
                    return;
                }
                setStaffSecret(secret);
                syncStaffModalPanels();
                closeStaffModal();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStaffModeUI);
    } else {
        initStaffModeUI();
    }
})();
