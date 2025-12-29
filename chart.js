// ==========================================
// chart.js (최종: 1D 고정주간 + 작년비교)
// ==========================================

// 전역 변수
let salesChartInstance = null;
let dashboardData = {};
let currentRange = '1Y';

// 현재 보고 있는 기준 날짜 (1M, 1Y용)
let baseDate = new Date(); 
// [chart.js] 전역 변수 추가
let currentProduct = 'all'; // 'all'(전체), 'st'(생탁), 'rice'(우리쌀)

// ✨ [UI] 알약 이동 애니메이션 함수
function movePill(pillId, targetBtn) {
    const pill = document.getElementById(pillId);
    if (pill && targetBtn) {
        // 버튼의 위치와 크기를 알아내서 알약을 그 자리로 보냄
        pill.style.left = targetBtn.offsetLeft + 'px';
        pill.style.width = targetBtn.offsetWidth + 'px';
    }
}

// ✨ 상품 변경 함수
function changeProduct(prod) {
    currentProduct = prod;

    const btns = {
        'all': document.getElementById('btn-prod-all'),
        'st': document.getElementById('btn-prod-st'),
        'rice': document.getElementById('btn-prod-rice')
    };

    // 1. 알약 이동! 🍬
    movePill('prod-pill', btns[prod]);

    // 2. 글자색 업데이트 (선택된 건 파랑, 나머진 회색)
    for (const [key, btn] of Object.entries(btns)) {
        if (!btn) continue;
        if (key === prod) {
            btn.className = "relative z-10 px-4 py-1.5 text-sm font-bold text-blue-600 dark:text-blue-400 transition-colors duration-200";
        } else {
            btn.className = "relative z-10 px-4 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 transition-colors duration-200";
        }
    }

    updateDashboardChart();
}
// ----------------------------------------------------
// 1. 유틸리티 & 초기화
// ----------------------------------------------------
function switchView(viewId) {
    document.querySelectorAll('.view-content').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('animate-fade-in'); 
    });
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('animate-fade-in');
    }
}

function showSalesDashboard() {
  switchView('dashboard-view');
  
  if (salesChartInstance) { salesChartInstance.destroy(); salesChartInstance = null; }
  
  const sk = document.getElementById('chartSkeleton');
  const ct = document.getElementById('chartContainer');
  if(sk) sk.classList.remove('hidden');
  if(ct) ct.classList.add('hidden');

  callAppsScript('getSalesDashboardData')
    .then(data => {
        initDashboard(data);
    })
    .catch(err => {
        if(sk) sk.classList.add('hidden');
        alert("데이터 불러오기 실패: " + err);
    });
}

function initDashboard(response) {
  const sk = document.getElementById('chartSkeleton');
  const ct = document.getElementById('chartContainer');
  if(sk) sk.classList.add('hidden');
  if(ct) ct.classList.remove('hidden');

  if (!response || response.status !== 'success') {
    alert("서버 오류: " + (response.message || "원인 불명"));
    return;
  }
  dashboardData = response.data;
  updateDashboardChart(); 

  // ✨ [초기화] 알약 위치 잡기 (처음엔 애니메이션 없이 즉시 이동)
  // 약간의 지연시간(50ms)을 줘야 DOM 렌더링 후 정확히 잡힘
  setTimeout(() => {
      movePill('prod-pill', document.getElementById('btn-prod-all'));
      movePill('range-pill', document.getElementById('btn-1y')); // 기본값이 1Y라면
  }, 50);
}

// ----------------------------------------------------
// 2. 날짜 제어 & 버튼 로직
// ----------------------------------------------------

// [chart.js] 1. 날짜 범위 변경 & 이동 함수 (1D 주간 이동 기능 추가)

