// ===============================================
// ⚡ 간편 일보 작성 (quickEntry.js)
// ===============================================

// 1. 모달 열기
function openQuickEntryModal() {
    // X 버튼 다시 보이게 리셋
    const closeBtn = document.getElementById('qe-close-btn');
    if (closeBtn) {
        closeBtn.classList.remove('hidden');
    }

    // 폼은 보이고, 결과창은 숨김
    const formContent = document.getElementById('qe-form-content');
    const resultContent = document.getElementById('qe-result-content');

    if (formContent) formContent.classList.remove('hidden');
    if (resultContent) resultContent.classList.add('hidden');

    // ✅ [추가] 모달을 열자마자 로그를 서버로 전송합니다.
    logClientActionAsync('⚡ 간편 작성 모달 열기');
    
    // 입력값 초기화
    document.getElementById('qe-manager').value = '';
    document.getElementById('qe-input-1').value = '';
    document.getElementById('qe-input-2').value = '';
    document.getElementById('qe-input-3').value = '';

    // 버튼 스타일 초기화
    const baseClass = "flex-1 py-3 rounded-xl border border-white/10 bg-black/30 text-gray-300 font-bold hover:bg-white/10 transition-all shadow-inner";
    
    if (document.getElementById('qe-btn-kim')) {
        document.getElementById('qe-btn-kim').className = baseClass;
    }
    if (document.getElementById('qe-btn-jung')) {
        document.getElementById('qe-btn-jung').className = baseClass;
    }

    // 모달 띄우기
    document.getElementById('quick-entry-modal').classList.remove('hidden');

    // 백그라운드 생성 요청 (Pre-warming)
    if (typeof callAppsScript === 'function') {
        callAppsScript('generate').catch(e => console.log("Pre-warm error:", e));
    }
}

// 2. 닫기
function closeQuickEntryModal() {
    document.getElementById('quick-entry-modal').classList.add('hidden');
}

// 3. 담당자 선택
function selectQuickManager(name) {
    const btnKim = document.getElementById('qe-btn-kim');
    const btnJung = document.getElementById('qe-btn-jung');
    
    document.getElementById('qe-manager').value = name;

    const activeClass = "flex-1 py-3 rounded-xl border border-green-400 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg transform scale-105 transition-all";
    const inactiveClass = "flex-1 py-3 rounded-xl border border-white/10 bg-black/30 text-gray-300 font-bold hover:bg-white/10 transition-all shadow-inner";

    if (name === '김원대') {
        btnKim.className = activeClass;
        btnJung.className = inactiveClass;
    } else {
        btnKim.className = inactiveClass;
        btnJung.className = activeClass;
    }
}

// 4. 저장 및 결과 화면 전환
async function submitQuickDailyReport() {
    const manager = document.getElementById('qe-manager').value;
    const val1 = document.getElementById('qe-input-1').value;
    const val2 = document.getElementById('qe-input-2').value;
    const val3 = document.getElementById('qe-input-3').value;
    const submitBtn = document.getElementById('qe-submit-btn');

    // 유효성 검사
    if (!manager) {
        showToast("담당자를 선택해주세요!", "error");
        return;
    }
    if (val1 === '' && val2 === '' && val3 === '') {
        showToast("수량을 입력해주세요.", "error");
        return;
    }

    // 로딩 상태 표시
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 저장 중...`;

    try {
        const result = await callAppsScript('writeDailyLog', {
            manager: manager,
            val1: val1 || 0,
            val2: val2 || 0,
            val3: val3 || 0
        });

        if (result.status === 'success') {
            // 성공 시 토스트 알림 + 결과창 전환
            showToast(result.message, "success");
            showResultScreen(result);
        } else {
            showToast("저장 실패: " + result.message, "error");
        }
    } catch (e) {
        showToast("오류: " + e.message, "error");
    } finally {
        // 버튼 복구
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// 5. 결과 화면 보여주기
function showResultScreen(data) {
    // X 버튼 숨기기
    const closeBtn = document.getElementById('qe-close-btn');
    if (closeBtn) {
        closeBtn.classList.add('hidden');
    }

    // 화면 전환
    document.getElementById('qe-form-content').classList.add('hidden');
    document.getElementById('qe-result-content').classList.remove('hidden');

    // 데이터 채우기
    const inputs = data.inputs || { v1: 0, v2: 0, v3: 0 };
    
    document.getElementById('res-manager').textContent = data.manager || document.getElementById('qe-manager').value;
    document.getElementById('res-val1').textContent = inputs.v1;
    document.getElementById('res-val2').textContent = inputs.v2;
    document.getElementById('res-val3').textContent = inputs.v3;
    
    // 최종 재고 (라벨 단순화)
    document.getElementById('res-balance-label').textContent = '최종 재고';
    document.getElementById('res-balance').textContent = data.finalBalance;
}

// ====================================================================
// 📱 [핵심] 모바일 키보드 대응
// ====================================================================
let keyboardBlurTimer = null;

function attachMobileKeyboardFix() {
    const inputs = [
        document.getElementById('qe-input-1'),
        document.getElementById('qe-input-2'),
        document.getElementById('qe-input-3')
    ];
    
    const managerBtns = [
        document.getElementById('qe-btn-kim'),
        document.getElementById('qe-btn-jung')
    ];
    
    const modalWrapper = document.getElementById('quick-entry-modal');

    // 1. 입력창 이벤트
    inputs.forEach(input => {
        if(!input) return;

        // 올리기
        input.addEventListener('focus', () => {
            if (window.innerWidth <= 768) {
                if (keyboardBlurTimer) clearTimeout(keyboardBlurTimer);
                
                modalWrapper.style.alignItems = 'flex-start';
                modalWrapper.style.paddingTop = '20px'; 
            }
        });

        // 내리기
        input.addEventListener('blur', () => {
            if (window.innerWidth <= 768) {
                keyboardBlurTimer = setTimeout(() => {
                    modalWrapper.style.alignItems = '';
                    modalWrapper.style.paddingTop = '';
                }, 200);
            }
        });
    });

    // 2. 버튼 누르면 내려가지 않게 방어
    managerBtns.forEach(btn => {
        if(!btn) return;
        
        const preventDrop = () => { 
            if (keyboardBlurTimer) clearTimeout(keyboardBlurTimer); 
        };
        
        btn.addEventListener('click', preventDrop);
        btn.addEventListener('touchstart', preventDrop, { passive: true });
    });
}

// 스크립트 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    attachMobileKeyboardFix();
});


