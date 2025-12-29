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
// 🎨 [커스텀 툴팁] 1. 툴팁 엘리먼트 생성/가져오기
// ============================================================
const getOrCreateTooltip = (chart) => {
  let tooltipEl = chart.canvas.parentNode.querySelector('div.chartjs-tooltip');

  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.classList.add('chartjs-tooltip');
    tooltipEl.style.background = 'rgba(17, 24, 39, 0.95)';
    tooltipEl.style.borderRadius = '8px';
    tooltipEl.style.color = 'white';
    tooltipEl.style.opacity = 1;
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.transform = 'translate(-50%, 0)';
    tooltipEl.style.transition = 'all .1s ease';
    tooltipEl.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
    tooltipEl.style.zIndex = '100';
    tooltipEl.style.minWidth = '220px'; // 너비 확보

    const table = document.createElement('table');
    table.style.margin = '0px';

    tooltipEl.appendChild(table);
    chart.canvas.parentNode.appendChild(tooltipEl);
  }

  return tooltipEl;
};

// ============================================================
// 🎨 [커스텀 툴팁] 3가지 비교 (이번달 vs 전달 vs 작년)
// ============================================================
const getOrCreateTooltip = (chart) => {
  let tooltipEl = chart.canvas.parentNode.querySelector('div.chartjs-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.classList.add('chartjs-tooltip');
    tooltipEl.style.background = 'rgba(17, 24, 39, 0.95)'; // 진한 남색 배경
    tooltipEl.style.borderRadius = '8px';
    tooltipEl.style.color = 'white';
    tooltipEl.style.opacity = 1;
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.transform = 'translate(-50%, 0)';
    tooltipEl.style.transition = 'all .1s ease';
    tooltipEl.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
    tooltipEl.style.zIndex = '100';
    tooltipEl.style.minWidth = '260px'; // 너비 넉넉하게
    const table = document.createElement('table');
    table.style.margin = '0px';
    tooltipEl.appendChild(table);
    chart.canvas.parentNode.appendChild(tooltipEl);
  }
  return tooltipEl;
};

const externalTooltipHandler = (context) => {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltip(chart);

  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  if (tooltip.body) {
    const idx = tooltip.dataPoints[0].dataIndex;
    
    // 데이터셋 찾기 (순서가 바뀌어도 이름으로 찾음)
    const datasets = chart.data.datasets;
    const currentSet = datasets.find(d => d.label === '매출' || d.label.includes('올해') || d.label === '선택 기간');
    const prevMonthSet = datasets.find(d => d.label === '전월 동기'); // 지난달
    const lastYearSet = datasets.find(d => d.label === '작년 동기'); // 작년

    // 데이터 추출 (없으면 0)
    const currVal = currentSet ? currentSet.data[idx] : 0;
    const prevVal = prevMonthSet ? prevMonthSet.data[idx] : 0;
    const lastVal = lastYearSet ? lastYearSet.data[idx] : 0;

    const currDetails = (currentSet && currentSet.customDetails) ? currentSet.customDetails[idx] : { s:0, r:0 };

    // 증감 계산 함수
    const getDiffHtml = (base, target) => {
        const diff = base - target;
        if(diff > 0) return `<span style="color:#ef4444; font-weight:bold;">▲ ${diff}</span>`; // 빨강 (증가)
        if(diff < 0) return `<span style="color:#3b82f6; font-weight:bold;">▼ ${Math.abs(diff)}</span>`; // 파랑 (감소)
        return `<span style="color:#9ca3af;">-</span>`;
    };

    const diffPrev = getDiffHtml(currVal, prevVal); // 전월 대비
    const diffYear = getDiffHtml(currVal, lastVal); // 작년 대비

    const title = chart.data.labels[idx]; // 날짜 (예: 12일)

    // ✨ HTML 조립: [좌: 이번달 상세] | [우: 비교 분석]
    const innerHtml = `
      <div style="padding: 14px;">
        <div style="font-weight: bold; font-size: 15px; margin-bottom: 10px; border-bottom: 1px solid #374151; padding-bottom: 6px; color: #f3f4f6;">
          ${title} 현황
        </div>
        
        <div style="display: flex; gap: 16px;">
          
          <div style="flex: 1; min-width: 90px;">
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">이번 매출</div>
            <div style="font-size: 12px; color: #d1d5db; display: flex; justify-content: space-between;">
              <span>생탁</span> <span style="color:white;">${currDetails.s}</span>
            </div>
            <div style="font-size: 12px; color: #d1d5db; display: flex; justify-content: space-between;">
              <span>우리쌀</span> <span style="color:white;">${currDetails.r}</span>
            </div>
            <div style="margin-top: 8px; font-size: 18px; font-weight: 800; color: #60a5fa; text-align: right;">
              ${currVal}개
            </div>
          </div>

          <div style="width: 1px; background: #4b5563;"></div>

          <div style="flex: 1.2;">
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">성과 비교</div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 12px; color: #c084fc;">전월(${prevVal})</span>
              <span style="font-size: 12px;">${diffPrev}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: #9ca3af;">작년(${lastVal})</span>
              <span style="font-size: 12px;">${diffYear}</span>
            </div>
          </div>

        </div>
      </div>
    `;

    const tableRoot = tooltipEl.querySelector('table');
    tableRoot.innerHTML = innerHtml;
  }

  const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
  tooltipEl.style.opacity = 1;
  tooltipEl.style.left = positionX + tooltip.caretX + 'px';
  tooltipEl.style.top = positionY + tooltip.caretY + 'px';
};

