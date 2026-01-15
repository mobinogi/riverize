/**
 * calendar.js
 * - 디자인: h-20 고정, 일반 모드 시 hover 테두리 제거 (완전 순정)
 * - 기능: 편집 모드 시에만 테두리 표시, 다중 선택, 띠지 중앙 정렬
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
// 6. 렌더링 (★ 순정 디자인: hover 테두리 제거)
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

        // 숫자 스타일 (z-index 추가)
        let numClass = "font-bold text-sm ml-1 mt-1 z-10"; 
        if (colorType === 'red') numClass += " text-red-500";
        else if (colorType === 'blue') numClass += " text-blue-500";
        else numClass += " text-gray-700";

        // --- [띠지 & 텍스트 중앙 정렬] ---
        let barHtml = "";
        
        if (label) {
            // 연결성 체크
            let prevCount = 0, nextCount = 0;
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

            // 색상
            let bgClass = colorType === 'red' ? 'bg-red-100 text-red-600' : (colorType === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-700');

            // 모양
            let barStyleClass = "";
            if (!isPrevSame && isNextSame) barStyleClass = "rounded-l-md ml-1"; 
            else if (isPrevSame && isNextSame) barStyleClass = ""; 
            else if (isPrevSame && !isNextSame) barStyleClass = "rounded-r-md mr-1"; 
            else barStyleClass = "rounded-md mx-1"; 

            barHtml = `<div class="absolute bottom-1 left-0 right-0 h-4 flex items-center justify-center overflow-visible whitespace-nowrap ${bgClass} ${barStyleClass}" style="z-index: 0;">
                <span class="${isCenter ? 'opacity-100' : 'opacity-0'} text-[10px] font-bold" style="z-index: 10;">${label}</span>
            </div>`;
        }

        // --- [선택 효과] ---
        // ★ 중요: 평소에는 아무 효과 없음. '편집 모드'일 때만 Ring 표시
        let selectionClass = "";
        if (isEditMode && selectedDates.includes(dateKey)) {
            selectionClass = "bg-green-50 ring-2 ring-green-500 z-20"; 
        }
        
        // 일보 마커
        const reportMarker = hasReport ? `<div class="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500"></div>` : "";

        // ★ HTML 조립: border-transparent, hover:border-gray-200 제거함 (완전 순정)
        container.innerHTML += `
            <div class="h-20 relative cursor-pointer rounded-lg transition-all ${selectionClass}"
                 ontouchstart="handleTouchStart('${dateKey}', ${day}, ${isSunday})"
                 ontouchend="handleTouchEnd()"
                 onmousedown="handleMouseDown('${dateKey}', ${day}, ${isSunday})"
                 onmouseup="handleMouseUp()"
                 onclick="handleClick('${dateKey}', ${day}, ${isSunday})">
                
                <div class="absolute top-0 left-0">
                    <span class="${numClass}">${day}</span>
                </div>

                ${reportMarker}
                ${barHtml}
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
        if (!selectedDates.includes(dateKey)) {
            selectedDates.push(dateKey);
            renderCalendar();
        }
        
        // 떨어진 날짜 체크
        if (!checkConsecutive(selectedDates)) {
            showToast("❌ 떨어진 날짜는 같이 설정할 수 없습니다!", "error");
            return;
        }

        openHolidayModalMulti();
    } else {
        // [일반모드] 삭제/옵션
        const hasReport = reportsMap[dateKey];
        if (hasReport) {
             if(typeof openReportOptionModal === 'function') openReportOptionModal(hasReport.fileId, dateKey);
        }
    }
}

// 연속성 체크
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