// [기간 변경] 알약 이동 적용
function changeChartRange(range) {
    currentRange = range;
    
    // 날짜 이동 버튼 보이기/숨기기 (기존 로직 유지)
    const navControl = document.getElementById('dateNavControl');
    if (navControl) navControl.classList.remove('hidden');

    const btns = {
        '1D': document.getElementById('btn-1d'),
        '1M': document.getElementById('btn-1m'),
        '1Y': document.getElementById('btn-1y')
    };

    // 1. 알약 이동! 🍬 (range는 대문자이므로 소문자 id 매칭 주의)
    // 버튼 ID는 btn-1d, btn-1m... 형태임
    const targetId = `btn-${range.toLowerCase()}`;
    const targetBtn = document.getElementById(targetId);
    
    movePill('range-pill', targetBtn);

    // 2. 글자색 업데이트
    ['1D', '1M', '1Y'].forEach(r => {
        const btn = btns[r];
        if (btn) {
            if (r === range) {
                btn.className = "relative z-10 px-3 py-1.5 text-sm font-bold text-blue-600 dark:text-blue-400 transition-colors duration-200";
            } else {
                btn.className = "relative z-10 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 transition-colors duration-200";
            }
        }
    });

    if (range === '1D') baseDate = new Date();
    updateDashboardChart();
}

function moveDate(delta) {
    const nextDate = new Date(baseDate);
    const today = new Date();

    // 이동할 날짜 계산
    if (currentRange === '1Y') {
        nextDate.setFullYear(baseDate.getFullYear() + delta);
    } else if (currentRange === '1M') {
        nextDate.setMonth(baseDate.getMonth() + delta);
    } else if (currentRange === '1D') {
        // 🚨 [신규] 주 단위 이동 (7일씩)
        nextDate.setDate(baseDate.getDate() + (delta * 7));
    }

    // 🚫 [제한] 미래로 이동하려고 하면 막기 (오늘이 포함된 주/달/연도까지만 허용)
    // 1D: 다음 주 월요일이 오늘보다 미래면 차단
    // 1M: 다음 달 1일이 오늘보다 미래면 차단
    // 1Y: 내년이면 차단
    
    // 간단하게 "오늘보다 미래의 날짜를 기준일로 잡으려 하면" 막음
    // (단, 1D는 주의 시작일이 기준이라 조금 넉넉하게 체크)
    if (delta > 0) {
        // 오늘 날짜랑 비교 (시간 떼고)
        const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const n = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
        
        // 1D의 경우, 이번 주 월요일까지만 이동 가능하게
        if (currentRange === '1D') {
             const dayNum = t.getDay();
             const diffToMon = (dayNum === 0 ? -6 : 1) - dayNum;
             const thisMon = new Date(t); 
             thisMon.setDate(t.getDate() + diffToMon);
             
             if (n > thisMon) return; // 미래 주로는 이동 불가
        } else {
             // 1M, 1Y는 그냥 오늘보다 미래면 차단 (이번 달/올해까지만)
             if (n > t) return; 
        }
    }

    // 통과되면 적용
    baseDate = nextDate;
    updateDashboardChart();
}

// ============================================================
// 🎨 [커스텀 툴팁] 1. 툴팁 껍데기 + 꼬리(화살표) 생성
// ============================================================
const getOrCreateTooltip = (chart) => {
  let tooltipEl = document.getElementById('chartjs-custom-tooltip');

  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'chartjs-custom-tooltip';
    tooltipEl.classList.add('chartjs-tooltip');
    
    // 툴팁 본체 스타일
    tooltipEl.style.background = 'rgba(17, 24, 39, 0.95)';
    tooltipEl.style.borderRadius = '8px';
    tooltipEl.style.color = 'white';
    tooltipEl.style.opacity = 1;
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.transition = 'all .1s ease'; 
    tooltipEl.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
    tooltipEl.style.zIndex = '9999';
    tooltipEl.style.minWidth = '200px'; 
    tooltipEl.style.maxWidth = '300px';
    // 🚨 꼬리가 밖으로 튀어나와야 하므로 overflow visible 필수!
    tooltipEl.style.overflow = 'visible'; 

    // 1. 내용 테이블
    const table = document.createElement('table');
    table.style.margin = '0px';
    table.style.width = '100%';
    tooltipEl.appendChild(table);

    // 2. ✨ [핵심] 꼬리(화살표) 요소 추가
    const arrow = document.createElement('div');
    arrow.className = 'tooltip-arrow';
    arrow.style.position = 'absolute';
    arrow.style.width = '0';
    arrow.style.height = '0';
    arrow.style.borderStyle = 'solid';
    arrow.style.borderWidth = '8px'; // 꼬리 크기
    arrow.style.borderColor = 'transparent'; // 기본은 투명
    arrow.style.top = '50%'; // 세로 중앙 정렬
    arrow.style.transform = 'translateY(-50%)';
    
    tooltipEl.appendChild(arrow);
    document.body.appendChild(tooltipEl);
  }

  return tooltipEl;
};

