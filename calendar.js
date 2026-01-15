/**
 * calendar.js
 * - 디자인: 사장님 원본 (date-box, report-exists 클래스 사용) 100% 유지
 * - 로딩: calendar-loader 복구
 * - 기능: 다중선택, 롱프레스, 띠지 중앙 정렬
 */

// 1. [설정] API 주소
const CALENDAR_API_URL = "https://script.google.com/macros/s/AKfycby5URDVswhQPo4sJwe2VQZxWRpDGv5F76AgHGA_AoXknJHUjVjgIbNmFT_qrQ8yDZ-2/exec";

// 2. [통신]
async function callCalendarApi(action, params = {}) {
    const url = new URL(CALENDAR_API_URL);
    url.searchParams.set('action', action);
    for (const key in params) url.searchParams.set(key, params[key]);
    try {
        const response = await fetch(url.toString());
        return await response.json();
    } catch (e) {
        console.error("통신 실패:", e);
        return { status: 'error', message: e.message };
    }
}

// 3. [브릿지]
if (typeof google === 'undefined' || typeof google.script === 'undefined') {
    window.google = {
        script: {
            run: {
                withSuccessHandler: function(cb) {
                    return {
                        withFailureHandler: function() { return this; },
                        loadCalendarConfig: function() { callCalendarApi('loadCalendarConfig').then(cb); },
                        saveCalendarConfig: function(json) { callCalendarApi('saveCalendarConfig', {json: json}).then(cb); },
                        getReportFilesByMonth: function(y, m) { callCalendarApi('getReportFilesByMonth', {year: y, month: m}).then(cb); },
                        deleteReportFile: function(fid) { callCalendarApi('deleteReportFile', {fileId: fid}).then(cb); }
                    };
                }
            }
        }
    };
}

// ==========================================
// 4. 전역 변수
// ==========================================
let reportsMap = {};       
let holidayConfig = {};    
let currentYear, currentMonth;
let isEditMode = false;    
let selectedDates = []; 
let longPressTimer; 

// ==========================================
// 5. 초기화
// ==========================================
function initCalendar() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth() + 1;

    // 설정 로드
    google.script.run.withSuccessHandler(function(data) {
        try { holidayConfig = JSON.parse(data); } catch(e) { holidayConfig = {}; }
        // 설정 로드 후 리포트 로드
        fetchReportsForMonth(currentYear, currentMonth, true);
    }).loadCalendarConfig();

    // 편집 모드 토글
    const toggleBtn = document.getElementById('edit-mode-toggle');
    if(toggleBtn) {
        toggleBtn.addEventListener('change', function(e) {
            isEditMode = e.target.checked;
            selectedDates = []; 
            const container = document.getElementById('calendar-days');
            if(isEditMode) {
                container.classList.add('editing-mode');
                showToast("🛠️ 편집 모드: 날짜를 선택하고, 마지막 날짜를 꾹 누르세요.");
            } else {
                container.classList.remove('editing-mode');
            }
            renderCalendar();
        });
    }
}

function changeMonth(offset) {
    currentMonth += offset;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    else if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    selectedDates = [];
    fetchReportsForMonth(currentYear, currentMonth);
}

// [복구] 사장님 원래 함수명 & 로딩 로직 그대로 복원
function fetchReportsForMonth(year, month, isInitial = false) {
    const key = year + '-' + month;
    
    // 로컬 로딩바 켜기 (사장님 코드 복구)
    const localLoader = document.getElementById('calendar-loader');
    if (localLoader) localLoader.classList.remove('hidden');

    google.script.run.withSuccessHandler(function(data) {
        if (Array.isArray(data)) {
            data.forEach(r => reportsMap[r.date] = r);
        } else {
            reportsMap = Object.assign(reportsMap, data || {});
        }
        
        // 로딩바 끄기
        if (localLoader) localLoader.classList.add('hidden');
        renderCalendar();
        
        const statusEl = document.getElementById('review-status');
        if(statusEl) statusEl.textContent = '상태: 월별 보고서 정보 로딩 완료.';
        
    }).getReportFilesByMonth(year, month);
}

