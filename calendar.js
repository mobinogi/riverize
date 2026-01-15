
// 1. [설정] 사장님의 웹 앱 배포 주소 (API_URL)
const CALENDAR_API_URL = "https://script.google.com/macros/s/AKfycby5URDVswhQPo4sJwe2VQZxWRpDGv5F76AgHGA_AoXknJHUjVjgIbNmFT_qrQ8yDZ-2/exec";

// 2. [통신 함수] fetch를 이용해 구글 서버와 대화하는 함수
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

// 3. [브릿지] google.script.run이 없는 환경(GitHub)을 위한 연결 다리
if (typeof google === 'undefined' || typeof google.script === 'undefined') {
    console.log("🌍 GitHub 환경 감지: Bridge 모드로 작동합니다.");
    window.google = {
        script: {
            run: {
                withSuccessHandler: function(successCallback) {
                    return {
                        withFailureHandler: function(failureCallback) { return this; },
                        
                        // ★ 여기가 핵심입니다! 함수 이름을 fetch 요청으로 연결
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
// 4. 전역 변수 (State)
// ==========================================
let reportsMap = {};       
let holidayConfig = {};    
let currentYear, currentMonth;
let isEditMode = false;    
let editingDateKey = "";   

// ==========================================
// 5. 초기화 함수 (HTML에서 호출하는 이름: initCalendar)
// ==========================================
function initCalendar() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth() + 1;

    console.log("📅 달력 초기화 시작...");

    // 1. 설정 불러오기 -> 성공하면 -> 일보 데이터 불러오기
    google.script.run.withSuccessHandler(function(data) {
        try { holidayConfig = JSON.parse(data); } catch(e) { holidayConfig = {}; }
        // 설정 로드 후 데이터 요청
        getReportFilesByMonth(currentYear, currentMonth);
    }).loadCalendarConfig();

    // 편집 모드 버튼 이벤트
    const toggleBtn = document.getElementById('edit-mode-toggle');
    if(toggleBtn) {
        toggleBtn.addEventListener('change', function(e) {
            isEditMode = e.target.checked;
            document.getElementById('calendar-days').classList.toggle('editing-mode', isEditMode);
            renderCalendar();
        });
    }
}

// ==========================================
// 6. 주요 로직 함수들
// ==========================================

function changeMonth(offset) {
    currentMonth += offset;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    else if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    getReportFilesByMonth(currentYear, currentMonth);
}

function getReportFilesByMonth(year, month) {
    // 로딩 표시
    const titleEl = document.getElementById('current-month-display');
    if(titleEl) titleEl.textContent = `${year}년 ${month}월 (로딩...)`;

    // 서버 요청
    google.script.run.withSuccessHandler(function(data) {
        reportsMap = data || {}; 
        renderCalendar(); // 데이터 받으면 그리기
    }).getReportFilesByMonth(year, month);
}

function renderCalendar() {
    const container = document.getElementById('calendar-days');
    if (!container) return;
    container.innerHTML = '';

    // 제목 업데이트
    document.getElementById('current-month-display').textContent = `${currentYear}년 ${currentMonth}월`;
    const summaryBtn = document.getElementById('summary-button-text');
    if(summaryBtn) summaryBtn.textContent = `${currentMonth}월 매출현황표 생성`;

    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    // 빈 칸 채우기
    for (let i = 0; i < firstDay; i++) container.innerHTML += '<div class="p-2"></div>';

    // 날짜 채우기
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isSunday = new Date(currentYear, currentMonth - 1, day).getDay() === 0;
        
        const hasReport = reportsMap[dateKey];
        const config = holidayConfig[dateKey] || {};
        
        const label = config.label || "";
        const colorType = config.color || (isSunday ? 'red' : 'black');

        // 스타일 결정
        let textClass = "text-gray-700";
        if (colorType === 'red') textClass = "text-red-500";
        else if (colorType === 'blue') textClass = "text-blue-500";
        
        let cls = `date-box ${textClass} ${hasReport ? 'report-exists' : 'no-report'}`;

        // 클릭 이벤트 결정
        let clickAction = "";
        if (isEditMode) {
            clickAction = `onclick="openHolidayModal('${dateKey}', '${label}', '${colorType}')"`;
        } else {
            if (hasReport) {
                // 일보가 있으면 -> index.html의 함수나 window.open 사용
                // window.openSheetApp이 있다면 그걸 쓰고, 없으면 window.open
                clickAction = `onclick="window.open('${hasReport.url}', '_blank')"`;
            } else {
                // 일보가 없으면 -> 작성 (onDateClick은 index.html에 없으면 여기서 처리하거나 빈 함수)
                // index.html에 onDateClick이 남아있다면 그걸 호출
                clickAction = `onclick="if(typeof onDateClick === 'function') onDateClick(${day}); else alert('${day}일 일보 작성');"`;
            }
        }

        // 내용물 구성
        let content = `<span style="z-index:1;">${day}</span>`;
        if (label) content += `<span class="holiday-badge ${colorType === 'blue'?'blue':''}">${label}</span>`;

        container.innerHTML += `
            <div class="p-2 flex justify-center">
                <div class="${cls}" ${clickAction}>
                    ${content}
                </div>
            </div>
        `;
    }
}

// ==========================================
// 7. 모달 & 설정 저장 기능
// ==========================================

function openHolidayModal(dateKey, label, color) {
    editingDateKey = dateKey;
    document.getElementById('modal-date-display').textContent = dateKey;
    document.getElementById('holiday-label').value = label;
    // 색상 버튼 초기화 로직은 간소화 (필요시 추가)
    document.getElementById('holiday-modal').classList.remove('hidden');
}

function closeHolidayModal() {
    document.getElementById('holiday-modal').classList.add('hidden');
}

function saveHolidaySetting() {
    const label = document.getElementById('holiday-label').value;
    const color = document.getElementById('selected-color').value || 'red';

    if(!label) delete holidayConfig[editingDateKey];
    else holidayConfig[editingDateKey] = { label, color };

    // 1. 화면 즉시 반영
    renderCalendar();
    closeHolidayModal();
    
    // 2. 서버 저장
    google.script.run.saveCalendarConfig(JSON.stringify(holidayConfig));
}
