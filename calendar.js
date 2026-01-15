/**
 * calendar.js
 * - 기능: 달력 렌더링, 범위 선택(Range), 휴일 띠지 표시, GitHub Pages <-> Apps Script 통신
 */

// 1. [설정] 사장님의 웹 앱 주소
const CALENDAR_API_URL = "https://script.google.com/macros/s/AKfycby5URDVswhQPo4sJwe2VQZxWRpDGv5F76AgHGA_AoXknJHUjVjgIbNmFT_qrQ8yDZ-2/exec";

// 2. [통신] fetch 함수
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

// 3. [브릿지] GitHub 환경용 가짜 google.script.run (여기에 saveCalendarConfig 추가함!)
if (typeof google === 'undefined' || typeof google.script === 'undefined') {
    window.google = {
        script: {
            run: {
                withSuccessHandler: function(successCallback) {
                    return {
                        withFailureHandler: function(failureCallback) { return this; },
                        
                        // ★ [수정] 여기에 saveCalendarConfig가 빠져서 에러가 났던 겁니다. 복구 완료!
                        loadCalendarConfig: function() {
                            callCalendarApi('loadCalendarConfig').then(successCallback);
                        },
                        saveCalendarConfig: function(json) {
                            callCalendarApi('saveCalendarConfig', {json: json}).then(successCallback);
                        },
                        getReportFilesByMonth: function(year, month) {
                            callCalendarApi('getReportFilesByMonth', {year: year, month: month}).then(successCallback);
                        },
                        deleteReportFile: function(fileId) {
                            callCalendarApi('deleteReportFile', {fileId: fileId}).then(successCallback);
                        }
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

// 범위 선택용 변수
let rangeStart = null; 
let rangeEnd = null;

// ==========================================
// 5. 초기화
// ==========================================
function initCalendar() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth() + 1;
    console.log("📅 달력 초기화...");

    // 설정 로드 -> 데이터 로드
    google.script.run.withSuccessHandler(function(data) {
        try { holidayConfig = JSON.parse(data); } catch(e) { holidayConfig = {}; }
        getReportFilesByMonth(currentYear, currentMonth);
    }).loadCalendarConfig();

    // 편집 모드 토글 이벤트
    const toggleBtn = document.getElementById('edit-mode-toggle');
    if(toggleBtn) {
        toggleBtn.addEventListener('change', function(e) {
            isEditMode = e.target.checked;
            // 모드 변경 시 선택 초기화
            rangeStart = null; 
            rangeEnd = null;
            document.getElementById('calendar-days').classList.toggle('editing-mode', isEditMode);
            renderCalendar();
            
            if(isEditMode) showToast("🛠️ 편집 모드: 시작 날짜와 끝 날짜를 터치하세요.");
        });
    }
}

function changeMonth(offset) {
    currentMonth += offset;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    else if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    
    // 월 변경 시 캐시 초기화
    const key = currentYear + '-' + currentMonth;
    if(reportsMap[key]) delete reportsMap[key]; // 간단한 갱신

    getReportFilesByMonth(currentYear, currentMonth);
}

function getReportFilesByMonth(year, month) {
    const titleEl = document.getElementById('current-month-display');
    if(titleEl) titleEl.textContent = `${year}년 ${month}월 (로딩...)`;

    google.script.run.withSuccessHandler(function(data) {
        // 데이터 병합
        if (Array.isArray(data)) {
            data.forEach(r => reportsMap[r.date] = r);
        } else {
            reportsMap = Object.assign(reportsMap, data || {});
        }
        renderCalendar();
    }).getReportFilesByMonth(year, month);
}

// ==========================================
// 6. 렌더링 (핵심: 띠지 그리기)
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

        // --- 1. 날짜 숫자 스타일 ---
        let numClass = "text-gray-700 font-bold z-10 relative";
        if (colorType === 'red') numClass = "text-red-500 font-bold z-10 relative";
        else if (colorType === 'blue') numClass = "text-blue-500 font-bold z-10 relative";

        // --- 2. 연속된 라벨(띠지) 처리 로직 ---
        let barHtml = "";
        let barClass = "";
        let barText = "";

        if (label) {
            // 어제랑 같은 라벨인지 확인 (연속성)
            const prevDate = new Date(currentYear, currentMonth - 1, day - 1);
            const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}-${String(prevDate.getDate()).padStart(2,'0')}`;
            const prevConfig = holidayConfig[prevKey] || {};
            const isPrevSame = (prevConfig.label === label);

            // 내일이랑 같은 라벨인지 확인
            const nextDate = new Date(currentYear, currentMonth - 1, day + 1);
            const nextKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}-${String(nextDate.getDate()).padStart(2,'0')}`;
            const nextConfig = holidayConfig[nextKey] || {};
            const isNextSame = (nextConfig.label === label);

            // 띠지 색상
            let bgClass = colorType === 'red' ? 'bg-red-100 text-red-600' : (colorType === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-700');

            // 띠지 모양 결정
            if (!isPrevSame && isNextSame) {
                // [시작] (오른쪽으로 트임)
                barClass = `absolute bottom-1 left-1 right-0 rounded-l-md h-5 text-[10px] flex items-center pl-1 whitespace-nowrap overflow-hidden ${bgClass}`;
                barText = label; 
            } else if (isPrevSame && isNextSame) {
                // [중간] (양옆 트임)
                barClass = `absolute bottom-1 left-0 right-0 h-5 ${bgClass}`;
            } else if (isPrevSame && !isNextSame) {
                // [끝] (왼쪽으로 트임)
                barClass = `absolute bottom-1 left-0 right-1 rounded-r-md h-5 ${bgClass}`;
            } else {
                // [단독] (둥글게)
                barClass = `absolute bottom-1 left-1 right-1 rounded-md h-5 text-[10px] flex items-center justify-center ${bgClass}`;
                barText = label;
            }
            
            barHtml = `<div class="${barClass}">${barText}</div>`;
        }

        // --- 3. 범위 선택 하이라이트 (편집 모드용) ---
        let selectionClass = "";
        if (isEditMode && rangeStart) {
            const curr = new Date(dateKey).getTime();
            const start = new Date(rangeStart).getTime();
            const end = rangeEnd ? new Date(rangeEnd).getTime() : start;
            
            // start와 end 순서 바껴도 처리
            const s = Math.min(start, end);
            const e = Math.max(start, end);

            if (curr >= s && curr <= e) {
                selectionClass = "bg-green-100 ring-2 ring-green-400 rounded-lg";
            }
        }
        
        // --- 4. 클릭 액션 ---
        let clickAction = "";
        if (isEditMode) {
            clickAction = `onclick="handleDateSelection('${dateKey}')"`;
        } else {
            if (hasReport) clickAction = `onclick="window.open('${hasReport.url}', '_blank')"`;
            else clickAction = `onclick="if(typeof onDateClick === 'function') onDateClick(${day}, ${isSunday});"`;
        }

        // --- 5. 최종 HTML 조립 ---
        // 날짜 박스 자체를 relative로 해서 띠지가 겹치지 않게 함
        // report-exists(일보 있음)는 점 표시로 대체하거나 배경색 유지
        const reportMarker = hasReport ? `<div class="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500"></div>` : "";

        container.innerHTML += `
            <div class="h-20 p-0.5 relative cursor-pointer hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200 rounded-lg ${selectionClass}" ${clickAction}>
                <div class="flex flex-col h-full justify-between">
                    <span class="${numClass} ml-1 mt-1">${day}</span>
                    ${reportMarker}
                    ${barHtml} 
                </div>
            </div>
        `;
    }
}

// ==========================================
// 7. 범위 선택 및 저장 로직 (New!)
// ==========================================
function handleDateSelection(dateKey) {
    if (!rangeStart) {
        // 첫 번째 클릭: 시작점 설정
        rangeStart = dateKey;
        rangeEnd = null; // 초기화
        renderCalendar();
    } else if (!rangeEnd) {
        // 두 번째 클릭: 끝점 설정하고 모달 열기
        rangeEnd = dateKey;
        renderCalendar(); // 범위 그려주기
        
        // 순서 정렬
        if (new Date(rangeStart) > new Date(rangeEnd)) {
            [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
        }
        
        // 모달 열기
        setTimeout(() => openHolidayModalRange(), 200);
    } else {
        // 세 번째 클릭: 다시 시작점부터
        rangeStart = dateKey;
        rangeEnd = null;
        renderCalendar();
    }
}

function openHolidayModalRange() {
    let title = rangeStart;
    if (rangeStart !== rangeEnd) title += ` ~ ${rangeEnd}`;
    
    document.getElementById('modal-date-display').textContent = title;
    
    // 기존 설정값이 있으면 가져오기 (첫날 기준)
    const config = holidayConfig[rangeStart] || {};
    document.getElementById('holiday-label').value = config.label || "";
    selectColor(config.color || 'red'); // tests.html에 있는 함수 호출

    document.getElementById('holiday-modal').classList.remove('hidden');
}

function closeHolidayModal() {
    document.getElementById('holiday-modal').classList.add('hidden');
    // 모달 닫으면 선택 해제
    rangeStart = null;
    rangeEnd = null;
    renderCalendar();
}

function saveHolidaySetting() {
    const label = document.getElementById('holiday-label').value;
    const color = document.getElementById('selected-color').value || 'red';

    // 범위 내 모든 날짜에 설정 적용
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    
    // 하루씩 증가시키며 저장
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${day}`;
        
        if (!label) delete holidayConfig[key];
        else holidayConfig[key] = { label, color };
    }

    // 화면 갱신 & 모달 닫기
    renderCalendar();
    closeHolidayModal(); // 여기서 rangeStart/End 초기화됨
    
    // ★ 서버 저장 (이제 에러 안 남!)
    showToast("저장 중...");
    google.script.run.withSuccessHandler(function() {
        showToast("설정이 저장되었습니다.", "success");
    }).saveCalendarConfig(JSON.stringify(holidayConfig));
}