// ============================================================
// 🎨 [커스텀 툴팁] 2. 내용 채우기 & 꼬리 방향 조종 (수정완료)
// ============================================================
const externalTooltipHandler = (context) => {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltip(chart);
  const arrowEl = tooltipEl.querySelector('.tooltip-arrow');

  // 툴팁 숨김 처리
  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  // 데이터가 있을 때만 렌더링
  if (tooltip.body) {
    const idx = tooltip.dataPoints[0].dataIndex;
    const datasets = chart.data.datasets;

    // 1. 데이터셋 찾기
    const currentSet = datasets.find(d => d.label === '매출' || d.label.includes('올해'));
    const lastYearSet = datasets.find(d => d.label === '작년 동기');
    
    // 1D일 땐 '지난주', 그 외엔 '전월 동기'를 찾음
    let prevSet = datasets.find(d => d.label === '지난주'); // 1D용
    let prevLabelName = '지난주';
    
    if (!prevSet) {
        prevSet = datasets.find(d => d.label === '전월 동기'); // 1M, 1Y용
        prevLabelName = '전월';
    }

    // 2. 값 가져오기
    const currVal = currentSet ? currentSet.data[idx] : 0;
    const lastVal = lastYearSet ? lastYearSet.data[idx] : 0;
    const prevVal = prevSet ? prevSet.data[idx] : 0; 

    // 데이터 없음(0) 체크 -> 숨김
    if ((!currVal && !prevVal && !lastVal) || (currVal === 0 && prevVal === 0 && lastVal === 0)) {
        tooltipEl.style.opacity = 0;
        return;
    }

    const currDetails = (currentSet && currentSet.customDetails) ? currentSet.customDetails[idx] : { s: 0, r: 0 };

    // 3. 증감 HTML 생성
    const getDiffHtml = (base, target) => {
      const diff = base - target;
      if (diff > 0) return `<span style="color:#ef4444; font-weight:bold;">▲${diff}</span>`;
      if (diff < 0) return `<span style="color:#3b82f6; font-weight:bold;">▼${Math.abs(diff)}</span>`;
      return `<span style="color:#9ca3af;">-</span>`;
    };

    const diffPrev = getDiffHtml(currVal, prevVal);
    const diffYear = getDiffHtml(currVal, lastVal);
    const title = chart.data.labels[idx];

    // 4. HTML 조립
    const innerHtml = `
      <div style="padding: 12px;">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #374151; padding-bottom: 5px; color: #f3f4f6;">
          ${title} 현황
        </div>
        <div style="display: flex; gap: 12px; align-items: stretch;">
          <div style="flex: 1; text-align: left;">
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">이번 매출</div>
            <div style="font-size: 12px; color: #d1d5db; display: flex; justify-content: space-between;">
              <span>생탁</span> <span style="color:white; font-weight:500;">${currDetails.s}</span>
            </div>
            <div style="font-size: 12px; color: #d1d5db; display: flex; justify-content: space-between;">
              <span>우리쌀</span> <span style="color:white; font-weight:500;">${currDetails.r}</span>
            </div>
            <div style="margin-top: 6px; font-size: 16px; font-weight: 800; color: #60a5fa; text-align: right;">
              ${currVal}개
            </div>
          </div>
          <div style="width: 1px; background: #4b5563; opacity: 0.5;"></div>
          <div style="flex: 1.1;">
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">성과 비교</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; color: #c084fc;">${prevLabelName}(${prevVal})</span>
              <span style="font-size: 11px;">${diffPrev}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: #9ca3af;">작년(${lastVal})</span>
              <span style="font-size: 11px;">${diffYear}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    tooltipEl.querySelector('table').innerHTML = innerHtml;
  }

  // 🚩 [좌표 및 꼬리 로직] (여기가 함수 밖으로 튕겨나가 있어서 에러가 났었습니다)
  const position = chart.canvas.getBoundingClientRect();
  const rootLeft = position.left + window.pageXOffset;
  const rootTop = position.top + window.pageYOffset;
  const chartWidth = chart.width;

  const bgColor = 'rgba(17, 24, 39, 0.95)';

  if (tooltip.caretX > chartWidth / 2) {
      tooltipEl.style.transform = 'translate(-105%, 0)'; 
      tooltipEl.style.left = (rootLeft + tooltip.caretX - 10) + 'px';
      arrowEl.style.left = 'auto';  
      arrowEl.style.right = '-16px'; 
      arrowEl.style.borderColor = `transparent ${bgColor} transparent transparent`; 
      arrowEl.style.borderLeftColor = bgColor; 
      arrowEl.style.borderRightColor = 'transparent';
  } else {
      tooltipEl.style.transform = 'translate(5%, 0)';
      tooltipEl.style.left = (rootLeft + tooltip.caretX + 10) + 'px';
      arrowEl.style.right = 'auto'; 
      arrowEl.style.left = '-16px'; 
      arrowEl.style.borderColor = `transparent transparent transparent ${bgColor}`; 
      arrowEl.style.borderRightColor = bgColor; 
      arrowEl.style.borderLeftColor = 'transparent';
  }

  tooltipEl.style.top = (rootTop + tooltip.caretY - 20) + 'px';
  tooltipEl.style.opacity = 1;
};
  // 좌표 계산
  const position = chart.canvas.getBoundingClientRect();
  const rootLeft = position.left + window.pageXOffset;
  const rootTop = position.top + window.pageYOffset;
  const chartWidth = chart.width;

  // 꼬리 색상 (배경색과 동일하게)
  const bgColor = 'rgba(17, 24, 39, 0.95)';

  // 🚨 [꼬리 방향 로직]
  if (tooltip.caretX > chartWidth / 2) {
      // (1) 마우스가 오른쪽 -> 툴팁은 왼쪽으로 뜸
      tooltipEl.style.transform = 'translate(-105%, 0)'; 
      tooltipEl.style.left = (rootLeft + tooltip.caretX - 10) + 'px';

      // 꼬리는 오른쪽에 붙어서 오른쪽(▶)을 가리켜야 함
      arrowEl.style.left = 'auto';  // 왼쪽 해제
      arrowEl.style.right = '-16px'; // 오른쪽에 붙임
      // ▶ 모양 만들기 (왼쪽 테두리에 색을 칠해야 오른쪽으로 뾰족해짐)
      arrowEl.style.borderColor = `transparent ${bgColor} transparent transparent`; // 오류 수정: 왼쪽 테두리 색칠
      arrowEl.style.borderLeftColor = bgColor; // 확실하게 덮어쓰기
      arrowEl.style.borderRightColor = 'transparent';
  } else {
      // (2) 마우스가 왼쪽 -> 툴팁은 오른쪽으로 뜸
      tooltipEl.style.transform = 'translate(5%, 0)';
      tooltipEl.style.left = (rootLeft + tooltip.caretX + 10) + 'px';

      // 꼬리는 왼쪽에 붙어서 왼쪽(◀)을 가리켜야 함
      arrowEl.style.right = 'auto'; // 오른쪽 해제
      arrowEl.style.left = '-16px'; // 왼쪽에 붙임
      // ◀ 모양 만들기 (오른쪽 테두리에 색을 칠해야 왼쪽으로 뾰족해짐)
      arrowEl.style.borderColor = `transparent transparent transparent ${bgColor}`; 
      arrowEl.style.borderRightColor = bgColor; // 확실하게 덮어쓰기
      arrowEl.style.borderLeftColor = 'transparent';
  }

  tooltipEl.style.top = (rootTop + tooltip.caretY - 20) + 'px'; // 살짝 위로 보정
  tooltipEl.style.opacity = 1;
};


// ============================================================
// 📊 [chart.js] 차트 그리기 함수 (최종_1D주간비교완성.ver)
// - 1D: 그래프는 '지난주'와 비교 / 툴팁은 '전월/작년 같은 주차'와 비교
// ============================================================
// ============================================================
// 📊 [chart.js] 차트 그리기 함수 (최종_중복제거.ver)
// ============================================================
function updateDashboardChart() {
  const canvas = document.getElementById('salesStatusChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const userSelect = document.getElementById('dashboardUserSelect');
  const selectedUser = userSelect ? userSelect.value : '김원대';
  
  if (!dashboardData || !dashboardData[selectedUser]) return;
  const userData = dashboardData[selectedUser];

  if (salesChartInstance) salesChartInstance.destroy();

  const dateDisplay = document.getElementById('currentDateDisplay');
  const dayNames = ['(일)', '(월)', '(화)', '(수)', '(목)', '(금)', '(토)'];

  // 데이터셋 준비
  let chartLabels = [];
  let mainData = []; 
  let mainDetails = []; 
  let trendData = [];
  let prevMonthData = []; 
  let lastYearData = [];  
  let prevWeekData = [];  // 지난주 데이터

  // Helper 함수들
  const getVal = (dataObj) => {
      if (!dataObj) return 0;
      if (currentProduct === 'st') return dataObj.s || 0;     
      if (currentProduct === 'rice') return dataObj.r || 0;   
      return dataObj.t || 0;                                  
  };

  const getNthWeekDate = (year, month, nth, dayIdx) => {
      const firstDay = new Date(year, month - 1, 1);
      const firstDayIdx = firstDay.getDay(); 
      let dayOffset = dayIdx - firstDayIdx;
      if (dayOffset < 0) dayOffset += 7;
      const targetDate = 1 + dayOffset + (nth - 1) * 7;
      const lastDay = new Date(year, month, 0).getDate();
      if (targetDate > lastDay) return new Date(year, month - 1, targetDate - 7);
      return new Date(year, month - 1, targetDate);
  };

  // ------------------------------------------------
  // 1. 데이터 가공 로직
  // ------------------------------------------------
  if (currentRange === '1Y') {
    // [1Y] 연간
    const y = baseDate.getFullYear();
    if (dateDisplay) dateDisplay.textContent = `${y}년`;
    chartLabels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    
    const processYearData = (detailsArray, totalArray) => {
        if (currentProduct === 'all') return totalArray; 
        return detailsArray.map(d => (currentProduct === 'st' ? d.s : d.r));
    };

    const thisYear = new Date().getFullYear();
    let targetDetails = [], targetTotal = [], lastDetails = [], lastTotal = [];

    if (y === thisYear) {
      targetDetails = userData.thisYearDetails || []; targetTotal = userData.thisYear;
      lastDetails = userData.lastYearDetails || []; lastTotal = userData.lastYear;
    } else if (y === thisYear - 1) {
      targetDetails = userData.lastYearDetails || []; targetTotal = userData.lastYear;
    }

    mainData = processYearData(targetDetails, targetTotal);
    mainDetails = targetDetails; 
    lastYearData = processYearData(lastDetails, lastTotal);
    
    // 1Y 전월 (툴팁용)
    prevMonthData = [];
    for (let i = 0; i < 12; i++) {
        if (i === 0) prevMonthData.push(lastYearData[11] || 0); 
        else prevMonthData.push(mainData[i - 1] || 0);
    }

  } else if (currentRange === '1M') {
    // [1M] 월간
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth() + 1;
    if (dateDisplay) dateDisplay.textContent = `${y}.${String(m).padStart(2,'0')}`;

    const lastDay = new Date(y, m, 0).getDate();
    const prevDate = new Date(y, m - 2, 1);
    const pmY = prevDate.getFullYear(), pmM = prevDate.getMonth() + 1;

    for (let i = 1; i <= lastDay; i++) {
      chartLabels.push(`${i}일`);

      const key = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const d = (userData.daily && userData.daily[key]) || { t: 0, s: 0, r: 0 };
      const val = getVal(d);
      mainData.push(val);
      mainDetails.push({ s: d.s, r: d.r });

      const pmKey = `${pmY}-${String(pmM).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const pmData = (userData.daily && userData.daily[pmKey]) || { t: 0 };
      const pmVal = getVal(pmData);
      prevMonthData.push(pmVal === 0 ? null : pmVal);

      const lyKey = `${y-1}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const lyData = (userData.daily && userData.daily[lyKey]) || { t: 0 };
      lastYearData.push(getVal(lyData));
    }

  } else if (currentRange === '1D') {
    // [1D] 주간
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth() + 1;
    const firstDayOfMonth = new Date(y, m - 1, 1);
    const offset = firstDayOfMonth.getDay();
    const dateNum = baseDate.getDate();
    const weekNum = Math.ceil((dateNum + offset) / 7);
    const weekName = ['첫째주', '둘째주', '셋째주', '넷째주', '다섯째주', '여섯째주'][weekNum - 1] || (weekNum + '주');
    
    if (dateDisplay) dateDisplay.textContent = `${y}.${m}월 ${weekName}`;

    const dayNum = baseDate.getDay();
    const diffToMon = (dayNum === 0 ? -6 : 1) - dayNum;
    const thisMon = new Date(baseDate);
    thisMon.setDate(baseDate.getDate() + diffToMon);
    const prevWeekStart = new Date(thisMon);
    prevWeekStart.setDate(thisMon.getDate() - 7);

    const pmDate = new Date(y, m - 2, 1);
    const pmY = pmDate.getFullYear(), pmM = pmDate.getMonth() + 1;
    const lyY = y - 1, lyM = m;

    for (let i = 0; i < 6; i++) {
      const tDay = new Date(thisMon);
      tDay.setDate(thisMon.getDate() + i);
      const ty = tDay.getFullYear(), tm = String(tDay.getMonth()+1).padStart(2,'0'), td = String(tDay.getDate()).padStart(2,'0');
      chartLabels.push(`${tDay.getDate()}일${dayNames[tDay.getDay()]}`);

      const key = `${ty}-${tm}-${td}`;
      const d = (userData.daily && userData.daily[key]) || { t: 0, s: 0, r: 0 };
      const val = getVal(d);
      mainData.push(val);
      mainDetails.push({ s: d.s, r: d.r });

      const pwDay = new Date(prevWeekStart);
      pwDay.setDate(prevWeekStart.getDate() + i);
      const pwy = pwDay.getFullYear(), pwm = String(pwDay.getMonth()+1).padStart(2,'0'), pwd = String(pwDay.getDate()).padStart(2,'0');
      const pwKey = `${pwy}-${pwm}-${pwd}`;
      const pwdData = (userData.daily && userData.daily[pwKey]) || { t: 0, s: 0, r: 0 };
      prevWeekData.push(getVal(pwdData));

      const curDayIdx = tDay.getDay();
      const targetPm = getNthWeekDate(pmY, pmM, weekNum, curDayIdx);
      const pmKey = `${targetPm.getFullYear()}-${String(targetPm.getMonth()+1).padStart(2,'0')}-${String(targetPm.getDate()).padStart(2,'0')}`;
      const pmData = (userData.daily && userData.daily[pmKey]) || { t: 0, s: 0, r: 0 };
      prevMonthData.push(getVal(pmData));

      const targetLy = getNthWeekDate(lyY, lyM, weekNum, curDayIdx);
      const lyKey = `${targetLy.getFullYear()}-${String(targetLy.getMonth()+1).padStart(2,'0')}-${String(targetLy.getDate()).padStart(2,'0')}`;
      const lyData = (userData.daily && userData.daily[lyKey]) || { t: 0, s: 0, r: 0 };
      lastYearData.push(getVal(lyData));
    }
  }

  // ------------------------------------------------
  // 2. 차트 그리기 설정
  // ------------------------------------------------
  const isYearly = (currentRange === '1Y');
  
  const barGradient = ctx.createLinearGradient(0, 0, 0, 400);
  barGradient.addColorStop(0, '#3b82f6'); 
  barGradient.addColorStop(1, '#93c5fd'); 
  const lineGradient = ctx.createLinearGradient(0, 0, 0, 400);
  lineGradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); 
  lineGradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

  let finalDatasets = [];

  if (isYearly) {
    finalDatasets.push({
      type: 'line', label: '올해 (2025)', data: mainData, customDetails: mainDetails,
      borderColor: '#3b82f6', backgroundColor: lineGradient, borderWidth: 3, tension: 0.4, fill: true,
      pointRadius: 4, pointBackgroundColor: 'white', pointBorderColor: '#3b82f6'
    });
  } else {
    finalDatasets.push({
      type: 'bar', label: '매출', data: mainData, customDetails: mainDetails,
      backgroundColor: barGradient, borderRadius: 6, barPercentage: 0.5, maxBarThickness: 35, order: 3
    });
  }

  if (currentRange === '1D') {
      finalDatasets.push({
          type: 'line', label: '지난주', data: prevWeekData, 
          borderColor: '#9ca3af', borderWidth: 2, borderDash: [5, 5], tension: 0.3, pointRadius: 0, fill: false, order: 4
      });
      finalDatasets.push({ type: 'line', label: '전월 동기', data: prevMonthData, hidden: true });
      finalDatasets.push({ type: 'line', label: '작년 동기', data: lastYearData, hidden: true });
  } else {
      if (currentRange === '1M' || currentRange === '1Y') {
        finalDatasets.push({
          type: 'line', label: '전월 동기', data: prevMonthData,
          borderColor: '#c084fc', borderWidth: 2, tension: 0, pointRadius: 0, fill: false, spanGaps: true, 
          hidden: currentRange === '1Y', order: 2
        });
      }
      finalDatasets.push({
        type: 'line', label: '작년 동기', data: lastYearData,
        borderColor: '#9ca3af', borderWidth: 2, borderDash: [5, 5], tension: 0.3, pointRadius: 0, fill: false,
        hidden: false, order: 4
      });
  }

  // ✨ [요약 알림판]
  const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
  const currentTotal = sum(mainData);
  const prevTotal = sum(prevMonthData); 
  const lastTotal = sum(lastYearData);

  const prodLabel = currentProduct === 'st' ? '생탁' : (currentProduct === 'rice' ? '우리쌀' : '합계');

  const getDiffHtml = (curr, old, label) => {
      const diff = curr - old;
      let color = diff > 0 ? '#ef4444' : (diff < 0 ? '#3b82f6' : '#9ca3af');
      let icon = diff > 0 ? '▲' : (diff < 0 ? '▼' : '-');
      let val = Math.abs(diff);
      return `<div style="font-size:12px; color:#6b7280; display:flex; align-items:center; gap:4px; margin-top:2px;">
                <span>${label}</span> <span style="color:${color}; font-weight:bold;">${icon} ${val}</span>
              </div>`;
  };

  let summaryTitle = '', summaryContent = '';
  if (currentRange === '1D') {
      summaryTitle = `이번 주 ${prodLabel}`; 
      summaryContent = getDiffHtml(currentTotal, lastTotal, '작년 대비');
  } else if (currentRange === '1M') {
      summaryTitle = `이번 달 ${prodLabel}`; 
      summaryContent = getDiffHtml(currentTotal, prevTotal, '전월 대비') + getDiffHtml(currentTotal, lastTotal, '작년 대비');
  } else {
      summaryTitle = `올해 ${prodLabel}`; 
      summaryContent = getDiffHtml(currentTotal, lastTotal, '작년 대비');
  }

  const container = canvas.parentNode;
  let overlay = container.querySelector('.chart-summary-overlay');
  if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'chart-summary-overlay';
      Object.assign(overlay.style, {
          position: 'absolute', top: '20px', left: '20px', background: 'rgba(255, 255, 255, 0.9)',
          padding: '12px 16px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(229, 231, 235, 0.5)', zIndex: '10', pointerEvents: 'none'
      });
      container.appendChild(overlay);
  }
  overlay.innerHTML = `
      <div style="font-size:12px; color:#6b7280; font-weight:500;">${summaryTitle}</div>
      <div style="font-size:24px; color:#111827; font-weight:800; line-height:1.2;">${currentTotal}<span style="font-size:14px; color:#9ca3af; font-weight:normal;">개</span></div>
      <div style="margin-top:4px;">${summaryContent}</div>
  `;

  salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: chartLabels, datasets: finalDatasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false, external: externalTooltipHandler }
      },
      scales: {
        x: { grid: { display: true, color: 'rgba(200, 200, 200, 0.1)', drawBorder: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
        y: { grid: { display: true, color: 'rgba(200, 200, 200, 0.15)', borderDash: [4, 4], drawBorder: false }, ticks: { color: '#9ca3af' }, beginAtZero: true, grace: '50%' }
      }
    }
  });
}
