// ===============================================
// ⚡ 간편 일보 작성 기능 (quickEntry.js)
// ===============================================

// 1. 모달 열기 (+ 백그라운드 파일 생성 요청)
function openQuickEntryModal() {
    // 화면 초기화
    document.getElementById('qe-manager').value = '';
    document.getElementById('qe-input-1').value = '';
    document.getElementById('qe-input-2').value = '';
    document.getElementById('qe-input-3').value = '';
    
    // 버튼 스타일 초기화
    document.getElementById('qe-btn-kim').className = "flex-1 py-3 rounded-xl border border-white/30 bg-white/5 text-gray-200 font-bold hover:bg-white/20 transition-all";
    document.getElementById('qe-btn-jung').className = "flex-1 py-3 rounded-xl border border-white/30 bg-white/5 text-gray-200 font-bold hover:bg-white/20 transition-all";

    // 모달 띄우기
    document.getElementById('quick-entry-modal').classList.remove('hidden');

    // [핵심] 백그라운드에서 조용히 생성 요청 (기다리지 않음)
    if (typeof callAppsScript === 'function') {
        callAppsScript('generate').catch(e => console.log("백그라운드 생성 중 에러(무시 가능):", e));
    }
}

// [누락된 기능] 닫기 버튼(X) 기능
function closeQuickEntryModal() {
    const modal = document.getElementById('quick-entry-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 3. 담당자 선택 (버튼 스타일 변경)
function selectQuickManager(name) {
    const btnKim = document.getElementById('qe-btn-kim');
    const btnJung = document.getElementById('qe-btn-jung');
    const hiddenInput = document.getElementById('qe-manager');

    hiddenInput.value = name;

    // 선택된 스타일 (초록 그라데이션) vs 비활성 스타일
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

// 4. 데이터 저장 (전송)
async function submitQuickDailyReport() {
    const manager = document.getElementById('qe-manager').value;
    const val1 = document.getElementById('qe-input-1').value; // 생탁
    const val2 = document.getElementById('qe-input-2').value; // 국산쌀
    const val3 = document.getElementById('qe-input-3').value; // 미출고

    // 유효성 검사
    if (!manager) { 
        if(typeof showToast === 'function') showToast("담당자를 먼저 선택해주세요!", "error");
        else alert("담당자를 선택해주세요!");
        return; 
    }
    if (val1 === '' && val2 === '' && val3 === '') { 
        if(typeof showToast === 'function') showToast("수량을 하나라도 입력해주세요.", "error");
        else alert("수량을 입력해주세요.");
        return; 
    }

    // 로딩 시작
    closeQuickEntryModal();
    if(typeof showLoader === 'function') showLoader("일보 생성 및 데이터 저장 중...");

    try {
        // 메인 스크립트에 있는 통신 함수 호출
        const result = await callAppsScript('writeDailyLog', {
            manager: manager,
            val1: val1 || 0,
            val2: val2 || 0,
            val3: val3 || 0
        });

        if (result.status === 'success') {
            if(typeof showToast === 'function') showToast("✅ 저장 완료! (자동 계산됨)", "success");
            else alert("저장 완료!");
        } else {
            if(typeof showToast === 'function') showToast("저장 실패: " + result.message, "error");
            else alert("저장 실패: " + result.message);
        }
    } catch (e) {
        if(typeof showToast === 'function') showToast("오류 발생: " + e.message, "error");
        else alert("오류: " + e.message);
    } finally {
        if(typeof hideLoader === 'function') hideLoader();
    }

}
