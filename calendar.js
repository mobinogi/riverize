/**
 * calendar.js
 * - 달력 렌더링, 월 이동, 데이터 조회
 * - 일보 생성, 삭제, 월별 요약표 생성
 * - [NEW] 달력 편집 모드 (공휴일/기념일 설정)
 * - [Mock] 테스트 환경 지원
 */

// === 1. 테스트 환경 감지 (Mock Server) ===
if (typeof google === 'undefined' || typeof google.script === 'undefined') {
    console.warn("⚠️ 테스트 환경 감지됨: 가짜 서버(Mock)를 사용합니다.");
    window.google = {
        script: {
            run: {
                withSuccessHandler: function(callback) {
                    return {
                        loadCalendarConfig: function() { callback(localStorage.getItem('MOCK_CONFIG') || "{}"); },
                        saveCalendarConfig: function(json) { localStorage.setItem('MOCK_CONFIG', json); },
                        getReportFilesByMonth: function(y, m) { callback({}); }, // 빈 데이터
                        deleteReportFile: function() { callback({status:'success'}); }
                    };
                }
            }
        }
    };
}

// === 2. 전역 변수 ===
let reportsMap = {};
let currentYear, currentMonth;
let selectedDateForGeneration = null; // 일보 생성 모달용 날짜 기억
let reportPressTimer;      // 롱프레스 타이머
let isLongPressed = false; // 롱프레스 감지 플래그
let holidayConfig = {};    // [NEW] 꾸미기 데이터
let isEditMode = false;    // [NEW] 편집 모드
let editingDateKey = "";   // [NEW] 편집 중인 날짜

// === 3. 초기화 (index.html 로드 시 실행) ===
function initCalendar() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth() + 1;

    // 1) 서버에서 설정 불러오기
    google.script.run.withSuccessHandler(function(data) {
        try { holidayConfig = JSON.parse(data); } catch(e) { holidayConfig = {}; }
        // 설정 로드 후 데이터 조회 시작
        fetchReportsForMonth(currentYear, currentMonth, true);
    }).loadCalendarConfig();

    // 2) 편집 모드 토글 버튼 감지
    const toggleBtn = document.getElementById('edit-mode-toggle');
    if(toggleBtn) {
        toggleBtn.addEventListener('change', function(e) {
            isEditMode = e.target.checked;
            const calendarDiv = document.getElementById('calendar-days');
            if(isEditMode) {
                calendarDiv.classList.add('editing-mode');
                showToast("🛠 편집 모드 ON: 날짜를 클릭해 꾸며보세요!", "success");
            } else {
                calendarDiv.classList.remove('editing-mode');
                showToast("편집 모드 OFF", "success");
            }
            renderCalendar();
        });
    }
}

// === 4. 데이터 조회 및 달력 이동 ===
function changeMonth(delta) {
    const date = new Date(currentYear, currentMonth - 1 + delta, 1);
    currentYear = date.getFullYear();
    currentMonth = date.getMonth() + 1;
    fetchReportsForMonth(currentYear, currentMonth);
}

// 기존 함수명(fetchReportsForMonth) 유지하여 호환성 확보
async function fetchReportsForMonth(year, month, isInitial = false) {
    const key = year + '-' + month;
    const localLoader = document.getElementById('calendar-loader');
    
    // 이미 로딩된 데이터면 렌더링만 하고 종료
    if (reportsMap[key] === 'completed') { 
        renderCalendar(); 
        return; 
    }

    if (localLoader) localLoader.classList.remove('hidden');

    try {
        const result = await callAppsScript('getReportFilesByMonth', { year, month });
        if (Array.isArray(result)) { 
            result.forEach(r => reportsMap[r.date] = r); 
            reportsMap[key] = 'completed'; 
        }
    } catch(e) {
        console.error("달력 데이터 로드 실패", e);
    } finally { 
        if (localLoader) localLoader.classList.add('hidden');
        renderCalendar(); 
        const statusEl = document.getElementById('review-status');
        if(statusEl) statusEl.textContent = '상태: 월별 보고서 정보 로딩 완료.';
    }
}

function reloadCurrentMonth() {
    // 캐시 삭제 후 새로고침
    const key = currentYear + '-' + currentMonth;
    delete reportsMap[key];
    
    // 해당 월의 개별 날짜 데이터도 삭제
    const prefix = currentYear + '-' + String(currentMonth).padStart(2, '0');
    Object.keys(reportsMap).forEach(k => {
        if (k.startsWith(prefix)) delete reportsMap[k];
    });

    showToast(`${currentMonth}월 데이터를 갱신합니다.`, 'success');
    fetchReportsForMonth(currentYear, currentMonth);
}

