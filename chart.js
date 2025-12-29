// ==========================================
// chart.js (최종 업그레이드: 날짜 이동 + 비교 분석)
// ==========================================

// 전역 변수
let salesChartInstance = null;
let dashboardData = {}; 
let currentRange = '1Y'; 

// 📅 [핵심] 현재 보고 있는 기준 날짜 (기본값: 오늘)
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
  
  // 들어올 때마다 "오늘"로 초기화하려면 아래 주석 해제
  // baseDate = new Date(); 

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
  updateDashboardChart(); // 차트 그리기 시작
}

// ----------------------------------------------------
// 2. 날짜 제어 & 버튼 로직 (여기가 새로 추가된 뇌입니다!)
// ----------------------------------------------------

// 1D/1M/1Y 버튼 클릭
function changeChartRange(range) {
    currentRange = range;
    // 버튼 스타일
    ['1d', '1m', '1y'].forEach(r => {
        const btn = document.getElementById(`btn-${r}`);
        if (btn) {
            btn.className = (r.toUpperCase() === range) 
                ? "px-3 py-1.5 rounded-md bg-white dark:bg-gray-700 text-blue-600 shadow-sm transition-all font-bold"
                : "px-3 py-1.5 rounded-md transition-all text-gray-500 hover:text-gray-900 dark:text-gray-400";
        }
    });
    updateDashboardChart();
}

// < > 화살표 클릭 (과거/미래 이동)
function moveDate(delta) {
    if (currentRange === '1Y') {
        baseDate.setFullYear(baseDate.getFullYear() + delta);
    } else if (currentRange === '1M') {
        baseDate.setMonth(baseDate.getMonth() + delta);
    } else if (currentRange === '1D') {
        baseDate.setDate(baseDate.getDate() + delta); // 하루씩 이동
    }
    updateDashboardChart();
}

// ----------------------------------------------------
// 3. 차트 그리기 (Data Processing)
// ----------------------------------------------------
function updateDashboardChart() {
  const canvas = document.getElementById('salesStatusChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const userSelect = document.getElementById('dashboardUserSelect');
  const selectedUser = userSelect ? userSelect.value : '김원대';
  if (!dashboardData || !dashboardData[selectedUser]) return;
  const userData = dashboardData[selectedUser];

  if (salesChartInstance) salesChartInstance.destroy();

  // 날짜 표시 업데이트 (가운데 글자)
  const dateDisplay = document.getElementById('currentDateDisplay');
  
  // 데이터 가공 변수
  let chartLabels = [];
  let mainData = []; // 실선 (선택 기간)
  let compareData = []; // 점선 (비교군: 작년 or 지난주)
  
  const dayNames = ['(일)', '(월)', '(화)', '(수)', '(목)', '(금)', '(토)'];

  // ============================
  // 모드별 로직 분기
  // ============================
  if (currentRange === '1Y') {
      // [1Y] 연도별 보기
      const y = baseDate.getFullYear();
      dateDisplay.textContent = `${y}년`; // "2025년"

      chartLabels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
      
      // 현재 선택된 연도가 '올해(서버기준)'라면 thisYear, '작년'이면 lastYear 데이터 사용
      // (주의: 서버에서 2년치만 주기 때문에, 2023년 등은 0으로 나올 수 있음)
      const thisYear = new Date().getFullYear(); // 2025
      
      if (y === thisYear) {
          mainData = userData.thisYear;
          compareData = userData.lastYear; // 비교: 2024
      } else if (y === thisYear - 1) {
          mainData = userData.lastYear;
          compareData = Array(12).fill(null); // 2023 데이터는 없으므로 비움
      } else {
          mainData = Array(12).fill(0); // 데이터 없음
          compareData = Array(12).fill(0);
      }

  } else if (currentRange === '1M') {
      // [1M] 월별 보기 (1일 ~ 말일)
      const y = baseDate.getFullYear();
      const m = baseDate.getMonth() + 1;
      dateDisplay.textContent = `${y}.${String(m).padStart(2,'0')}`; // "2025.10"
      
      // 해당 월의 마지막 날짜 계산 (28, 30, 31 자동)
      const lastDay = new Date(y, m, 0).getDate();

      for (let i = 1; i <= lastDay; i++) {
          chartLabels.push(`${i}일`);

          // 1. 메인 데이터 (선택한 달)
          const dateKey = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          let val = (userData.daily && userData.daily[dateKey]) ? userData.daily[dateKey] : 0;
          mainData.push(val);

          // 2. 비교 데이터 (작년 같은 달) -> 사장님 요청!
          // 2024-10-01 데이터 찾기
          const prevY = y - 1;
          const prevKey = `${prevY}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          let prevVal = (userData.daily && userData.daily[prevKey]) ? userData.daily[prevKey] : 0;
          compareData.push(prevVal);
      }

  } else if (currentRange === '1D') {
      // [1D] 주간 보기 (선택일 포함 최근 7일)
      const y = baseDate.getFullYear();
      const m = baseDate.getMonth() + 1;
      const d = baseDate.getDate();
      const dayName = dayNames[baseDate.getDay()];
      
      dateDisplay.textContent = `${m}.${d} ${dayName}`; // "12.23 (화)"

      // 6일 전 ~ 오늘 (총 7일)
      for (let i = 6; i >= 0; i--) {
          const tempDate = new Date(baseDate);
          tempDate.setDate(baseDate.getDate() - i); // 날짜 계산

          const ty = tempDate.getFullYear();
          const tm = String(tempDate.getMonth() + 1).padStart(2, '0');
          const td = String(tempDate.getDate()).padStart(2, '0');
          const tDay = dayNames[tempDate.getDay()]; // 요일 계산

          // 라벨: "23(화)"
          chartLabels.push(`${tempDate.getDate()}${tDay}`);

          // 메인 데이터
          const key = `${ty}-${tm}-${td}`;
          let val = (userData.daily && userData.daily[key]) ? userData.daily[key] : 0;
          mainData.push(val);
          
          // 비교 데이터 (없음 or 지난주? 일단 깔끔하게 비움)
          compareData.push(null);
      }
  }

  // 차트 생성
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); 
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)'); 

  salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: '선택 기간',
          data: mainData,
          borderColor: '#3b82f6', // 파랑
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
          label: '작년 동기', // 1M일 땐 작년 이맘때
          data: compareData,
          borderColor: '#9ca3af', // 회색
          borderWidth: 2,
          borderDash: [5, 5], // 점선
          tension: 0.3,
          pointRadius: 0,
          fill: false,
          // 1D가 아닐 때만 비교 보여줌
          hidden: currentRange === '1D' 
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
          // 0인 값 숨기기 (옵션)
          filter: function(tooltipItem) { return tooltipItem.raw > 0; } 
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(200, 200, 200, 0.1)', drawBorder: false },
          ticks: { color: '#9ca3af' } 
        },
        y: {
          grid: { color: 'rgba(200, 200, 200, 0.1)', borderDash: [4, 4], drawBorder: false },
          ticks: { color: '#9ca3af' },
          beginAtZero: true,
          grace: '15%' 
        }
      }
    }
  });
}