// ==========================================
// 6. 렌더링 (★디자인 100% 원복 + 띠지 추가)
// ==========================================
function renderCalendar() {
    const container = document.getElementById('calendar-days');
    if (!container) return;
    container.innerHTML = '';

    document.getElementById('current-month-display').textContent = `${currentYear}년 ${currentMonth}월`;
    const summaryBtn = document.getElementById('summary-button-text');
    if(summaryBtn) summaryBtn.textContent = `${currentMonth}월 매출현황표 생성`;

    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    // 빈 칸
    for (let i = 0; i < firstDay; i++) container.innerHTML += '<div class="p-2"></div>';

    // 날짜 루프
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isSunday = new Date(currentYear, currentMonth - 1, day).getDay() === 0;
        
        const hasReport = reportsMap[dateKey];
        const config = holidayConfig[dateKey] || {};
        const label = config.label || "";
        const colorType = config.color || (isSunday ? 'red' : 'black');

        // ★ [핵심] 사장님 원래 디자인 클래스 복구 (date-box, report-exists 등)
        // 초록 동그라미가 나오려면 'report-exists' 클래스가 있어야 함
        let cls = 'date-box ' + (isSunday ? 'sunday-date' : (hasReport ? 'report-exists' : 'no-report'));

        // 숫자 색상 오버라이드 (휴일 등)
        let numStyle = "";
        if (colorType === 'red') numStyle = "color: #ef4444 !important;";
        else if (colorType === 'blue') numStyle = "color: #3b82f6 !important;";
        
        // --- [띠지 & 텍스트 중앙 정렬] ---
        let barHtml = "";
        if (label) {
            let prevCount = 0, nextCount = 0;
            // 앞뒤 연결 확인
            for(let p = day - 1; p >= 1; p--) {
                const pKey = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(p).padStart(2,'0')}`;
                if(holidayConfig[pKey]?.label === label) prevCount++; else break;
            }
            for(let n = day + 1; n <= daysInMonth; n++) {
                const nKey = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(n).padStart(2,'0')}`;
                if(holidayConfig[nKey]?.label === label) nextCount++; else break;
            }

            const totalLen = prevCount + 1 + nextCount;
            const myPosition = prevCount; 
            const centerIndex = Math.floor((totalLen - 1) / 2);
            const isCenter = (myPosition === centerIndex);
            
            const isPrevSame = (prevCount > 0);
            const isNextSame = (nextCount > 0);

            let bgClass = colorType === 'red' ? 'bg-red-100 text-red-600' : (colorType === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-700');
            let barStyleClass = "";
            if (!isPrevSame && isNextSame) barStyleClass = "rounded-l-md ml-1"; 
            else if (isPrevSame && isNextSame) barStyleClass = ""; 
            else if (isPrevSame && !isNextSame) barStyleClass = "rounded-r-md mr-1"; 
            else barStyleClass = "rounded-md mx-1"; 

            // 띠지를 아주 얇고 작게 넣어서 원래 레이아웃을 해치지 않게 함
            barHtml = `<div class="absolute -bottom-1 left-0 right-0 h-3 flex items-center justify-center overflow-visible whitespace-nowrap ${bgClass} ${barStyleClass}" style="z-index: 0;">
                <span class="${isCenter ? 'opacity-100' : 'opacity-0'} text-[9px] font-bold" style="z-index: 10;">${label}</span>
            </div>`;
        }

        // 편집 모드 선택 효과 (테두리만)
        let selectionClass = "";
        if (isEditMode && selectedDates.includes(dateKey)) {
            selectionClass = "ring-2 ring-green-500 rounded-lg";
        }
        
        // ★ [HTML 조립] 사장님 원본 구조(p-2 flex justify-center) 유지!
        // 그 안에 date-box(동그라미)를 넣고, 띠지만 살짝 끼워넣음.
        container.innerHTML += `
            <div class="p-2 flex flex-col items-center justify-start relative h-16 cursor-pointer ${selectionClass}"
                 ontouchstart="handleTouchStart('${dateKey}', ${day}, ${isSunday})"
                 ontouchend="handleTouchEnd()"
                 onmousedown="handleMouseDown('${dateKey}', ${day}, ${isSunday})"
                 onmouseup="handleMouseUp()"
                 onclick="handleClick('${dateKey}', ${day}, ${isSunday})">
                 
                <div class="${cls}" style="${numStyle} z-index: 2;">
                    ${day}
                </div>
                
                ${barHtml}
            </div>
        `;
    }
}

