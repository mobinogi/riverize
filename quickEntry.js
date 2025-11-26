// ===============================================
// ⚡ 간편 일보 작성 (quickEntry.js) - 토스트 + 결과창
// ===============================================

// 1. 모달 열기
function openQuickEntryModal() {
    // 항상 입력 폼부터 보여주기 (결과창 숨김)
    document.getElementById('qe-form-content').classList.remove('hidden');
    document.getElementById('qe-result-content').classList.add('hidden');

    // 값 초기화
    document.getElementById('qe-manager').value = '';
    document.getElementById('qe-input-1').value = '';
    document.getElementById('qe-input-2').value = '';
    document.getElementById('qe-input-3').value = '';
    
    // 버튼 스타일 초기화
    const baseClass = "flex-1 py-3 rounded-xl border border-white/30 bg-white/5 text-gray-200 font-bold hover:bg-white/20 transition-all";
    document.getElementById('qe-btn-kim').className = baseClass;
    document.getElementById('qe-btn-jung').className = baseClass;

    // 모달 보이기
    document.getElementById('quick-entry-modal').classList.remove('hidden');

    // 백그라운드 생성
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

    // 버튼 로딩 상태
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
            // ✅ 1. 상단 알약 메시지 띄우기 (서버 메시지 사용)
            showToast(result.message, "success");

            // ✅ 2. 모달 닫지 말고 결과 화면으로 전환!
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

// [신규] 결과 화면 보여주기 함수
function showResultScreen(data) {
    // 폼 숨기고 결과창 보이기
    document.getElementById('qe-form-content').classList.add('hidden');
    document.getElementById('qe-result-content').classList.remove('hidden');

    // 데이터 채워넣기
    // (Code.js에서 inputs 객체에 v1, v2, v3를 담아 보내줘야 함. 만약 안 보냈으면 e.parameter 값 사용)
    const inputs = data.inputs || { v1: 0, v2: 0, v3: 0 };
    
    document.getElementById('res-manager').textContent = data.manager || document.getElementById('qe-manager').value;
    document.getElementById('res-val1').textContent = inputs.v1;
    document.getElementById('res-val2').textContent = inputs.v2;
    document.getElementById('res-val3').textContent = inputs.v3;
    
    // 최종 재고 라벨 및 값
    const balanceLabel = (data.manager === '김원대') ? '최종 재고 (F8)' : '최종 재고 (F22)';
    document.getElementById('res-balance-label').textContent = balanceLabel;
    document.getElementById('res-balance').textContent = data.finalBalance;
}
// ===============================================
// 📱 [모바일 전용] 키보드 올라올 때 창 위로 밀기
// ===============================================
function liftModal(up) {
    const modalBody = document.getElementById('qe-card-body');
    if (!modalBody) return;

    // 모바일인지 확인
    if (window.innerWidth <= 768) {
        if (up) {
            // 🚨 [수정] 기존 -120px -> -220px로 변경!
            // 창을 화면 천장 가까이 바짝 들어 올려서, 
            // 아래쪽 키보드 공간을 최대한 확보합니다.
            modalBody.style.transform = "translateY(-220px)";
        } else {
            // 원위치 복귀
            modalBody.style.transform = "translateY(0)";
        }
    }
}
