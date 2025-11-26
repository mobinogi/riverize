// ===============================================
// ⚡ 간편 일보 작성 (quickEntry.js)
// ===============================================

// 1. 모달 열기
function openQuickEntryModal() {
    const modalWrapper = document.getElementById('quick-entry-modal');
    
    // [핵심 수정] 열 때마다 무조건 '중앙 정렬'로 강제 초기화!
    // 아까 올라가 있던 상태라도 다시 끌어내립니다.
    if (modalWrapper) {
        modalWrapper.style.alignItems = ''; // CSS 기본값(center) 복구
        modalWrapper.style.paddingTop = ''; // 상단 여백 제거
    }

    // 화면 초기화
    const formContent = document.getElementById('qe-form-content');
    const resultContent = document.getElementById('qe-result-content');
    
    if (formContent) formContent.classList.remove('hidden');
    if (resultContent) resultContent.classList.add('hidden');

    document.getElementById('qe-manager').value = '';
    document.getElementById('qe-input-1').value = '';
    document.getElementById('qe-input-2').value = '';
    document.getElementById('qe-input-3').value = '';
    
    const baseClass = "flex-1 py-3 rounded-xl border border-white/30 bg-white/5 text-gray-200 font-bold hover:bg-white/20 transition-all";
    if(document.getElementById('qe-btn-kim')) document.getElementById('qe-btn-kim').className = baseClass;
    if(document.getElementById('qe-btn-jung')) document.getElementById('qe-btn-jung').className = baseClass;

    modalWrapper.classList.remove('hidden');

    // 백그라운드 생성 요청
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
    const hiddenInput = document.getElementById('qe-manager');

    hiddenInput.value = name;

    const activeClass = "flex-1 py-3 rounded-xl border border-green-400 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg transform scale-105 transition-all";
    const inactiveClass = "flex-1 py-3 rounded-xl border border-white/30 bg-white/5 text-gray-400 font-medium hover:bg-white/10 transition-all";

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

    if (!manager) { showToast("담당자를 선택해주세요!", "error"); return; }
    if (val1 === '' && val2 === '' && val3 === '') { showToast("수량을 입력해주세요.", "error"); return; }

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
            showToast(result.message, "success");
            showResultScreen(result);
        } else {
            showToast("저장 실패: " + result.message, "error");
        }
    } catch (e) {
        showToast("오류: " + e.message, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// 5. 결과 화면
function showResultScreen(data) {
    document.getElementById('qe-form-content').classList.add('hidden');
    document.getElementById('qe-result-content').classList.remove('hidden');

    const inputs = data.inputs || { v1: 0, v2: 0, v3: 0 };
    
    document.getElementById('res-manager').textContent = data.manager || document.getElementById('qe-manager').value;
    document.getElementById('res-val1').textContent = inputs.v1;
    document.getElementById('res-val2').textContent = inputs.v2;
    document.getElementById('res-val3').textContent = inputs.v3;
    
    const balanceLabel = (data.manager === '김원대') ? '최종 재고 (F8)' : '최종 재고 (F22)';
    document.getElementById('res-balance-label').textContent = balanceLabel;
    document.getElementById('res-balance').textContent = data.finalBalance;
}

// ====================================================================
// 📱 [핵심] 모바일 키보드 대응 (위치 고정 및 떨림 방지 최적화)
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

    // 1. 입력창 이벤트 (여기가 창을 올리는 유일한 곳!)
    inputs.forEach(input => {
        if(!input) return;

        // 🚀 [올리기] 입력창을 터치했을 때만!
        input.addEventListener('focus', () => {
            if (window.innerWidth <= 768) {
                if (keyboardBlurTimer) clearTimeout(keyboardBlurTimer);
                
                // 위로 올리기
                modalWrapper.style.alignItems = 'flex-start';
                modalWrapper.style.paddingTop = '40px'; // 높이 조절 (40px 추천)
            }
        });

        // 🛬 [내리기] 손 뗐을 때
        input.addEventListener('blur', () => {
            if (window.innerWidth <= 768) {
                // 0.2초 뒤에 내림 (다른 버튼 누를 시간 벌기)
                keyboardBlurTimer = setTimeout(() => {
                    modalWrapper.style.alignItems = '';
                    modalWrapper.style.paddingTop = '';
                }, 200);
            }
        });
    });

    // 2. 담당자 버튼 이벤트 (얘는 창을 움직이지 않음!)
    managerBtns.forEach(btn => {
        if(!btn) return;
        
        const preventDrop = () => {
            // ★ 핵심: 입력창에서 손을 떼고 이 버튼을 눌렀을 때,
            // 창이 내려가지 않도록 타이머만 취소합니다.
            // 창을 위로 올리는 코드는 삭제했습니다!
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
