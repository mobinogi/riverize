/**
 * calendar.js
 * - GitHub 테스트 페이지: fetch로 원격 접속 (스마트 연결)
 * - 실제 구글 앱: google.script.run으로 내부 접속
 */

// ==========================================
// 1. [스마트 연결] 테스트 페이지용 브릿지
// ==========================================
const TEST_API_URL = "여기에_웹앱_배포주소_붙여넣으세요"; // (예: https://script.google.com/macros/s/.../exec)

// google.script.run이 없으면(테스트 페이지면), fetch로 연결해주는 마법의 코드
if (typeof google === 'undefined' || typeof google.script === 'undefined') {
    console.log("🌍 원격 접속 모드(Bridge): Fetch로 데이터를 가져옵니다.");
    
    // 1) Fetch 함수 (사장님이 쓰시던 것)
    window.callAppsScript = async function(action, params = {}) {
        if(TEST_API_URL.includes("여기에")) {
            alert("calendar.js 파일 맨 위에 'TEST_API_URL'을 설정해주세요!");
            return {};
        }
        const url = new URL(TEST_API_URL);
        url.searchParams.set('action', action);
        for (const key in params) url.searchParams.set(key, params[key]);
        
        try {
            const res = await fetch(url.toString());
            return await res.json();
        } catch(e) {
            console.error("통신 실패:", e);
            alert("구글 서버와 연결할 수 없습니다. CORS 또는 배포 주소를 확인하세요.");
            return {};
        }
    };

    // 2) google.script.run 흉내내기 (Bridge)
    window.google = {
        script: {
            run: {
                withSuccessHandler: function(callback) {
                    // 성공 시 실행할 함수를 기억해두고, 실제 요청을 수행하는 객체 반환
                    return {
                        // 1. 달력 설정 불러오기
                        loadCalendarConfig: function() {
                            callAppsScript('loadCalendarConfig').then(callback);
                        },
                        // 2. 달력 설정 저장하기
                        saveCalendarConfig: function(json) {
                            callAppsScript('saveCalendarConfig', {json: json}).then(callback);
                        },
                        // 3. 일보 목록 가져오기
                        getReportFilesByMonth: function(year, month) {
                            callAppsScript('getReportFilesByMonth', {year: year, month: month}).then(callback);
                        },
                        // 4. 일보 삭제하기
                        deleteReportFile: function(fileId) {
                            callAppsScript('deleteReportFile', {fileId: fileId}).then(callback);
                        }
                    };
                }
            }
        }
    };
}

// ==========================================
// 2. 전역 변수 및 설정
// ==========================================
let reportsMap = {};
let holidayConfig = {};
let currentYear, currentMonth;
let isEditMode = false;
let editingDateKey = "";

// ==========================================
// 3. 달력 로직 시작
// ==========================================

function initCalendar() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth() + 1;

    // 설정 불러오기 -> 성공하면 일보 데이터 불러오기
    google.script.run.withSuccessHandler(function(data) {
        try { holidayConfig = JSON.parse(data); } catch(e) { holidayConfig = {}; }
        getReportFilesByMonth(currentYear, currentMonth);
    }).loadCalendarConfig();

    // 편집 모드 버튼
    const toggleBtn = document.getElementById('edit-mode-toggle');
    if(toggleBtn) {
        toggleBtn.addEventListener('change', function(e) {
            isEditMode = e.target.checked;
            document.getElementById('calendar-days').classList.toggle('editing-mode', isEditMode);
            renderCalendar();
        });
    }
}

function changeMonth(offset) {
    currentMonth += offset;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    else if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    getReportFilesByMonth(currentYear, currentMonth);
}

function getReportFilesByMonth(year, month) {
    // 로딩 표시
    const title = document.getElementById('current-month-display');
    if(title) title.textContent = `${year}년 ${month}월 (로딩중...)`;

    google.script.run.withSuccessHandler(function(data) {
        reportsMap = data || {}; 
        renderCalendar(); // 데이터 받으면 그리기
    }).getReportFilesByMonth(year, month);
}

function renderCalendar() {
    const container = document.getElementById('calendar-days');
    if (!container) return;
    container.innerHTML = '';

    document.getElementById('current-month-display').textContent = `${currentYear}년 ${currentMonth}월`;
    
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    // 빈 칸
    for (let i = 0; i < firstDay; i++) container.innerHTML += '<div class="p-2"></div>';

    // 날짜
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isSunday = new Date(currentYear, currentMonth - 1, day).getDay() === 0;
        
        const hasReport = reportsMap[dateKey];
        const config = holidayConfig[dateKey] || {};
        
        const label = config.label || "";
        const colorType = config.color || (isSunday ? 'red' : 'black');

        // 스타일
        let textClass = "text-gray-700";
        if (colorType === 'red') textClass = "text-red-500";
        else if (colorType === 'blue') textClass = "text-blue-500";
        
        let cls = `date-box ${textClass} ${hasReport ? 'report-exists' : 'no-report'}`;

        // 클릭 동작
        let clickAction = "";
        if (isEditMode) {
            clickAction = `onclick="openHolidayModal('${dateKey}', '${label}', '${colorType}')"`;
        } else {
            if (hasReport) {
                clickAction = `onclick="window.open('${hasReport.url}', '_blank')"`;
            } else {
                // 일보 작성 (일단 알림으로 대체, 실제 작성 함수 있으면 연결)
                clickAction = `onclick="alert('${day}일 일보를 작성합니다.')"`;
            }
        }

        let content = `<span style="z-index:1;">${day}</span>`;
        if (label) content += `<span class="holiday-badge ${colorType === 'blue'?'blue':''}">${label}</span>`;

        container.innerHTML += `<div class="p-2 flex justify-center"><div class="${cls}" ${clickAction}>${content}</div></div>`;
    }
}

// --- 모달 관련 ---
function openHolidayModal(dateKey, label, color) {
    editingDateKey = dateKey;
    document.getElementById('modal-date-display').textContent = dateKey;
    document.getElementById('holiday-label').value = label;
    document.getElementById('holiday-modal').classList.remove('hidden');
}

function closeHolidayModal() {
    document.getElementById('holiday-modal').classList.add('hidden');
}

function saveHolidaySetting() {
    const label = document.getElementById('holiday-label').value;
    const color = document.getElementById('selected-color').value || 'red'; // 색상 선택 안했으면 레드

    if(!label) delete holidayConfig[editingDateKey];
    else holidayConfig[editingDateKey] = { label, color };

    renderCalendar();
    closeHolidayModal();
    
    // 서버 저장
    google.script.run.withSuccessHandler(function(res){
        console.log("저장 완료");
    }).saveCalendarConfig(JSON.stringify(holidayConfig));
}
