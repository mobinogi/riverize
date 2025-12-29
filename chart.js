// ==========================================
// chart.js (최종: 1D 고정주간 + 작년비교)
// ==========================================

// 전역 변수
let salesChartInstance = null;
let dashboardData = {}; 
let currentRange = '1Y'; 

// 현재 보고 있는 기준 날짜 (1M, 1Y용)
let baseDate = new Date(); 

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
}

// ----------------------------------------------------
// 2. 날짜 제어 & 버튼 로직
// ----------------------------------------------------

function changeChartRange(range) {
    currentRange = range;
    
    // 1D일 때는 날짜 이동 버튼 숨기기 (고정 주간이므로)
    const navControl = document.getElementById('dateNavControl');
    if (navControl) {
        if (range === '1D') navControl.classList.add('hidden');
        else navControl.classList.remove('hidden');
    }

    // 버튼 스타일 업데이트
    ['1d', '1m', '1y'].forEach(r => {
        const btn = document.getElementById(`btn-${r}`);
        if (btn) {
            btn.className = (r.toUpperCase() === range) 
                ? "px-3 py-1.5 rounded-md bg-white dark:bg-gray-700 text-blue-600 shadow-sm transition-all font-bold"
                : "px-3 py-1.5 rounded-md transition-all text-gray-500 hover:text-gray-900 dark:text-gray-400";
        }
    });

    // 1D로 오면 baseDate를 오늘로 리셋 (항상 이번주 보기)
    if (range === '1D') baseDate = new Date();

    updateDashboardChart();
}

