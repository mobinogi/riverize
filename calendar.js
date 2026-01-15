/**
 * calendar.js
 * - 달력 렌더링, 월 이동, 일보 데이터 조회
 * - 일보 클릭/삭제 (롱프레스)
 * - [NEW] 달력 편집 모드 (공휴일/기념일 설정)
 */

// === 1. 전역 변수 선언 ===
let currentYear, currentMonth;
let reportsMap = {};       // 일보 데이터 저장
let holidayConfig = {};    // [NEW] 꾸미기 데이터 저장
let isEditMode = false;    // [NEW] 편집 모드 상태
let editingDateKey = "";   // [NEW] 현재 편집 중인 날짜
let longPressTimer;        // 롱프레스 타이머

// === 2. 초기화 (페이지 로드 시 호출) ===
function initCalendar() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth() + 1;

    // 1) 서버에서 "달력 꾸미기 설정" 불러오기
    google.script.run.withSuccessHandler(function(data) {
        try { holidayConfig = JSON.parse(data); } catch(e) { holidayConfig = {}; }
        // 설정 로드 후, 일보 데이터도 조회 시작
        getReportFilesByMonth(currentYear, currentMonth);
    }).loadCalendarConfig();

    // 2) 편집 모드 토글 버튼 리스너 연결
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
            renderCalendar(); // 클릭 이벤트 변경을 위해 다시 그리기
        });
    }
}

    async function changeMonth(delta) {
      const date = new Date(currentYear, currentMonth - 1 + delta, 1);
      currentYear = date.getFullYear();
      currentMonth = date.getMonth() + 1;
      fetchReportsForMonth(currentYear, currentMonth);
    }


function getReportFilesByMonth(year, month) {
    // 로딩 표시 (index.html에 showLoading 함수가 있다고 가정)
    if(typeof showLoading === 'function') showLoading();
    
    // 화면의 날짜 텍스트 갱신 (로딩 중 임시)
    document.getElementById('current-month-display').textContent = year + '년 ' + month + '월';

    google.script.run.withSuccessHandler(function(data) {
        reportsMap = data; // 서버에서 가져온 일보 리스트
        renderCalendar();  // 달력 그리기
        if(typeof hideLoading === 'function') hideLoading();
    }).getReportFilesByMonth(year, month);
}

// === 4. 달력 그리기 (핵심) ===
function renderCalendar() {
    const container = document.getElementById('calendar-days');
    if (!container) return;
    container.innerHTML = ''; // 초기화

    // 상단 텍스트 갱신
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
        
        // 데이터 확인 (일보 & 꾸미기)
        const hasReport = reportsMap[dateKey];
        const config = holidayConfig[dateKey] || {};
        
        // 꾸미기 속성
        const label = config.label || "";
        const colorType = config.color || (isSunday ? 'red' : 'black'); // 기본값: 일요일은 빨강

        // 텍스트 색상 클래스
        let textClass = "text-gray-700";
        if (colorType === 'red') textClass = "text-red-500";
        else if (colorType === 'blue') textClass = "text-blue-500";

        // 박스 스타일 조합
        let cls = `date-box ${textClass} ${hasReport ? 'report-exists' : 'no-report'}`;

        // 클릭 이벤트 처리
        let clickAction = "";
        
        if (isEditMode) {
            // [편집 모드] -> 설정 모달 열기
            clickAction = `onclick="openHolidayModal('${dateKey}', '${label}', '${colorType}')"`;
        } else {
            // [일반 모드]
            if (hasReport) {
                // 일보가 있으면 -> 열기 + 꾹 눌러 삭제
                const rId = hasReport.id;
                const rUrl = hasReport.url;
                const dStr = `${currentYear}년 ${currentMonth}월 ${day}일`;
                clickAction = `
                    onclick="handleReportClick('${rUrl}')"
                    onmousedown="startPressReport(this, '${rId}', '${rUrl}', '${dStr}')" 
                    onmouseup="endPressReport()"
                    onmouseleave="endPressReport()"
                    ontouchstart="startPressReport(this, '${rId}', '${rUrl}', '${dStr}')"
                    ontouchend="endPressReport()"
                `;
            } else {
                // 일보가 없으면 -> 작성 (빨간날 경고는 선택사항, 여기선 그냥 작성 허용)
                clickAction = `onclick="onDateClick(${day})"`;
            }
        }

        // 내용물 (숫자 + 라벨)
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

// === 5. 이벤트 핸들러 (클릭/삭제) ===

// 날짜 클릭 (새 일보 작성)
    function onDateClick(day, isSunday) {
      if (isSunday) return;
      const formattedDate = currentYear + '-' + String(currentMonth).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      selectedDateForGeneration = formattedDate;
      const report = reportsMap[formattedDate];
      if (report && report.url) {
        openSheetApp(report.url);
      } else {
        const dateStr = currentYear + '년 ' + currentMonth + '월 ' + day + '일';
        document.getElementById('modal-message').innerHTML = '<b>' + dateStr + '</b> 일자의 보고서가 없습니다.<br>새로 작성하시겠습니까?';
        openModal();
      }
    }


// 일보 아이콘 클릭 (열기)
function handleReportClick(url) {
    window.open(url, '_blank');
}

// 꾹 눌러서 삭제 (롱프레스)
function startPressReport(element, fileId, fileUrl, dateStr) {
    longPressTimer = setTimeout(() => {
        if (confirm(`[${dateStr}] 일보를 삭제하시겠습니까?\n(삭제 후 복구할 수 없습니다)`)) {
            deleteReportFile(fileId);
        }
    }, 1000); // 1초 누르면 삭제
}

function endPressReport() {
    clearTimeout(longPressTimer);
}

function deleteReportFile(fileId) {
    showLoading();
    google.script.run.withSuccessHandler(function(res) {
        hideLoading();
        showToast("일보가 삭제되었습니다.", "success");
        // 목록 갱신
        getReportFilesByMonth(currentYear, currentMonth);
    }).deleteReportFile(fileId);
}

// === 6. [NEW] 편집 모드 관련 함수들 ===

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
            if(c === color) {
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
        delete holidayConfig[editingDateKey]; // 설정 초기화
    } else {
        holidayConfig[editingDateKey] = { label, color };
    }

    // 1. 화면 즉시 반영
    renderCalendar();
    closeHolidayModal();

    // 2. 서버 저장
    google.script.run.saveCalendarConfig(JSON.stringify(holidayConfig));
}
