// ===============================================
// ⚡ 간편 일보 작성 (quickEntry.js)
// ===============================================

// ── [추가] 오늘 기록 조회 → '수정' 모드 판별 ──
//  담당자 탭을 누를 때마다 파이어베이스에서 '그 순간의 최신 값'을 새로 읽어옵니다.
//  (캐시가 아니라 서버에서 직접 — 다른 사람이 방금 저장했을 수도 있으므로)
let qeTodayData = null;
let qeFetchSeq = 0;   // 탭을 빠르게 번갈아 눌렀을 때 늦게 온 응답이 덮어쓰는 것 방지

async function qeFetchTodayRecord() {
    if (!window.db) return null;
    const m = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const t = new Date();
    const dateStr = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, '0') + "-" + String(t.getDate()).padStart(2, '0');
    const ref = m.doc(window.db, "daily_sales", dateStr);

    let snap;
    try {
        // 무조건 서버에서 최신값을 읽습니다.
        snap = await m.getDocFromServer(ref);
    } catch (e) {
        // 오프라인 등으로 서버 조회가 안 되면 일반 조회로 대체
        console.log("서버 조회 실패 → 일반 조회로 대체:", e);
        snap = await m.getDoc(ref);
    }
    return snap.exists() ? snap.data() : null;
}

// 담당자를 고를 때마다 호출됩니다.
async function qeRefreshForManager(manager) {
    if (!manager) { qeTodayData = null; qeApplyEditMode(''); return; }

    const seq = ++qeFetchSeq;
    qeSetChecking(true);
    try {
        const data = await qeFetchTodayRecord();
        if (seq !== qeFetchSeq) return;   // 그 사이 다른 탭을 눌렀으면 이 응답은 버림
        qeTodayData = data;
    } catch (e) {
        if (seq !== qeFetchSeq) return;
        qeTodayData = null;
        console.log("오늘 기록 조회 실패(작성 모드로 진행):", e);
    }
    qeSetChecking(false);
    qeApplyEditMode(manager);
}

// 조회 중 표시
function qeSetChecking(on) {
    const titleText = document.getElementById('qe-title-text');
    const btn = document.getElementById('qe-submit-btn');
    if (on) {
        if (titleText) titleText.textContent = '오늘 기록 확인 중...';
        if (btn) btn.disabled = true;
    } else {
        if (btn) btn.disabled = false;
    }
}

// 오늘 그 담당자의 기록이 있으면 '수정' 모드로 바꿉니다.
function qeApplyEditMode(manager) {
    const titleText = document.getElementById('qe-title-text');
    const titleIcon = document.getElementById('qe-title-icon');
    const hint = document.getElementById('qe-edit-hint');
    const btn = document.getElementById('qe-submit-btn');

    const key = (manager === '김원대') ? 'kim' : (manager === '정병준') ? 'jung' : null;
    const rec = (key && qeTodayData) ? qeTodayData[key] : null;
    const isEdit = !!(rec && rec.time && rec.time !== '자동이월');

    if (isEdit) {
        if (titleIcon) titleIcon.textContent = '✏️';
        if (titleText) titleText.textContent = '일보 수정';
        if (btn) btn.innerHTML = '수정 완료';
        if (hint) {
            hint.textContent = `오늘 ${rec.time}에 작성하신 기록이 있습니다.`;
            hint.classList.remove('hidden');
        }
        // 입력칸 왼쪽에 이전 값을 띄우고, 입력칸은 절반으로 줄임
        qeSetPrev(1, rec.st);
        qeSetPrev(2, rec.rice);
        qeSetPrev(3, rec.empty);
    } else {
        if (titleIcon) titleIcon.textContent = '🔥';
        if (titleText) titleText.textContent = '간편 일보 작성';
        if (btn) btn.innerHTML = '입력 완료';
        if (hint) hint.classList.add('hidden');
        qeSetPrev(1, null);
        qeSetPrev(2, null);
        qeSetPrev(3, null);
    }
}

// 이전 값 칸 표시/숨김. value가 null이면 숨기고 입력칸이 다시 전체 폭을 차지합니다.
function qeSetPrev(n, value) {
    const box = document.getElementById('qe-prev-' + n);
    const val = document.getElementById('qe-prev-' + n + '-val');
    if (!box || !val) return;
    if (value === null || value === undefined) {
        box.classList.add('hidden');
        val.textContent = '-';
    } else {
        val.textContent = Number(value) || 0;
        box.classList.remove('hidden');
    }
}

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

    // 제목/안내를 기본(작성) 상태로 되돌림
    qeTodayData = null;
    qeFetchSeq++;              // 이전에 날아가던 조회 응답 무효화
    qeApplyEditMode('');

    // 모달 띄우기
    document.getElementById('quick-entry-modal').classList.remove('hidden');
    // 조회는 담당자를 고르는 시점에 합니다 (그때가 가장 최신이므로)

    // [동시성 수정] Pre-warming 제거.
    //  이 generate 요청이 5초 뒤의 저장 요청과 경쟁해서, 저장한 값이 지워지거나
    //  같은 날짜 일보가 2개 만들어지는 사고를 일으켰습니다. (2026-03-26, 2026-08-28)
    //  파일 생성은 writeDailyLog가 알아서 합니다.
    // if (typeof callAppsScript === 'function') {
    //     callAppsScript('generate').catch(e => console.log("Pre-warm error:", e));
    // }
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

    // [추가] 파이어베이스에서 최신값을 새로 읽어서 '수정' 모드 여부 판별
    qeRefreshForManager(name);
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