// ============================================================
// 📊 [chart.js] 차트 그리기 함수 (최종_전월비교+커스텀툴팁.ver)
// ============================================================
// [chart.js] 차트 데이터 처리 및 그리기 함수
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

  let chartLabels = [];
  
  // 데이터셋 4개 준비 (이번달, 추세선, 지난달, 작년)
  let mainData = []; 
  let mainDetails = []; 
  let trendData = [];
  let prevMonthData = []; // 지난달 (보라색)
  let lastYearData = [];  // 작년 (회색)

  // ------------------------------------------------
  // 데이터 가공 로직
  // ------------------------------------------------
  if (currentRange === '1Y') {
    // [1Y] 연간 (기존 유지)
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
    prevMonthData = Array(12).fill(null); // 연간은 전월비교 생략

  } else if (currentRange === '1M') {
    // [1M] 월간 (3단 비교 핵심!)
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth() + 1;
    if (dateDisplay) dateDisplay.textContent = `${y}.${String(m).padStart(2,'0')}`;

    const lastDay = new Date(y, m, 0).getDate();

    // 지난달 날짜 계산 (1월이면 작년 12월로)
    const prevDate = new Date(y, m - 2, 1);
    const pmY = prevDate.getFullYear();
    const pmM = prevDate.getMonth() + 1;

    for (let i = 1; i <= lastDay; i++) {
      chartLabels.push(`${i}일`);

      // 1. 이번 달 (파랑)
      const key = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const d = (userData.daily && userData.daily[key]) || { t: 0, s: 0, r: 0 };
      mainData.push(d.t);
      mainDetails.push({ s: d.s, r: d.r });
      trendData.push(d.t === 0 ? null : d.t);

      // 2. 지난 달 (보라)
      const pmKey = `${pmY}-${String(pmM).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const pmData = (userData.daily && userData.daily[pmKey]) || { t: 0 };
      prevMonthData.push(pmData.t);

      // 3. 작년 동기 (회색)
      const lyKey = `${y-1}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const lyData = (userData.daily && userData.daily[lyKey]) || { t: 0 };
      lastYearData.push(lyData.t);
    }

  } else if (currentRange === '1D') {
    // [1D] 주간 (기존 유지)
    const today = new Date();
    const diffToMon = (today.getDay() === 0 ? -6 : 1) - today.getDay();
    const thisMon = new Date(today);
    thisMon.setDate(today.getDate() + diffToMon);
    
    // 작년 같은 주
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

      // 작년 비교
      const lDay = new Date(lyMon);
      lDay.setDate(lyMon.getDate() + i);
      const lKey = `${lDay.getFullYear()}-${String(lDay.getMonth()+1).padStart(2,'0')}-${String(lDay.getDate()).padStart(2,'0')}`;
      const ld = (userData.daily && userData.daily[lKey]) || { t: 0 };
      lastYearData.push(ld.t);
      
      prevMonthData.push(null); // 주간은 전월비교 생략
    }
  }

  // ------------------------------------------------
  // 차트 디자인 설정
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
    
    // [월간/주간] 추세선 (직선)
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

  // [전월 동기] 보라색 실선 (1M 전용)
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

  // [작년 동기] 회색 점선 (공통)
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
  // 2. 차트 생성 및 옵션 설정 (가독성 개선)
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
        legend: {
          display: false
        },
        tooltip: {
          enabled: false,
          external: externalTooltipHandler // 커스텀 툴팁 연결
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#9ca3af',
            font: {
              size: 11
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(200, 200, 200, 0.15)',
            borderDash: [4, 4],
            drawBorder: false
          },
          ticks: {
            color: '#9ca3af'
          },
          beginAtZero: true,
          grace: '60%'
        }
      }
    }
  });
}
