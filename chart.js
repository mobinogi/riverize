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
// 📊 [chart.js] 차트 그리기 함수 (최종_상세툴팁.ver)
// - 생탁/우리쌀/합계 상세 표시 기능 추가
// - 1Y(영역), 1M/1D(막대+선) 디자인 유지
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
  let mainDetails = [];   // ✨ 상세 데이터 (툴팁용)
  let trendData = [];     
  let compareData = [];   
  let compareDetails = []; // ✨ 작년 상세

  // ============================
  // 1. 데이터 가공
  // ============================
  if (currentRange === '1Y') {
      const y = baseDate.getFullYear();
      if(dateDisplay) dateDisplay.textContent = `${y}년`;
      chartLabels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
      
      const thisYear = new Date().getFullYear();
      if (y === thisYear) {
          mainData = userData.thisYear; 
          mainDetails = userData.thisYearDetails || [];
          compareData = userData.lastYear;
          compareDetails = userData.lastYearDetails || [];
      } else if (y === thisYear - 1) {
          mainData = userData.lastYear;
          mainDetails = userData.lastYearDetails || [];
          compareData = Array(12).fill(0);
          compareDetails = Array(12).fill({s:0, r:0});
      } else {
          mainData = Array(12).fill(0); mainDetails = Array(12).fill({s:0, r:0});
          compareData = Array(12).fill(0); compareDetails = Array(12).fill({s:0, r:0});
      }
      trendData = mainData; 

  } else if (currentRange === '1M') {
      const y = baseDate.getFullYear(); const m = baseDate.getMonth() + 1;
      if(dateDisplay) dateDisplay.textContent = `${y}.${String(m).padStart(2,'0')}`;
      const lastDay = new Date(y, m, 0).getDate();
      
      for (let i = 1; i <= lastDay; i++) {
          chartLabels.push(`${i}일`);
          const key = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          
          // ✨ 데이터가 객체 {t, s, r}로 옵니다. 없으면 0 처리
          const dayData = (userData.daily && userData.daily[key]) || { t: 0, s: 0, r: 0 };
          
          mainData.push(dayData.t);
          mainDetails.push({ s: dayData.s, r: dayData.r });
          trendData.push(dayData.t === 0 ? null : dayData.t);

          const pKey = `${y-1}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          const pData = (userData.daily && userData.daily[pKey]) || { t: 0, s: 0, r: 0 };
          
          compareData.push(pData.t);
          compareDetails.push({ s: pData.s, r: pData.r });
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
  // 🎨 [차트 그리기]
  // ============================================
  const isYearly = (currentRange === '1Y');
  
  // 그라데이션 설정
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
          label: '올해 (2025)',
          data: mainData,
          customDetails: mainDetails, // ✨ 상세 데이터 숨겨둠
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
          customDetails: mainDetails, // ✨ 상세 데이터 숨겨둠
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
      label: '작년 동기',
      data: compareData,
      customDetails: compareDetails, // ✨ 작년 상세 데이터
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
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          padding: 12,
          cornerRadius: 8,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          displayColors: false,
          
          filter: function(tooltipItem) { 
              return tooltipItem.dataset.label !== '추세' && (tooltipItem.raw > 0 || tooltipItem.dataset.label === '작년 동기'); 
          },

          // ✨ [핵심] 툴팁 내용 커스터마이징
          callbacks: {
              title: function(context) {
                  return context[0].label; 
              },
              label: function(context) {
                  const label = context.dataset.label || '';
                  
                  // 숨겨둔 상세 데이터 꺼내기
                  const details = context.dataset.customDetails && context.dataset.customDetails[context.dataIndex];
                  
                  if (details) {
                      // ✨ 사장님이 원하신 포맷으로 출력!
                      return [
                          ` ${label}`, // 제목 (예: 매출)
                          ` 생탁: ${details.s}개`,
                          ` 우리쌀: ${details.r}개`,
                          ` ----------------`,
                          ` 합계: ${context.parsed.y}개`
                      ];
                  } else {
                      return ` ${label}: ${context.parsed.y}`;
                  }
              }
          }
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
          grace: '70%' 
        }
      }
    }
  });
}
