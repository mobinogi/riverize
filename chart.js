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
// 🎨 [커스텀 툴팁] 2. 실제 내용 채워넣기 (좌우 배치 + 증감 표시)
// ============================================================
const externalTooltipHandler = (context) => {
  // 툴팁 요소 가져오기
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltip(chart);

  // 툴팁 숨겨야 할 때
  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  // 데이터가 있을 때만 렌더링
  if (tooltip.body) {
    const dataIndex = tooltip.dataPoints[0].dataIndex;
    const dataset = tooltip.dataPoints[0].dataset;
    
    // 현재 차트의 데이터셋 가져오기
    const mainSet = chart.data.datasets.find(ds => ds.label === '선택 기간' || ds.label.includes('올해') || ds.label === '매출');
    const compareSet = chart.data.datasets.find(ds => ds.label === '작년 동기' || ds.label === '전월 동기');

    // 상세 데이터 꺼내기
    const currDetails = mainSet.customDetails ? mainSet.customDetails[dataIndex] : { s: 0, r: 0 };
    const prevDetails = compareSet.customDetails ? compareSet.customDetails[dataIndex] : { s: 0, r: 0 };

    const currTotal = mainSet.data[dataIndex] || 0;
    const prevTotal = compareSet.data[dataIndex] || 0;

    // 증감 계산
    const diff = currTotal - prevTotal;
    let diffHtml = '';
    if (diff > 0) diffHtml = `<span style="color: #ef4444; font-weight:bold;">▲ ${diff}개</span>`; // 빨강 (증가)
    else if (diff < 0) diffHtml = `<span style="color: #3b82f6; font-weight:bold;">▼ ${Math.abs(diff)}개</span>`; // 파랑 (감소)
    else diffHtml = `<span style="color: #9ca3af;">변동 없음</span>`;

    // 날짜 제목
    const title = chart.data.labels[dataIndex];
    const compareLabel = compareSet.label; // "전월 동기" or "작년 동기"

    // ✨ [HTML 조립] 좌우 배치 (Flexbox)
    const innerHtml = `
      <div style="padding: 12px;">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #374151; padding-bottom: 4px;">
          ${title}
        </div>
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          
          <div style="flex: 1; text-align: right;">
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 2px;">이번 매출</div>
            <div style="font-size: 12px;">생탁: ${currDetails.s}</div>
            <div style="font-size: 12px;">우리쌀: ${currDetails.r}</div>
            <div style="margin-top: 4px; font-size: 14px; font-weight: 900; color: #60a5fa;">
              ${currTotal}개
            </div>
          </div>

          <div style="width: 1px; background: #4b5563; height: 50px;"></div>

          <div style="flex: 1; text-align: left;">
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 2px;">${compareLabel}</div>
            <div style="font-size: 12px; color: #d1d5db;">생탁: ${prevDetails.s}</div>
            <div style="font-size: 12px; color: #d1d5db;">우리쌀: ${prevDetails.r}</div>
            <div style="margin-top: 4px; font-size: 13px; font-weight: bold; color: #9ca3af;">
              ${prevTotal}개
            </div>
          </div>

        </div>

        <div style="margin-top: 10px; padding-top: 6px; border-top: 1px dashed #374151; text-align: center; font-size: 12px;">
          ${compareLabel} 대비 ${diffHtml}
        </div>
      </div>
    `;

    const tableRoot = tooltipEl.querySelector('table');
    tableRoot.innerHTML = innerHtml;
  }

  // 위치 조정
  const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
  tooltipEl.style.opacity = 1;
  tooltipEl.style.left = positionX + tooltip.caretX + 'px';
  tooltipEl.style.top = positionY + tooltip.caretY + 'px';
};

