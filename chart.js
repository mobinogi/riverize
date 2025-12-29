// ==========================================
// 1. 유틸리티 함수 (화면 전환 & 메뉴 활성화)
// ==========================================

// 화면 전환 함수 (기존의 복잡한 querySelector 코드를 이걸로 대체)
function switchView(viewId) {
    // 1. 모든 화면 숨기기
    const allViews = document.querySelectorAll('.view-content');
    allViews.forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('animate-fade-in'); // 애니메이션 효과 리셋
    });

    // 2. 원하는 화면만 보이기
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('animate-fade-in'); // 부드럽게 등장
    }
}

// ==========================================
// 2. 스켈레톤 UI 제어 (로딩 효과)
// ==========================================

function showSkeleton() {
    const sk = document.getElementById('chartSkeleton');
    const ct = document.getElementById('chartContainer');
    if(sk) sk.classList.remove('hidden'); // 뼈대 보이기
    if(ct) ct.classList.add('hidden');    // 차트 숨기기
}

function hideSkeleton() {
    const sk = document.getElementById('chartSkeleton');
    const ct = document.getElementById('chartContainer');
    if(sk) sk.classList.add('hidden');    // 뼈대 숨기기
    if(ct) ct.classList.remove('hidden'); // 차트 보이기
}

// ==========================================
// 3. 메인 로직 (매출 현황 분석)
// ==========================================

// 전역 변수: 차트 객체와 데이터를 담아둘 곳
let salesChartInstance = null;
let currentRange = '1Y';
let dashboardData = {}; 

// 👉 [사장님 요청하신 함수] 이걸로 교체하시면 됩니다!
function showSalesDashboard() {
  // 1. 화면 전환
  switchView('dashboard-view');
  


  // 2. 기존 차트가 있으면 일단 초기화 (잔상 방지)
  if (salesChartInstance) {
      salesChartInstance.destroy();
      salesChartInstance = null;
  }

  // 4. 로딩 시작! (스켈레톤 보여주기)
  showSkeleton();

  // 5. 서버에 최신 데이터 요청 (무조건 새로고침)
  callAppsScript('getSalesDashboardData')
    .then(data => {
        // 성공하면 데이터 초기화
        initDashboard(data);
    })
    .catch(err => {
        // 실패하면 스켈레톤 끄고 에러 알림
        hideSkeleton(); 
        alert("데이터 불러오기 실패: " + err);
    });
}

// 서버에서 데이터 받은 후 실행되는 함수
function initDashboard(response) {
  // 로딩 끝! 스켈레톤 끄기
  hideSkeleton();

  if (!response || response.status !== 'success') {
    alert("서버 오류: " + (response.message || "원인 불명"));
    return;
  }

  // 데이터 저장 후 차트 그리기
  dashboardData = response.data;
  updateDashboardChart();
}

// 실제 차트를 그리는 함수 (Chart.js)
// ============================================================
  // 🎨 차트 그리기 (옵션은 사장님 취향대로 유지)
  // ============================================================
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
          // 1Y일 때만 작년 데이터 표시
          label: '작년 (2024)',
          data: lastYearData,
          borderColor: '#9ca3af',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 0,
          fill: false,
          hidden: currentRange !== '1Y' // 1M, 1D에서는 숨김
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
        legend: { display: false }, // 커스텀 범례 쓰니까 끔
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          padding: 10,
          cornerRadius: 6,
          displayColors: false,
          caretPadding: 0,
          filter: function(tooltipItem) { return tooltipItem.raw > 0; } // 0인 값 숨기기
        }
      },
      scales: {
        x: {
          // ✨ [가로축 격자] 아주 연하게 (0.1)
          grid: { 
              color: 'rgba(200, 200, 200, 0.1)', 
              drawBorder: false // 축의 진한 테두리 선은 제거 (더 깔끔하게)
          },
          ticks: { color: '#9ca3af' } // 글자색 (회색)
        },
        y: {
          // ✨ [세로축 격자] 아주 연하게 (0.1)
          grid: { 
              color: 'rgba(200, 200, 200, 0.1)',
              borderDash: [4, 4], // (선택사항) 점선으로 하고 싶으면 이 줄 유지, 실선이 좋으면 삭제
              drawBorder: false 
          },
          ticks: { color: '#9ca3af' },
          beginAtZero: true,
          grace: '15%' // 천장 여유 (말풍선 공간 확보)
        }
      }
  });
}
