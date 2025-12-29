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

// ----------------------------------------------------
// 3. 차트 그리기 (핵심 로직)
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

  const dateDisplay = document.getElementById('currentDateDisplay');
  const dayNames = ['(일)', '(월)', '(화)', '(수)', '(목)', '(금)', '(토)'];

  let chartLabels = [];
  let mainData = []; 
  let compareData = []; 
  
  // ============================
  // 모드별 로직 분기
  // ============================
  if (currentRange === '1Y') {
      // [1Y] 연도별 보기
      const y = baseDate.getFullYear();
      dateDisplay.textContent = `${y}년`;

      chartLabels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
      
      const thisYear = new Date().getFullYear();
      if (y === thisYear) {
          mainData = userData.thisYear;
          compareData = userData.lastYear; 
      } else if (y === thisYear - 1) {
          mainData = userData.lastYear;
          compareData = Array(12).fill(null); 
      } else {
          mainData = Array(12).fill(0);
          compareData = Array(12).fill(0);
      }

  } else if (currentRange === '1M') {
      // [1M] 월별 보기
      const y = baseDate.getFullYear();
      const m = baseDate.getMonth() + 1;
      dateDisplay.textContent = `${y}.${String(m).padStart(2,'0')}`;
      
      const lastDay = new Date(y, m, 0).getDate();

      for (let i = 1; i <= lastDay; i++) {
          chartLabels.push(`${i}일`);

          // 메인 (올해)
          const dateKey = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          let val = (userData.daily && userData.daily[dateKey]) ? userData.daily[dateKey] : 0;
          mainData.push(val);

          // 비교 (작년)
          const prevY = y - 1;
          const prevKey = `${prevY}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          let prevVal = (userData.daily && userData.daily[prevKey]) ? userData.daily[prevKey] : 0;
          compareData.push(prevVal);
      }

  } else if (currentRange === '1D') {
      // [1D] 이번 주 (월~토) 고정 보기
      // 기준: 오늘 날짜
      const today = new Date(); 
      
      // 1. 이번 주 월요일 찾기
      // (일요일=0, 월요일=1 ... 토요일=6)
      // 오늘이 일요일(0)이면, 월요일은 어제(-6일전)가 아니라 다음주? 
      // 사장님 요청: "일요일은 빼고". 보통 일요일은 한 주의 시작이나 끝인데, 
      // 여기선 '이번 주'의 업무일(월~토)을 보여줍니다.
      const dayNum = today.getDay(); // 0~6
      
      // 월요일과의 거리 계산 (일요일이면 -6, 월요일이면 0, 화요일이면 1...)
      const diffToMon = (dayNum === 0 ? -6 : 1) - dayNum;
      
      const thisMon = new Date(today);
      thisMon.setDate(today.getDate() + diffToMon); // 이번 주 월요일로 이동
      
      // 2. 작년 이맘때 월요일 찾기 (요일 매칭을 위해)
      const lastYearSameTime = new Date(thisMon);
      lastYearSameTime.setFullYear(thisMon.getFullYear() - 1);
      // 작년 같은 날짜의 요일을 보고, 그 주의 월요일로 조정
      const lyDayNum = lastYearSameTime.getDay();
      const lyDiff = (lyDayNum === 0 ? -6 : 1) - lyDayNum;
      const lastYearMon = new Date(lastYearSameTime);
      lastYearMon.setDate(lastYearSameTime.getDate() + lyDiff);

      // 3. 월~토 (0~5) 루프 돌리기
      for (let i = 0; i < 6; i++) {
          // --- 올해 데이터 ---
          const targetDay = new Date(thisMon);
          targetDay.setDate(thisMon.getDate() + i);
          
          const ty = targetDay.getFullYear();
          const tm = String(targetDay.getMonth() + 1).padStart(2, '0');
          const td = String(targetDay.getDate()).padStart(2, '0');
          const tDayName = dayNames[targetDay.getDay()]; // (월), (화)...
          
          chartLabels.push(`${targetDay.getDate()}일${tDayName}`);
          
          const tKey = `${ty}-${tm}-${td}`;
          let tVal = (userData.daily && userData.daily[tKey]) ? userData.daily[tKey] : 0;
          mainData.push(tVal);

          // --- 작년 데이터 (비교) ---
          const lyDay = new Date(lastYearMon);
          lyDay.setDate(lastYearMon.getDate() + i);
          
          const ly = lyDay.getFullYear();
          const lm = String(lyDay.getMonth() + 1).padStart(2, '0');
          const ld = String(lyDay.getDate()).padStart(2, '0');
          
          const lKey = `${ly}-${lm}-${ld}`;
          let lVal = (userData.daily && userData.daily[lKey]) ? userData.daily[lKey] : 0;
          compareData.push(lVal);
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
          label: '작년 동기',
          data: compareData,
          borderColor: '#9ca3af',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 0,
          fill: false,
          hidden: false // 1D에서도 작년 비교 보여줌!
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
