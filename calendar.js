/**
 * calendar.js
 * - 기능: 다중 선택, 롱프레스 설정
 * - ★핵심 추가: 텍스트 중앙 정렬, 연속 날짜 유효성 검사
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

// 다중 선택용
let selectedDates = []; 
let longPressTimer; 

// ==========================================
// 5. 초기화
// ==========================================
function initCalendar() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth() + 1;

    google.script.run.withSuccessHandler(function(data) {
        try { holidayConfig = JSON.parse(data); } catch(e) { holidayConfig = {}; }
        getReportFilesByMonth(currentYear, currentMonth);
    }).loadCalendarConfig();

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
    getReportFilesByMonth(currentYear, currentMonth);
}

function getReportFilesByMonth(year, month) {
    const titleEl = document.getElementById('current-month-display');
    if(titleEl) titleEl.textContent = `${year}년 ${month}월 (로딩...)`;

    google.script.run.withSuccessHandler(function(data) {
        if (Array.isArray(data)) {
            data.forEach(r => reportsMap[r.date] = r);
        } else {
            reportsMap = Object.assign(reportsMap, data || {});
        }
        renderCalendar();
    }).getReportFilesByMonth(year, month);
}

// ==========================================
// 6. 렌더링 (★핵심: 텍스트 중앙 정렬 로직 포함)
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

        // 숫자 스타일
        let numClass = "text-gray-700 font-bold z-10 relative";
        if (colorType === 'red') numClass = "text-red-500 font-bold z-10 relative";
        else if (colorType === 'blue') numClass = "text-blue-500 font-bold z-10 relative";

        // --- [띠지 & 텍스트 중앙 정렬 로직] ---
        let barHtml = "";
        
        if (label) {
            // 1. 내 라벨과 같은 날짜가 앞/뒤로 몇 개나 이어져 있는지 계산
            let prevCount = 0;
            let nextCount = 0;

            // 뒤로 탐색 (Previous)
            for(let p = day - 1; p >= 1; p--) {
                const pKey = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(p).padStart(2,'0')}`;
                if(holidayConfig[pKey]?.label === label) prevCount++;
                else break;
            }

            // 앞으로 탐색 (Next)
            for(let n = day + 1; n <= daysInMonth; n++) {
                const nKey = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(n).padStart(2,'0')}`;
                if(holidayConfig[nKey]?.label === label) nextCount++;
                else break;
            }

            const totalLen = prevCount + 1 + nextCount; // 전체 연속된 길이
            const myPosition = prevCount; // 0부터 시작하는 나의 위치 (0이면 맨 앞)
            
            // ★ 중앙 인덱스 계산 (예: 길이 3이면 1번(가운데), 길이 2면 0번(첫째))
            const centerIndex = Math.floor((totalLen - 1) / 2);
            
            const isCenter = (myPosition === centerIndex);
            const isPrevSame = (prevCount > 0);
            const isNextSame = (nextCount > 0);

            // 색상
            let bgClass = colorType === 'red' ? 'bg-red-100 text-red-600' : (colorType === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-700');

            // 모양
            let barStyleClass = "";
            if (!isPrevSame && isNextSame) barStyleClass = "rounded-l-md ml-1"; // 시작
            else if (isPrevSame && isNextSame) barStyleClass = ""; // 중간
            else if (isPrevSame && !isNextSame) barStyleClass = "rounded-r-md mr-1"; // 끝
            else barStyleClass = "rounded-md mx-1"; // 단독

            // 내용 (중앙일 때만 텍스트 표시, 아니면 공백)
            const barContent = isCenter ? label : "";

            barHtml = `<div class="absolute bottom-1 left-0 right-0 h-5 text-[10px] flex items-center justify-center overflow-visible whitespace-nowrap ${bgClass} ${barStyleClass}">
                <span class="${isCenter ? 'opacity-100' : 'opacity-0'} font-bold" style="z-index: 20;">${label}</span>
            </div>`;
        }
        // ----------------------------------------

        // 선택 효과
        let selectionClass = "";
        if (isEditMode && selectedDates.includes(dateKey)) {
            selectionClass = "bg-green-100 ring-2 ring-green-500 rounded-lg";
        }
        
        const reportMarker = hasReport ? `<div class="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500"></div>` : "";

        container.innerHTML += `
            <div class="h-20 p-0.5 relative cursor-pointer border border-transparent hover:border-gray-200 rounded-lg ${selectionClass}"
                 ontouchstart="handleTouchStart('${dateKey}', ${day}, ${isSunday})"
                 ontouchend="handleTouchEnd()"
                 onmousedown="handleMouseDown('${dateKey}', ${day}, ${isSunday})"
                 onmouseup="handleMouseUp()"
                 onclick="handleClick('${dateKey}', ${day}, ${isSunday})">
                <div class="flex flex-col h-full justify-between pointer-events-none">
                    <span class="${numClass} ml-1 mt-1">${day}</span>
                    ${reportMarker}
                    ${barHtml} 
                </div>
            </div>
        `;
    }
}

// ==========================================
// 7. 이벤트 핸들러
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
        // [일반모드]
        const hasReport = reportsMap[dateKey];
        if (hasReport) window.open(hasReport.url, '_blank');
        else if(typeof onDateClick === 'function') onDateClick(day, isSunday);
    }
}

function onLongPress(dateKey, day, isSunday) {
    if (navigator.vibrate) navigator.vibrate(50);

    if (isEditMode) {
        // [편집모드]
        // 만약 현재 날짜가 선택된 목록에 없다면, 현재 날짜를 추가하고 시작
        if (!selectedDates.includes(dateKey)) {
            selectedDates.push(dateKey);
            renderCalendar();
        }
        
        // ★ 연속성 검사 (Smart check)
        if (!checkConsecutive(selectedDates)) {
            showToast("❌ 떨어진 날짜는 같이 설정할 수 없습니다!", "error");
            return;
        }

        openHolidayModalMulti();
    } else {
        // [일반모드] 삭제
        const hasReport = reportsMap[dateKey];
        if (hasReport) {
             if(typeof openReportOptionModal === 'function') openReportOptionModal(hasReport.fileId, dateKey);
        }
    }
}

// ★ 연속 날짜인지 확인하는 함수 (사장님 요청사항)
function checkConsecutive(dates) {
    if (dates.length <= 1) return true;
    
    // 날짜순 정렬
    const sorted = dates.slice().sort();
    
    for (let i = 0; i < sorted.length - 1; i++) {
        const curr = new Date(sorted[i]);
        const next = new Date(sorted[i+1]);
        const diffTime = Math.abs(next - curr);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        if (diffDays > 1) return false; // 1일 차이가 아니면 떨어진 것임
    }
    return true;
}

// ==========================================
// 8. 설정 모달 로직
// ==========================================
function openHolidayModalMulti() {
    selectedDates.sort(); // 보여줄 때 정렬

    let title = "";
    if (selectedDates.length === 1) title = selectedDates[0];
    else title = `${selectedDates[0]} ~ ${selectedDates[selectedDates.length-1]} (${selectedDates.length}일)`;
    
    document.getElementById('modal-date-display').textContent = title;
    
    const firstKey = selectedDates[0];
    const config = holidayConfig[firstKey] || {};
    document.getElementById('holiday-label').value = config.label || "";
    if(typeof selectColor === 'function') selectColor(config.color || 'red');

    document.getElementById('holiday-modal').classList.remove('hidden');
}

function saveHolidaySetting() {
    const label = document.getElementById('holiday-label').value;
    const color = document.getElementById('selected-color').value || 'red';

    // 선택된 날짜에 일괄 적용
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
