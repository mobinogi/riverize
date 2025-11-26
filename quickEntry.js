// ===============================================
// ⚡ 간편 일보 작성 (quickEntry.js) - 모바일 키보드 완벽 대응
// ===============================================

// 1. 모달 열기
function openQuickEntryModal() {
    document.getElementById('qe-form-content').classList.remove('hidden');
    document.getElementById('qe-result-content').classList.add('hidden');

    document.getElementById('qe-manager').value = '';
    document.getElementById('qe-input-1').value = '';
    document.getElementById('qe-input-2').value = '';
    document.getElementById('qe-input-3').value = '';
    
    const baseClass = "flex-1 py-3 rounded-xl border border-white/30 bg-white/5 text-gray-200 font-bold hover:bg-white/20 transition-all";
    document.getElementById('qe-btn-kim').className = baseClass;
    document.getElementById('qe-btn-jung').className = baseClass;

    document.getElementById('quick-entry-modal').classList.remove('hidden');

    // [중요] 모달 열릴 때 키보드 감지 기능 장착!
    attachMobileKeyboardFix();

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

// 4. 저장
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
// 📱 [핵심] 모바일 키보드 대응 함수 (HTML 수정 필요 없음!)
// 이 함수가 자동으로 모든 입력창을 찾아서 감시합니다.
// ====================================================================
function attachMobileKeyboardFix() {
    // 1. 입력창 3개를 다 찾습니다.
    const inputs = [
        document.getElementById('qe-input-1'),
        document.getElementById('qe-input-2'),
        document.getElementById('qe-input-3')
    ];
    
    const modalWrapper = document.getElementById('quick-entry-modal');

    inputs.forEach(input => {
        if(!input) return;

        // 2. 터치(focus) 했을 때 -> 강제로 위로 붙이기 (스타일 직접 변경)
        input.addEventListener('focus', () => {
            if (window.innerWidth <= 768) {
                // Flex 정렬을 '위쪽(start)'으로 강제 변경
                modalWrapper.style.alignItems = 'flex-start';
                // 위쪽 여백을 줘서 너무 딱 붙지는 않게 함
                modalWrapper.style.paddingTop = '60px'; 
            }
        });

        // 3. 터치 해제(blur) 했을 때 -> 다시 중앙 정렬 복귀
        input.addEventListener('blur', () => {
            if (window.innerWidth <= 768) {
                // 스타일을 비워서 원래 CSS(중앙 정렬)로 돌아가게 함
                modalWrapper.style.alignItems = '';
                modalWrapper.style.paddingTop = '';
            }
        });
    });
}