// === 5. 달력 그리기 (핵심) ===
function renderCalendar() {
    const container = document.getElementById('calendar-days');
    if (!container) return;
    container.innerHTML = '';

    document.getElementById('current-month-display').textContent = currentYear + '년 ' + currentMonth + '월';
    const summaryBtn = document.getElementById('summary-button-text');
    if(summaryBtn) summaryBtn.textContent = currentMonth + '월 매출현황표 생성';

    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    // 빈 칸 채우기
    for (let i = 0; i < firstDay; i++) container.innerHTML += '<div class="p-2"></div>';

    // 날짜 채우기
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = currentYear + '-' + String(currentMonth).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const isSunday = new Date(currentYear, currentMonth - 1, day).getDay() === 0;
        
        const hasReport = reportsMap[dateKey];
        const config = holidayConfig[dateKey] || {}; // 꾸미기 설정
        
        const label = config.label || "";
        const colorType = config.color || (isSunday ? 'red' : 'black');
        
        // 텍스트 색상
        let textClass = "text-gray-700";
        if (colorType === 'red') textClass = "text-red-500";
        else if (colorType === 'blue') textClass = "text-blue-500";

        let cls = `date-box ${textClass} ${hasReport ? 'report-exists' : 'no-report'}`;
        if(isSunday) cls += ' sunday-date';

        // 클릭 이벤트
        let clickAction = "";
        
        if (isEditMode) {
            // [편집 모드] 설정창 열기
            clickAction = `onclick="openHolidayModal('${dateKey}', '${label}', '${colorType}')"`;
        } else {
            // [일반 모드]
            if (hasReport) {
                const rId = hasReport.id;
                const rUrl = hasReport.url;
                const dateStr = `${currentYear}년 ${currentMonth}월 ${day}일`;
                clickAction = `
                    onclick="handleReportClick('${rUrl}')"
                    onmousedown="startPressReport(this, '${rId}', '${rUrl}', '${dateStr}')" 
                    onmouseup="endPressReport()"
                    onmouseleave="endPressReport()"
                    ontouchstart="startPressReport(this, '${rId}', '${rUrl}', '${dateStr}')"
                    ontouchend="endPressReport()"
                `;
            } else if (!isSunday) {
                // 일요일 아님 -> 작성 모달 띄우기
                clickAction = `onclick="onDateClick(${day})"`;
            }
        }

        // 내용물
        let content = `<span style="z-index:1;">${day}</span>`;
        if (label) {
            const badgeCls = colorType === 'blue' ? 'holiday-badge blue' : 'holiday-badge';
            content += `<span class="${badgeCls}">${label}</span>`;
        }

        container.innerHTML += `
            <div class="p-2 flex justify-center">
                <div class="${cls}" ${clickAction}>
                    ${content}
                </div>
            </div>
        `;
    }
}

// === 6. 일보 생성 및 요약표 기능 (index.html에서 이사옴) ===

async function generateTodayReport() {
    const newWindow = getMobileOS() === "Other" ? window.open('', '_blank') : null;
    showLoader('새 일일 보고서 배송 중...', true);

    try {
        const result = await callAppsScript('generate'); 
        if (result.status === 'success' && result.url) {
            openSheetApp(result.url, newWindow); 
            reloadCurrentMonth();
        } else { 
          if(newWindow) newWindow.close(); alert('실패: ' + result.message); 
        }
    } catch (e) { 
        if(newWindow) newWindow.close(); alert('오류: ' + e.message); 
    } finally { hideLoader(); }
}

async function createMonthlySummary() {
    showLoader(currentMonth + '월 매출현황 보고서를 배달중...', true);
    try {
        const result = await callAppsScript('createSummary', {
          year: currentYear,
          month: currentMonth
        });
        if (result.status === 'success' && result.url) {
          hideLoader();
          openSheetApp(result.url);
        } else {
          hideLoader();
          alert('실패: ' + (result.message || '알 수 없는 오류'));
        }
    } catch (error) {
        hideLoader();
        alert('오류: ' + error.message);
    }
}

function onDateClick(day) {
    const formattedDate = currentYear + '-' + String(currentMonth).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    selectedDateForGeneration = formattedDate; // 전역 변수에 저장
    
    const dateStr = currentYear + '년 ' + currentMonth + '월 ' + day + '일';
    document.getElementById('modal-message').innerHTML = '<b>' + dateStr + '</b> 일자의 보고서가 없습니다.<br>새로 작성하시겠습니까?';
    openModal(); // index.html에 있는 모달 열기 함수 호출
}

async function confirmGenerateReport() {
    if (!selectedDateForGeneration) { closeModal(); return; }
    const newWindow = getMobileOS() === "Other" ? window.open('', '_blank') : null;
    const [year, month, day] = selectedDateForGeneration.split('-').map(Number);
    
    closeModal(); 
    showLoader('보고서 생성 중...');
    
    try {
        const result = await callAppsScript('generateByDate', { year, month, day, shouldPropagate: true });
        if (result.status === 'success') {
            if (result.newReport) reportsMap[result.newReport.date] = result.newReport;
            renderCalendar();
            openSheetApp(result.url, newWindow);
        } else { if(newWindow) newWindow.close(); alert('실패'); }
    } catch (e) { if(newWindow) newWindow.close(); alert('오류'); } finally { hideLoader(); }
}

// === 7. 인터랙션 (클릭/롱프레스/옵션모달) ===

