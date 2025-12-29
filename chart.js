// ==========================================
// 1. 유틸리티 함수 (화면 전환 & 메뉴 활성화)
// ==========================================

function switchView(viewId) {
    const allViews = document.querySelectorAll('.view-content');
    allViews.forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('animate-fade-in'); 
    });

    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('animate-fade-in'); 
    }
}

// ==========================================
// 2. 스켈레톤 UI 제어 (로딩 효과)
// ==========================================

function showSkeleton() {
    const sk = document.getElementById('chartSkeleton');
    const ct = document.getElementById('chartContainer');
    if(sk) sk.classList.remove('hidden'); 
    if(ct) ct.classList.add('hidden');    
}

function hideSkeleton() {
    const sk = document.getElementById('chartSkeleton');
    const ct = document.getElementById('chartContainer');
    if(sk) sk.classList.add('hidden');    
    if(ct) ct.classList.remove('hidden'); 
}

// ==========================================
// 3. 메인 로직 (매출 현황 분석)
// ==========================================

// 전역 변수
let salesChartInstance = null;
let dashboardData = {}; 
let currentRange = '1Y'; // 기본값: 1년

function showSalesDashboard() {
  switchView('dashboard-view');

  if (salesChartInstance) {
      salesChartInstance.destroy();
      salesChartInstance = null;
  }

  showSkeleton();

  callAppsScript('getSalesDashboardData')
    .then(data => {
        initDashboard(data);
    })
    .catch(err => {
        hideSkeleton(); 
        alert("데이터 불러오기 실패: " + err);
    });
}

function initDashboard(response) {
  hideSkeleton();

  if (!response || response.status !== 'success') {
    alert("서버 오류: " + (response.message || "원인 불명"));
    return;
  }

  dashboardData = response.data;
  updateDashboardChart();
}

// ==========================================
// 4. 기간 변경 및 차트 그리기 (핵심)
// ==========================================

// 버튼 클릭 시 실행되는 함수
function changeChartRange(range) {
    currentRange = range;
    
    // 버튼 스타일 업데이트
    ['1d', '1m', '1y'].forEach(r => {
        const btn = document.getElementById(`btn-${r}`);
        if (btn) {
            if (r.toUpperCase() === range) {
                btn.className = "px-3 py-1.5 rounded-md bg-white dark:bg-gray-700 text-blue-600 shadow-sm transition-all font-bold";
            } else {
                btn.className = "px-3 py-1.5 rounded-md transition-all text-gray-500 hover:text-gray-900 dark:text-gray-400";
            }
        }
    });

    // 차트 다시 그리기
    updateDashboardChart();
}

// 실제 차트를 그리는 함수
function updateDashboardChart() {
  const canvas = document.getElementById('salesStatusChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const userSelect = document.getElementById('dashboardUserSelect');
  const selectedUser = userSelect ? userSelect.value : '김원대';

  if (!dashboardData || !dashboardData[selectedUser]) return;
  const userData = dashboardData[selectedUser];

  if (salesChartInstance) salesChartInstance.destroy();

  // 📅 기간별 데이터 가공 (1Y vs 1M vs 1D)
  let chartLabels = [];
  let thisYearData = [];
  let lastYearData = []; 

  if (currentRange === '1Y') {
      // [1년] 1월 ~ 12월
      chartLabels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
      thisYearData = userData.thisYear; 
      lastYearData = userData.lastYear; 

  } else if (currentRange === '1M') {
      // [1달] 이번 달 1일 ~ 말일
      const today = new Date();
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(); 
      chartLabels = Array.from({length: lastDay}, (_, i) => `${i + 1}일`);
      
      thisYearData = chartLabels.map((_, i) => {
          const day = i + 1;
          const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return (userData.daily && userData.daily[dateKey]) ? userData.daily[dateKey] : 0;
      });
      lastYearData = Array(lastDay).fill(null); 

  } else if (currentRange === '1D') {
      // [1일] 최근 7일 추세
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          
          chartLabels.push(`${d.getDate()}일`);
          thisYearData.push((userData.daily && userData.daily[dateKey]) ? userData.daily[dateKey] : 0);
      }
      lastYearData = Array(7).fill(null);
  }

  // 🎨 차트 그리기
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); 
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)'); 

  salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: currentRange === '1Y' ? '올해 (2025)' : '매출',
          data: thisYearData,
          borderColor: '#3b82f6',
          backgroundColor: gradient,
          borderWidth: 3,
          tension: 0.4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#3b82F6',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true
        },
        {
          label: '작년 (2024)',
          data: lastYearData,
          borderColor: '#9ca3af',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 0,
          fill: false,
          hidden: currentRange !== '1Y' 
        }
      ]
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
          caretPadding: 0,
          filter: function(tooltipItem) { return tooltipItem.raw > 0; } 
        }
      },
      scales: {
        x: {
          // ✨ [가로축 격자] 아주 연하게
          grid: { 
              color: 'rgba(200, 200, 200, 0.1)', 
              drawBorder: false 
          },
          ticks: { color: '#9ca3af' } 
        },
        y: {
          // ✨ [세로축 격자] 아주 연하게
          grid: { 
              color: 'rgba(200, 200, 200, 0.1)',
              borderDash: [4, 4], 
              drawBorder: false 
          },
          ticks: { color: '#9ca3af' },
          beginAtZero: true,
          grace: '15%' 
        }
      }
    }
  });
}
