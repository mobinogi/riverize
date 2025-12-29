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
// 📊 [chart.js] 차트 그리기 함수 (최종_막대+선 콤보.ver)
// - 1Y: 선 그래프
// - 1M/1D: 둥근 막대 + 상단 연결 선 그래프 (콤보 차트)
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
  let compareData = []; 

  // ============================
  // 1. 데이터 가공 (기존 로직 유지)
  // ============================
  if (currentRange === '1Y') {
      const y = baseDate.getFullYear();
      if(dateDisplay) dateDisplay.textContent = `${y}년`;
      chartLabels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
      const thisYear = new Date().getFullYear();
      if (y === thisYear) {
          mainData = userData.thisYear; compareData = userData.lastYear; 
      } else if (y === thisYear - 1) {
          mainData = userData.lastYear; compareData = Array(12).fill(null); 
      } else {
          mainData = Array(12).fill(0); compareData = Array(12).fill(0);
      }
  } else if (currentRange === '1M') {
      const y = baseDate.getFullYear(); const m = baseDate.getMonth() + 1;
      if(dateDisplay) dateDisplay.textContent = `${y}.${String(m).padStart(2,'0')}`;
      const lastDay = new Date(y, m, 0).getDate();
      for (let i = 1; i <= lastDay; i++) {
          chartLabels.push(`${i}일`);
          const key = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          mainData.push((userData.daily && userData.daily[key]) || 0);
          const pKey = `${y-1}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          compareData.push((userData.daily && userData.daily[pKey]) || 0);
      }
  } else if (currentRange === '1D') {
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
          mainData.push((userData.daily && userData.daily[`${ty}-${tm}-${td}`]) || 0);

          const lDay = new Date(lastYearMon); lDay.setDate(lastYearMon.getDate() + i);
          const ly = lDay.getFullYear(), lm = String(lDay.getMonth()+1).padStart(2,'0'), ld = String(lDay.getDate()).padStart(2,'0');
          compareData.push((userData.daily && userData.daily[`${ly}-${lm}-${ld}`]) || 0);
      }
  }

  // ============================================
  // 🎨 [핵심] 차트 데이터셋 조립 (콤보 차트 구현)
  // ============================================
  const isYearly = (currentRange === '1Y');
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); 
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)'); 

  let finalDatasets = [];

  // 1️⃣ [기본 데이터] 1Y는 선, 1M/1D는 막대로 그립니다.
  finalDatasets.push({
      type: isYearly ? 'line' : 'bar', // 👈 여기서 타입 결정
      label: '선택 기간',
      data: mainData,
      borderColor: '#3b82f6',
      backgroundColor: isYearly ? gradient : '#3b82f6', // 선이면 그라데이션, 막대면 단색
      borderWidth: isYearly ? 3 : 0,
      tension: 0.4,
      fill: isYearly,
      pointRadius: isYearly ? 4 : 0,
      borderRadius: 4, // 막대 둥글게
      barPercentage: 0.6, maxBarThickness: 30,
      order: 2 // 막대를 뒤에 그림
  });

  // 2️⃣ [작년 비교 데이터] 항상 점선으로 그립니다.
  finalDatasets.push({
      type: 'line',
      label: '작년 동기',
      data: compareData,
      borderColor: '#9ca3af', borderWidth: 2, borderDash: [5, 5],
      tension: 0.3, pointRadius: 0, fill: false,
      hidden: currentRange === '1D', // 1D일 때 숨김 여부 (취향껏 true/false)
      order: 3
  });

  // 3️⃣ [✨추가된 연결 선] 1M/1D일 때만 막대 위에 선을 하나 더 그립니다.
  if (!isYearly) {
      finalDatasets.push({
          type: 'line', // 무조건 선
          label: '추세', // 툴팁에서 걸러낼 이름
          data: mainData, // 똑같은 데이터를 사용
          borderColor: '#2563eb', // 막대보다 살짝 진한 파랑
          borderWidth: 2,
          tension: 0.3, // 부드러운 곡선
          pointRadius: 2, // 연결 부위 작은 점
          pointBackgroundColor: 'white',
          pointBorderColor: '#2563eb',
          fill: false,
          order: 1 // 가장 앞에(위에) 그림
      });
  }

  // 차트 생성
  salesChartInstance = new Chart(ctx, {
    // type을 개별 dataset에서 지정했으므로 여기선 생략 가능하지만, 기본값으로 line핑
    type: 'line', 
    data: {
      labels: chartLabels,
      datasets: finalDatasets // 조립한 데이터셋 사용
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false }, 
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)', padding: 10, cornerRadius: 6, displayColors: false,
          // 툴팁 필터: 값이 0이거나, '추세' 선 데이터는 툴팁에서 제외 (중복 방지)
          filter: function(tooltipItem) { 
              return tooltipItem.raw > 0 && tooltipItem.dataset.label !== '추세'; 
          },
          callbacks: {
              label: function(context) { return context.dataset.label + ': ' + context.parsed.y.toLocaleString(); }
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(200, 200, 200, 0.1)', drawBorder: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
        y: { grid: { color: 'rgba(200, 200, 200, 0.1)', borderDash: [4, 4], drawBorder: false }, ticks: { color: '#9ca3af' }, beginAtZero: true, grace: '10%' }
      }
    }
  });
}