function moveDate(delta) {
    if (currentRange === '1Y') {
        baseDate.setFullYear(baseDate.getFullYear() + delta);
    } else if (currentRange === '1M') {
        baseDate.setMonth(baseDate.getMonth() + delta);
    } 
    // 1D는 이동 불가 (버튼이 숨겨짐)
    
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
// 🎨 [커스텀 툴팁] 2. 내용 채우기 & 꼬리 방향 조종
// ============================================================
const externalTooltipHandler = (context) => {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltip(chart);
  const arrowEl = tooltipEl.querySelector('.tooltip-arrow'); // 꼬리 가져오기

  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  if (tooltip.body) {
    const idx = tooltip.dataPoints[0].dataIndex;
    const datasets = chart.data.datasets;

    // 데이터셋 & 값 찾기
    const currentSet = datasets.find(d => d.label === '매출' || d.label.includes('올해') || d.label === '선택 기간');
    const prevMonthSet = datasets.find(d => d.label === '전월 동기');
    const lastYearSet = datasets.find(d => d.label === '작년 동기');

    const currVal = currentSet ? currentSet.data[idx] : 0;
    const prevVal = prevMonthSet ? prevMonthSet.data[idx] : 0;
    const lastVal = lastYearSet ? lastYearSet.data[idx] : 0;
    const currDetails = (currentSet && currentSet.customDetails) ? currentSet.customDetails[idx] : { s: 0, r: 0 };

    // 증감 표시
    const getDiffHtml = (base, target) => {
      const diff = base - target;
      if (diff > 0) return `<span style="color:#ef4444; font-weight:bold;">▲${diff}</span>`;
      if (diff < 0) return `<span style="color:#3b82f6; font-weight:bold;">▼${Math.abs(diff)}</span>`;
      return `<span style="color:#9ca3af;">-</span>`;
    };

    const diffPrev = getDiffHtml(currVal, prevVal);
    const diffYear = getDiffHtml(currVal, lastVal);
    const title = chart.data.labels[idx];

    // HTML 내용
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
              <span style="font-size: 11px; color: #c084fc;">전월(${prevVal})</span>
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
// 📊 [chart.js] 차트 그리기 함수 (최종_격자복구+요약알림판.ver)
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

  // ------------------------------------------------
  // 1. 데이터 가공 로직
  // ------------------------------------------------
  if (currentRange === '1Y') {
    // [1Y] 연간
    const y = baseDate.getFullYear();
    if (dateDisplay) dateDisplay.textContent = `${y}년`;
    chartLabels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    
    const thisYear = new Date().getFullYear();
    if (y === thisYear) {
      mainData = userData.thisYear;
      mainDetails = userData.thisYearDetails || [];
      lastYearData = userData.lastYear;
    } else if (y === thisYear - 1) {
      mainData = userData.lastYear;
      mainDetails = userData.lastYearDetails || [];
    }
    trendData = mainData;
    prevMonthData = Array(12).fill(null);

  } else if (currentRange === '1M') {
    // [1M] 월간
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth() + 1;
    if (dateDisplay) dateDisplay.textContent = `${y}.${String(m).padStart(2,'0')}`;

    const lastDay = new Date(y, m, 0).getDate();
    const prevDate = new Date(y, m - 2, 1); 
    const pmY = prevDate.getFullYear();
    const pmM = prevDate.getMonth() + 1;

    for (let i = 1; i <= lastDay; i++) {
      chartLabels.push(`${i}일`);

      const key = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const d = (userData.daily && userData.daily[key]) || { t: 0, s: 0, r: 0 };
      mainData.push(d.t);
      mainDetails.push({ s: d.s, r: d.r });
      trendData.push(d.t === 0 ? null : d.t);

      const pmKey = `${pmY}-${String(pmM).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const pmData = (userData.daily && userData.daily[pmKey]) || { t: 0 };
      prevMonthData.push(pmData.t);

      const lyKey = `${y-1}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const lyData = (userData.daily && userData.daily[lyKey]) || { t: 0 };
      lastYearData.push(lyData.t);
    }

  } else if (currentRange === '1D') {
    // [1D] 주간
    const today = new Date();
    const diffToMon = (today.getDay() === 0 ? -6 : 1) - today.getDay();
    const thisMon = new Date(today);
    thisMon.setDate(today.getDate() + diffToMon);
    
    const lyMon = new Date(thisMon);
    lyMon.setFullYear(thisMon.getFullYear() - 1);
    const lyDiff = (lyMon.getDay() === 0 ? -6 : 1) - lyMon.getDay();
    lyMon.setDate(lyMon.getDate() + lyDiff);

    for (let i = 0; i < 6; i++) {
      const tDay = new Date(thisMon);
      tDay.setDate(thisMon.getDate() + i);
      const ty = tDay.getFullYear();
      const tm = String(tDay.getMonth()+1).padStart(2,'0');
      const td = String(tDay.getDate()).padStart(2,'0');
      
      chartLabels.push(`${tDay.getDate()}일${dayNames[tDay.getDay()]}`);

      const key = `${ty}-${tm}-${td}`;
      const d = (userData.daily && userData.daily[key]) || { t: 0, s: 0, r: 0 };
      mainData.push(d.t);
      mainDetails.push({ s: d.s, r: d.r });
      trendData.push(d.t === 0 ? null : d.t);

      const lDay = new Date(lyMon);
      lDay.setDate(lyMon.getDate() + i);
      const lKey = `${lDay.getFullYear()}-${String(lDay.getMonth()+1).padStart(2,'0')}-${String(lDay.getDate()).padStart(2,'0')}`;
      const ld = (userData.daily && userData.daily[lKey]) || { t: 0 };
      lastYearData.push(ld.t);
      
      prevMonthData.push(null);
    }
  }

  // ------------------------------------------------
  // ✨ [NEW] 차트 내 요약 알림판 (Summary Overlay) 생성
  // ------------------------------------------------
  // 1. 합계 계산 함수
  const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
  
  const currentTotal = sum(mainData);
  const prevTotal = sum(prevMonthData);
  const lastTotal = sum(lastYearData);

  // 2. 증감 HTML 생성 함수
  const getDiffHtml = (curr, old, label) => {
      const diff = curr - old;
      let color = diff > 0 ? '#ef4444' : (diff < 0 ? '#3b82f6' : '#9ca3af');
      let icon = diff > 0 ? '▲' : (diff < 0 ? '▼' : '-');
      let val = Math.abs(diff);
      return `<div style="font-size:12px; color:#6b7280; display:flex; align-items:center; gap:4px; margin-top:2px;">
                <span>${label}</span> 
                <span style="color:${color}; font-weight:bold;">${icon} ${val}</span>
              </div>`;
  };

  // 3. 내용 조립
  let summaryTitle = '';
  let summaryContent = '';
  
  if (currentRange === '1D') {
      summaryTitle = '이번 주 합계';
      summaryContent = getDiffHtml(currentTotal, lastTotal, '작년 대비');
  } else if (currentRange === '1M') {
      summaryTitle = '이번 달 합계';
      summaryContent = getDiffHtml(currentTotal, prevTotal, '전월 대비') + 
                       getDiffHtml(currentTotal, lastTotal, '작년 대비');
  } else {
      summaryTitle = '올해 합계';
      summaryContent = getDiffHtml(currentTotal, lastTotal, '작년 대비');
  }

  // 4. HTML 요소 만들어서 차트 위에 띄우기
  const container = canvas.parentNode;
  let overlay = container.querySelector('.chart-summary-overlay');
  
  if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'chart-summary-overlay';
      // 스타일 설정 (차트 왼쪽 상단에 띄움)
      Object.assign(overlay.style, {
          position: 'absolute',
          top: '20px',
          left: '20px', // 왼쪽 상단 고정
          background: 'rgba(255, 255, 255, 0.9)', // 반투명 흰색
          padding: '12px 16px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(229, 231, 235, 0.5)',
          zIndex: '10',
          pointerEvents: 'none' // 마우스 통과 (차트 툴팁 방해 안 하도록)
      });
      container.appendChild(overlay);
  }

  overlay.innerHTML = `
      <div style="font-size:12px; color:#6b7280; font-weight:500;">${summaryTitle}</div>
      <div style="font-size:24px; color:#111827; font-weight:800; line-height:1.2;">${currentTotal}<span style="font-size:14px; color:#9ca3af; font-weight:normal;">개</span></div>
      <div style="margin-top:4px;">${summaryContent}</div>
  `;


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
    // [연간] 영역 그래프
    finalDatasets.push({
      type: 'line',
      label: '올해 (2025)',
      data: mainData,
      customDetails: mainDetails,
      borderColor: '#3b82f6',
      backgroundColor: lineGradient,
      borderWidth: 3,
      tension: 0.4,
      fill: true,
      pointRadius: 4,
      pointBackgroundColor: 'white',
      pointBorderColor: '#3b82f6'
    });
  } else {
    // [월간/주간] 막대 그래프
    finalDatasets.push({
      type: 'bar',
      label: '매출',
      data: mainData,
      customDetails: mainDetails,
      backgroundColor: barGradient,
      borderRadius: 6,
      barPercentage: 0.5,
      maxBarThickness: 35,
      order: 3
    });
    
    // [월간/주간] 추세선
    finalDatasets.push({
      type: 'line',
      label: '추세',
      data: trendData,
      borderColor: '#2563eb',
      borderWidth: 2,
      tension: 0,
      spanGaps: true,
      pointRadius: 4,
      pointBackgroundColor: 'white',
      pointBorderColor: '#2563eb',
      order: 1
    });
  }

  if (currentRange === '1M') {
    finalDatasets.push({
      type: 'line',
      label: '전월 동기',
      data: prevMonthData,
      borderColor: '#c084fc',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 0,
      fill: false,
      order: 2
    });
  }

  finalDatasets.push({
    type: 'line',
    label: '작년 동기',
    data: lastYearData,
    borderColor: '#9ca3af',
    borderWidth: 2,
    borderDash: [5, 5],
    tension: 0.3,
    pointRadius: 0,
    fill: false,
    hidden: currentRange === '1D',
    order: 4
  });

  // ------------------------------------------------
  // 3. 차트 생성 (격자 무늬 복구!)
  // ------------------------------------------------
  salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: finalDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external: externalTooltipHandler
        }
      },
      scales: {
        x: {
          // 🚨 [격자 복구] 세로선(Grid) 부활!
          grid: { 
              display: true, 
              color: 'rgba(200, 200, 200, 0.1)', // 아주 연하게
              drawBorder: false 
          },
          ticks: { color: '#9ca3af', font: { size: 11 } }
        },
        y: {
          // 🚨 [격자 복구] 가로선(Grid) 부활!
          grid: {
            display: true,
            color: 'rgba(200, 200, 200, 0.15)', // 연한 회색 점선
            borderDash: [4, 4],
            drawBorder: false
          },
          ticks: { color: '#9ca3af' },
          beginAtZero: true,
          grace: '60%'
        }
      }
    }
  });
}