// ============================================================
// 📊 [chart.js] 차트 그리기 함수 (최종_전월비교+커스텀툴팁.ver)
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

  let chartLabels = [];
  let mainData = [];      
  let mainDetails = [];   
  let trendData = [];     
  let compareData = [];   
  let compareDetails = [];
  let compareLabelName = '작년 동기'; // 기본값

  // ============================
  // 1. 데이터 가공
  // ============================
  if (currentRange === '1Y') {
      const y = baseDate.getFullYear();
      if(dateDisplay) dateDisplay.textContent = `${y}년`;
      chartLabels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
      
      const thisYear = new Date().getFullYear();
      if (y === thisYear) {
          mainData = userData.thisYear; mainDetails = userData.thisYearDetails || [];
          compareData = userData.lastYear; compareDetails = userData.lastYearDetails || [];
      } else if (y === thisYear - 1) {
          mainData = userData.lastYear; mainDetails = userData.lastYearDetails || [];
          compareData = Array(12).fill(0); compareDetails = Array(12).fill({s:0, r:0});
      } else {
          mainData = Array(12).fill(0); mainDetails = Array(12).fill({s:0, r:0});
          compareData = Array(12).fill(0); compareDetails = Array(12).fill({s:0, r:0});
      }
      trendData = mainData; 

  } else if (currentRange === '1M') {
      // 🚨 [핵심 수정] 1M은 '전월(지난달)'과 비교합니다.
      compareLabelName = '전월 동기';
      
      const y = baseDate.getFullYear(); 
      const m = baseDate.getMonth() + 1;
      if(dateDisplay) dateDisplay.textContent = `${y}.${String(m).padStart(2,'0')}`;
      
      const lastDay = new Date(y, m, 0).getDate();
      
      // 전월 계산 (1월이면 작년 12월로)
      const prevDate = new Date(y, m - 2, 1); // JS Month는 0부터 시작하므로 -2가 전월
      const pY = prevDate.getFullYear();
      const pM = prevDate.getMonth() + 1;

      for (let i = 1; i <= lastDay; i++) {
          chartLabels.push(`${i}일`);
          
          // 이번 달 데이터
          const key = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          const dayData = (userData.daily && userData.daily[key]) || { t: 0, s: 0, r: 0 };
          
          mainData.push(dayData.t);
          mainDetails.push({ s: dayData.s, r: dayData.r });
          trendData.push(dayData.t === 0 ? null : dayData.t);

          // 전월 데이터 (비교용)
          const pKey = `${pY}-${String(pM).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          const pData = (userData.daily && userData.daily[pKey]) || { t: 0, s: 0, r: 0 };
          
          compareData.push(pData.t);
          compareDetails.push({ s: pData.s, r: pData.r });
      }

  } else if (currentRange === '1D') {
      compareLabelName = '작년 동기'; // 1D는 작년 유지 (요일 매칭 때문)
      
      const today = new Date(); const dayNum = today.getDay(); 
      const diffToMon = (dayNum === 0 ? -6 : 1) - dayNum;
      const thisMon = new Date(today); thisMon.setDate(today.getDate() + diffToMon); 
      const lastYearMon = new Date(thisMon); lastYearMon.setFullYear(thisMon.getFullYear() - 1);
      const lyDiff = (lastYearMon.getDay() === 0 ? -6 : 1) - lastYearMon.getDay();
      lastYearMon.setDate(lastYearMon.getDate() + lyDiff);

      for (let i = 0; i < 6; i++) {
          const tDay = new Date(thisMon); tDay.setDate(thisMon.getDate() + i);
          const ty = tDay.getFullYear(), tm = String(tDay.getMonth()+1).padStart(2,'0'), td = String(tDay.getDate()).padStart(2,'0');
          chartLabels.push(`${tDay.getDate()}일${dayNames[tDay.getDay()]}`);
          
          const key = `${ty}-${tm}-${td}`;
          const dayData = (userData.daily && userData.daily[key]) || { t: 0, s: 0, r: 0 };
          
          mainData.push(dayData.t);
          mainDetails.push({ s: dayData.s, r: dayData.r });
          trendData.push(dayData.t === 0 ? null : dayData.t);

          const lDay = new Date(lastYearMon); lDay.setDate(lastYearMon.getDate() + i);
          const ly = lDay.getFullYear(), lm = String(lDay.getMonth()+1).padStart(2,'0'), ld = String(lDay.getDate()).padStart(2,'0');
          const lKey = `${ly}-${lm}-${ld}`;
          const lData = (userData.daily && userData.daily[lKey]) || { t: 0, s: 0, r: 0 };
          
          compareData.push(lData.t);
          compareDetails.push({ s: lData.s, r: lData.r });
      }
  }

  // ============================================
  // 🎨 [차트 생성]
  // ============================================
  const isYearly = (currentRange === '1Y');
  
  const lineGradient = ctx.createLinearGradient(0, 0, 0, 400);
  lineGradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); 
  lineGradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)'); 
  
  const barGradient = ctx.createLinearGradient(0, 0, 0, 400);
  barGradient.addColorStop(0, '#3b82f6'); 
  barGradient.addColorStop(1, '#93c5fd'); 

  let finalDatasets = [];

  if (isYearly) {
      finalDatasets.push({
          type: 'line',
          label: '선택 기간',
          data: mainData,
          customDetails: mainDetails,
          borderColor: '#3b82f6',
          backgroundColor: lineGradient,
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#3b82F6',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
      });
  } else {
      finalDatasets.push({
          type: 'bar',
          label: '매출',
          data: mainData,
          customDetails: mainDetails,
          backgroundColor: barGradient,
          borderRadius: 6,
          barPercentage: 0.5,
          maxBarThickness: 35,
          order: 2
      });
      finalDatasets.push({
          type: 'line',
          label: '추세',
          data: trendData,
          borderColor: '#2563eb',
          borderWidth: 2,
          tension: 0, 
          pointRadius: 4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#2563eb',
          pointBorderWidth: 2,
          fill: false,
          spanGaps: true,
          order: 1
      });
  }

  finalDatasets.push({
      type: 'line',
      label: compareLabelName, // "전월 동기" or "작년 동기"
      data: compareData,
      customDetails: compareDetails, 
      borderColor: '#9ca3af',
      borderWidth: 2,
      borderDash: [5, 5],
      tension: 0.3,
      pointRadius: 0,
      fill: false,
      hidden: currentRange === '1D',
      order: 3
  });

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
        intersect: false,
      },
      plugins: {
        legend: { display: false }, 
        
        // 🚨 [핵심] 커스텀 HTML 툴팁 적용
        tooltip: {
          enabled: false, // 기본 툴팁 끄기
          external: externalTooltipHandler // 우리가 만든 툴팁 연결
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { size: 11 } } 
        },
        y: {
          grid: { color: 'rgba(200, 200, 200, 0.15)', borderDash: [4, 4], drawBorder: false },
          ticks: { color: '#9ca3af' },
          beginAtZero: true,
          grace: '60%' 
        }
      }
    }
  });
}
