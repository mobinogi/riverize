// ==========================================
// 📊 매출 대시보드 로직
// ==========================================

let dashboardData = {}; // 데이터 담아둘 그릇
let dashboardChart = null; // 차트 객체

// 1. [화면 전환] 사이드바 버튼 누르면 실행
function showSalesDashboard() {
  // (1) 다른 화면들 다 숨기기 (ID를 현재 index1.html에 맞게 수정!)
  // 기존: const views = ['calendar-view', 'map-view', 'report-view', 'daily-report-list']; 
  const views = ['view-write', 'view-consolidated']; // ✅ 이렇게 바꿔주세요!
  
  views.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.add('hidden');
  });

  // (2) 대시보드 화면만 보여주기
  document.getElementById('dashboard-view').classList.remove('hidden');

  // (3) 데이터가 비어있으면 서버에서 가져오기 (최초 1회)
  if (Object.keys(dashboardData).length === 0) {
    // 로딩 중 표시 (선택사항)
    const ctx = document.getElementById('salesStatusChart').getContext('2d');
    ctx.font = "20px Pretendard";
    ctx.fillText("데이터를 불러오는 중입니다...", 50, 50);

    google.script.run
      .withSuccessHandler(initDashboard)
      .getSalesDashboardData(); // code.gs에 있는 함수 실행
  }
}

// 2. 데이터 도착하면 초기화
function initDashboard(data) {
  if (data.error) { alert("데이터 오류: " + data.error); return; }
  dashboardData = data;
  updateDashboardChart(); // 차트 그리기
}

// 3. 차트 그리기 (업데이트)
function updateDashboardChart() {
  const selectedUser = document.getElementById('dashboardUserSelect').value;
  const userData = dashboardData[selectedUser];

  if (!userData) {
    alert("해당 담당자의 데이터가 없습니다.");
    return;
  }

  const ctx = document.getElementById('salesStatusChart').getContext('2d');

  // 기존 차트 삭제 (안 그러면 겹침)
  if (dashboardChart) dashboardChart.destroy();

  // 다크모드 감지
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#e5e7eb' : '#374151';
  const gridColor = isDark ? '#374151' : '#f3f4f6';

  dashboardChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
      datasets: [
        {
          label: '올해 (2025)',
          data: userData.thisYear,
          borderColor: '#3b82f6', // 파란색
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: '작년 (2024)',
          data: userData.lastYear,
          borderColor: isDark ? '#9ca3af' : '#6b7280', // 회색
          borderWidth: 2,
          borderDash: [5, 5], // 점선
          tension: 0.3,
          fill: false,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: textColor, font: { size: 14 } } },
        tooltip: {
          backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
          titleColor: isDark ? '#fff' : '#000',
          bodyColor: isDark ? '#fff' : '#000',
          borderColor: isDark ? '#4b5563' : '#e5e7eb',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${context.parsed.y.toLocaleString()}개`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor }
        },
        x: {
          grid: { display: false },
          ticks: { color: textColor }
        }
      }
    }
  });
}