function startPressReport(el, id, url, dateStr) {
    clearTimeout(reportPressTimer);
    isLongPressed = false;
    el.style.transform = "scale(0.9)"; 
    reportPressTimer = setTimeout(() => {
        isLongPressed = true; 
        if (navigator.vibrate) navigator.vibrate(50); 
        openReportOptionModal(id, url, dateStr);
        el.style.transform = "";
    }, 800);
}

function endPressReport() {
    clearTimeout(reportPressTimer);
    const activeEls = document.querySelectorAll('.date-box');
    activeEls.forEach(el => { el.style.transform = ""; });
}

function handleReportClick(url) {
    if (isLongPressed) { isLongPressed = false; return; }
    openSheetApp(url); 
}

function openReportOptionModal(id, url, dateStr) {
    // 바텀 시트 열기 로직
    document.getElementById('option-date-title').textContent = dateStr;
    document.getElementById('btn-open-report').onclick = function() {
        openSheetApp(url);
        closeReportOptionModal();
    };
    document.getElementById('btn-delete-report').onclick = function() {
        if (confirm("정말 삭제하시겠습니까? (휴지통으로 이동)")) {
            deleteReportAction(id, dateStr);
        }
    };
    
    const modal = document.getElementById('report-option-modal');
    const sheet = document.getElementById('ro-sheet');
    const backdrop = document.getElementById('ro-backdrop');
    
    sheet.classList.add('shadow-[0_-4px_20px_rgba(0,0,0,0.2)]');
    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.remove('opacity-0');
        sheet.classList.remove('translate-y-full');
    }, 10);
}

function closeReportOptionModal() {
    const sheet = document.getElementById('ro-sheet');
    const backdrop = document.getElementById('ro-backdrop');
    const modal = document.getElementById('report-option-modal');

    sheet.classList.remove('shadow-[0_-4px_20px_rgba(0,0,0,0.2)]');
    backdrop.classList.add('opacity-0');
    sheet.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

async function deleteReportAction(fileId, dateStr) {
    showLoader(`"${dateStr}" 보고서 삭제 중...`);
    closeReportOptionModal(); 
    
    try {
        const result = await callAppsScript('deleteReportFile', { fileId: fileId });
        if (result.status === 'success') {
            showToast("보고서가 삭제되었습니다.", "success");
            reloadCurrentMonth(); 
        } else {
            showToast("삭제 실패: " + result.message, "error");
        }
    } catch (e) {
        showToast("서버 오류: " + e.message, "error");
    } finally {
        hideLoader();
    }
}

// === 8. [NEW] 편집 모드 관련 함수 ===

function openHolidayModal(dateKey, label, color) {
    editingDateKey = dateKey;
    document.getElementById('modal-date-display').textContent = dateKey;
    document.getElementById('holiday-label').value = label;
    selectColor(color);
    document.getElementById('holiday-modal').classList.remove('hidden');
}

function closeHolidayModal() {
    document.getElementById('holiday-modal').classList.add('hidden');
}

function selectColor(color) {
    ['red', 'blue', 'black'].forEach(c => {
        const btn = document.getElementById('btn-' + c);
        if(btn) {
            btn.classList.remove('ring-2', 'ring-offset-1', 'ring-red-500', 'ring-blue-500', 'ring-gray-500');
            if (c === color) {
                btn.classList.add('ring-2', 'ring-offset-1');
                if(c==='red') btn.classList.add('ring-red-500');
                if(c==='blue') btn.classList.add('ring-blue-500');
                if(c==='black') btn.classList.add('ring-gray-500');
            }
        }
    });
    document.getElementById('selected-color').value = color;
}

function saveHolidaySetting() {
    const label = document.getElementById('holiday-label').value.trim();
    const color = document.getElementById('selected-color').value;

    if (!label && color === 'black') {
        delete holidayConfig[editingDateKey];
    } else {
        holidayConfig[editingDateKey] = { label, color };
    }

    renderCalendar();
    closeHolidayModal();
    google.script.run.saveCalendarConfig(JSON.stringify(holidayConfig));
}

// === [calendar.js 맨 아래에 추가하세요] ===

/**
 * 🛠️ 호환성 연결 다리
 * 기존의 callAppsScript(fetch 방식) 호출을 
 * google.script.run(구글 앱스 스크립트 방식)으로 연결해줍니다.
 * 이렇게 하면 테스트 페이지(Mock)에서도 작동하고, 실제 앱에서도 작동합니다.
 */
function callAppsScript(functionName, params) {
    return new Promise((resolve, reject) => {
        // 구글 서버(또는 Mock)에 요청
        if (google.script.run[functionName]) {
            google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                [functionName](params); // 함수 이름으로 동적 호출
        } else {
            console.error(`[오류] '${functionName}' 함수를 찾을 수 없습니다.`);
            // 혹시 함수 이름이 다를 경우를 대비한 예외처리 (필요 시 수정)
            if(functionName === 'createSummary') {
                 google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).createSummary(params);
            } else {
                reject("Function not found: " + functionName);
            }
        }
    });
}