// ==========================================
// 7. 이벤트 핸들러 (편집 vs 일반 분기)
// ==========================================
function handleTouchStart(dateKey, day, isSunday) { startPress(dateKey, day, isSunday); }
function handleMouseDown(dateKey, day, isSunday) { startPress(dateKey, day, isSunday); }

function startPress(dateKey, day, isSunday) {
    isLongPress = false;
    longPressTimer = setTimeout(() => {
        isLongPress = true;
        onLongPress(dateKey, day, isSunday);
    }, 600);
}

function handleTouchEnd() { clearTimeout(longPressTimer); }
function handleMouseUp() { clearTimeout(longPressTimer); }

function handleClick(dateKey, day, isSunday) {
    if (isLongPress) return;

    if (isEditMode) {
        // [편집모드] 선택/해제
        if (selectedDates.includes(dateKey)) selectedDates = selectedDates.filter(d => d !== dateKey);
        else selectedDates.push(dateKey);
        renderCalendar();
    } else {
        // [일반모드] 원래 기능 (일보 열기 or 모달)
        const hasReport = reportsMap[dateKey];
        if (hasReport) {
            // 보고서 열기
             if(typeof openSheetApp === 'function') openSheetApp(hasReport.url);
             else window.open(hasReport.url, '_blank');
        } else {
            // 없는 날짜 -> 작성 모달 (tests.html에 있는 onDateClick 호출)
            if(typeof onDateClick === 'function') onDateClick(day, isSunday);
        }
    }
}

function onLongPress(dateKey, day, isSunday) {
    if (navigator.vibrate) navigator.vibrate(50);

    if (isEditMode) {
        // [편집모드] 
        if (!selectedDates.includes(dateKey)) {
            selectedDates.push(dateKey);
            renderCalendar();
        }
        if (!checkConsecutive(selectedDates)) {
            showToast("❌ 떨어진 날짜는 같이 설정할 수 없습니다!", "error");
            return;
        }
        openHolidayModalMulti();
    } else {
        // [일반모드] 삭제/옵션 팝업 (tests.html 함수 호출)
        const hasReport = reportsMap[dateKey];
        if (hasReport && typeof openReportOptionModal === 'function') {
             openReportOptionModal(hasReport.fileId, hasReport.url, `${currentYear}년 ${currentMonth}월 ${day}일`);
        }
    }
}

function checkConsecutive(dates) {
    if (dates.length <= 1) return true;
    const sorted = dates.slice().sort();
    for (let i = 0; i < sorted.length - 1; i++) {
        const curr = new Date(sorted[i]);
        const next = new Date(sorted[i+1]);
        const diffTime = Math.abs(next - curr);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays > 1) return false;
    }
    return true;
}

// ==========================================
// 8. 설정 모달 로직
// ==========================================
function openHolidayModalMulti() {
    selectedDates.sort();
    let title = "";
    if (selectedDates.length === 1) title = selectedDates[0];
    else title = `${selectedDates[0]} ~ ${selectedDates[selectedDates.length-1]} (${selectedDates.length}일)`;
    
    document.getElementById('modal-date-display').textContent = title;
    
    const firstKey = selectedDates[0];
    const config = holidayConfig[firstKey] || {};
    document.getElementById('holiday-label').value = config.label || "";
    // tests.html에 있는 selectColor 함수 활용
    if(typeof selectColor === 'function') selectColor(config.color || 'red');

    document.getElementById('holiday-modal').classList.remove('hidden');
}

function saveHolidaySetting() {
    const label = document.getElementById('holiday-label').value;
    const color = document.getElementById('selected-color').value || 'red';

    selectedDates.forEach(key => {
        if (!label) delete holidayConfig[key];
        else holidayConfig[key] = { label, color };
    });

    renderCalendar();
    
    document.getElementById('holiday-modal').classList.add('hidden');
    selectedDates = []; 

    showToast("저장 중...");
    google.script.run.withSuccessHandler(function() {
        showToast("저장되었습니다.", "success");
    }).saveCalendarConfig(JSON.stringify(holidayConfig));
}
