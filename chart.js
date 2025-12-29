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
// 📊 [chart.js] 차트 그리기 함수 (최종_디자인_프리미엄.ver)
// - 1Y: 부드러운 영역 곡선 (기존 유지)
// - 1M/1D: 빨랫줄 현상 제거(직선 연결) + 막대 그라데이션 적용 ✨
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
  let trendData = [];     
  let compareData = [];   

  // ============================
  // 1. 데이터 가공 (로직 동일)
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
      trendData = mainData; 

  } else if (currentRange === '1M') {
      const y = baseDate.getFullYear(); const m = baseDate.getMonth() + 1;
      if(dateDisplay) dateDisplay.textContent = `${y}.${String(m).padStart(2,'0')}`;
      const lastDay = new Date(y, m, 0).getDate();
      for (let i = 1; i <= lastDay; i++) {
          chartLabels.push(`${i}일`);
          const key = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          let val = (userData.daily && userData.daily[key]) || 0;
          mainData.push(val); 
          trendData.push(val === 0 ? null : val); // 선 연결용 (0은 null)
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
          const key = `${ty}-${tm}-${td}`;
          let val = (userData.daily && userData.daily[key]) || 0;
          mainData.push(val);
          trendData.push(val === 0 ? null : val); 
          const lDay = new Date(lastYearMon); lDay.setDate(lastYearMon.getDate() + i);
          const ly = lDay.getFullYear(), lm = String(lDay.getMonth()+1).padStart(2,'0'), ld = String(lDay.getDate()).padStart(2,'0');
          compareData.push((userData.daily && userData.daily[`${ly}-${lm}-${ld}`]) || 0);
      }
  }

  // ============================================
  // 🎨 [디자인 업그레이드] 그라데이션 & 스타일
  // ============================================
  const isYearly = (currentRange === '1Y');
  
  // 1. 선 차트용 배경 그라데이션 (1Y용)
  const lineGradient = ctx.createLinearGradient(0, 0, 0, 400);
  lineGradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); 
  lineGradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)'); 

  // 2. ✨ [NEW] 막대 차트용 그라데이션 (1M/1D용) - 위는 진하고 아래는 연하게
  const barGradient = ctx.createLinearGradient(0, 0, 0, 400);
  barGradient.addColorStop(0, '#3b82f6'); // 위: 파란색
  barGradient.addColorStop(1, '#93c5fd'); // 아래: 연한 파란색

  let finalDatasets = [];

  if (isYearly) {
      // [1Y] 연간: 부드러운 영역 곡선 (기존 유지)
      finalDatasets.push({
          type: 'line',
          label: '올해 (2025)',
          data: mainData,
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
      // [1M / 1D] 막대 + 직선 연결 (콤보 차트)
      
      // (1) 둥근 막대 (그라데이션 적용 ✨)
      finalDatasets.push({
          type: 'bar',
          label: '매출',
          data: mainData,
          backgroundColor: barGradient, // ✨ 단색 대신 그라데이션 사용
          borderRadius: 6,      // 더 둥글게
          borderSkipped: false, // 밑부분도 살짝 둥글게 처리 (취향)
          barPercentage: 0.5,   // 막대 두께 살짝 얇게 (세련됨)
          maxBarThickness: 35,
          order: 2
      });

      // (2) 상단 연결 선 (직선으로 팽팽하게! 📏)
      finalDatasets.push({
          type: 'line',
          label: '추세',
          data: trendData,
          borderColor: '#2563eb', // 막대보다 진한 파랑
          borderWidth: 2,
          
          // 🚨 [핵심 변경] tension을 0으로 설정해서 축 늘어지는 곡선 제거!
          tension: 0, 
          
          pointRadius: 4,         // 점 크기 살짝 키움
          pointBackgroundColor: '#ffffff', // 속은 하얗게
          pointBorderColor: '#2563eb',     // 테두리는 파랗게
          pointBorderWidth: 2,
          fill: false,
          spanGaps: true, // 끊긴 구간 연결
          order: 1
      });
  }

  // (3) 작년 비교 데이터 (점선)
  finalDatasets.push({
      type: 'line',
      label: '작년 동기',
      data: compareData,
      borderColor: '#9ca3af', // 회색
      borderWidth: 2,
      borderDash: [5, 5],
      tension: 0.3, // 비교 데이터는 부드럽게 둠 (구분되게)
      pointRadius: 0,
      fill: false,
      hidden: currentRange === '1D',
      order: 3
  });

  // 차트 생성
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
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          padding: 12, // 툴팁 여백 늘림
          cornerRadius: 8,
          titleFont: { size: 13 },
          bodyFont: { size: 13 },
          displayColors: false,
          // '추세' 선은 툴팁에서 숨김
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
          grid: { display: false }, // 세로 격자 삭제 (더 깔끔하게)
          ticks: { color: '#9ca3af', font: { size: 11 } } 
        },
        y: {
          // 가로 격자는 아주 연하게 유지
          grid: { color: 'rgba(200, 200, 200, 0.15)', borderDash: [4, 4], drawBorder: false },
          ticks: { color: '#9ca3af' },
          beginAtZero: true,
          grace: '60%' // 천장 여유 조금 줄임 (막대 꽉 차게)
        }
      }
    }
  });
}
