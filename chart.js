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
// 📊 [chart.js] 차트 그리기 함수 (최종_디자인 픽스.ver)
// - 1Y: 예전처럼 속이 꽉 찬 '영역 그래프'로 원상복구 🌊
// - 1M/1D: 막대는 0을 표시하되, 선은 0을 건너뛰고 꼭대기만 연결 🚀
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
  let mainData = [];      // 막대용 (0도 포함)
  let trendData = [];     // ✨ 선 연결용 (0은 제거 -> null)
  let compareData = [];   // 작년 비교용

  // ============================
  // 1. 데이터 가공
  // ============================
  if (currentRange === '1Y') {
      // [1Y] 연간 데이터 (기존 유지)
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
      // 1Y는 트렌드 라인을 따로 안 쓰므로 mainData와 동일하게 취급하거나 비워둠
      trendData = mainData; 

  } else if (currentRange === '1M') {
      // [1M] 월간 데이터
      const y = baseDate.getFullYear(); const m = baseDate.getMonth() + 1;
      if(dateDisplay) dateDisplay.textContent = `${y}.${String(m).padStart(2,'0')}`;
      const lastDay = new Date(y, m, 0).getDate();
      
      for (let i = 1; i <= lastDay; i++) {
          chartLabels.push(`${i}일`);
          
          const key = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          let val = (userData.daily && userData.daily[key]) || 0;
          
          mainData.push(val); // 막대는 0이어도 자리는 차지해야 함
          trendData.push(val === 0 ? null : val); // ✨ 선은 0이면 '없음(null)' 처리 -> 바닥 안 찍음

          const pKey = `${y-1}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          compareData.push((userData.daily && userData.daily[pKey]) || 0);
      }

  } else if (currentRange === '1D') {
      // [1D] 주간 데이터
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
          let val = (userData.daily && userData.daily[key]) || 0;

          mainData.push(val);
          trendData.push(val === 0 ? null : val); // ✨ 여기도 0은 null 처리

          const lDay = new Date(lastYearMon); lDay.setDate(lastYearMon.getDate() + i);
          const ly = lDay.getFullYear(), lm = String(lDay.getMonth()+1).padStart(2,'0'), ld = String(lDay.getDate()).padStart(2,'0');
          compareData.push((userData.daily && userData.daily[`${ly}-${lm}-${ld}`]) || 0);
      }
  }

  // ============================================
  // 🎨 [차트 디자인] 1Y 원상복구 & 1M/1D 콤보 개선
  // ============================================
  const isYearly = (currentRange === '1Y');
  
  // 1Y용 그라데이션 (파란색 영역)
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); 
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)'); 

  let finalDatasets = [];

  if (isYearly) {
      // 🌊 [1Y 스타일] 사장님이 원하시던 '원조' 영역 그래프
      finalDatasets.push({
          type: 'line',
          label: '올해 (2025)',
          data: mainData,
          borderColor: '#3b82f6',
          backgroundColor: gradient, // 그라데이션 부활
          borderWidth: 3,
          tension: 0.4, // 부드러운 곡선
          fill: true,   // ✨ 속 채우기 (Area Chart)
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#3b82F6',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
      });
  } else {
      // 📊 [1M / 1D 스타일] 막대 + 끊김 없는 연결선
      
      // (1) 둥근 막대 (Bar)
      finalDatasets.push({
          type: 'bar',
          label: '매출',
          data: mainData,
          backgroundColor: '#3b82f6',
          borderRadius: 4,
          barPercentage: 0.6,
          maxBarThickness: 30,
          order: 2
      });

      // (2) 상단 연결 선 (Trend Line)
      finalDatasets.push({
          type: 'line',
          label: '추세',
          data: trendData, // ✨ 0이 없는(null) 데이터 사용
          borderColor: '#2563eb',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: 'white',
          pointBorderColor: '#2563eb',
          fill: false,
          spanGaps: true, // ✨ [핵심] null인 구간(0인 날)을 점프해서 선을 이어줌!
          order: 1
      });
  }

  // (3) 작년 비교 데이터 (공통 - 점선)
  finalDatasets.push({
      type: 'line',
      label: '작년 동기',
      data: compareData,
      borderColor: '#9ca3af',
      borderWidth: 2,
      borderDash: [5, 5],
      tension: 0.3,
      pointRadius: 0,
      fill: false,
      hidden: currentRange === '1D',
      order: 3
  });

  // 차트 생성
  salesChartInstance = new Chart(ctx, {
    type: 'line', // 기본 타입
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
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          padding: 10,
          cornerRadius: 6,
          displayColors: false,
          // 툴팁 필터: '추세' 선은 툴팁에서 제외 (막대랑 겹치니까)
          filter: function(tooltipItem) { 
              return tooltipItem.raw > 0 && tooltipItem.dataset.label !== '추세'; 
          },
          callbacks: {
              label: function(context) { 
                  return context.dataset.label + ': ' + context.parsed.y.toLocaleString(); 
              }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(200, 200, 200, 0.1)', drawBorder: false },
          ticks: { color: '#9ca3af', font: { size: 11 } } 
        },
        y: {
          grid: { color: 'rgba(200, 200, 200, 0.1)', borderDash: [4, 4], drawBorder: false },
          ticks: { color: '#9ca3af' },
          beginAtZero: true,
          grace: '10%' 
        }
      }
    }
  });
}
