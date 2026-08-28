// ==========================================
// ✨ [마지막 튜닝] 마우스 오버 시 생성되는 빈 원에서 펄스 시작
// ==========================================
const rippleEffectPlugin = {
  id: 'rippleEffect',
  afterDraw: (chart) => {
    const ctx = chart.ctx;
    const now = Date.now();
    
    // 1. 마우스 오버된 요소 확인
    const activeElements = chart.getActiveElements();
    if (activeElements.length === 0) return; 
    
    const activeIndex = activeElements[0].index;

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (!chart.isDatasetVisible(datasetIndex) || !dataset.data) return;
      
      const isBlueBar = (dataset.label === '매출');
      const isBlueLine = (dataset.label.includes('올해')); // 1Y 파란 선
      const isPurpleLine = (dataset.label === '지난주' || dataset.label === '전월 동기');
      
      if (!isBlueBar && !isBlueLine && !isPurpleLine) return;

      const meta = chart.getDatasetMeta(datasetIndex);
      const element = meta.data[activeIndex]; 
      if (!element) return;

      const value = dataset.data[activeIndex];
      if (value === null || value === undefined || value === 0) return;

      // 🏆 해당 지점에서 가장 높은 데이터만 펄스 효과
      let isMax = true;
      
      // ✨ [수정] 내가 주인공(파란색)인지 확인
      const isMyMain = (isBlueBar || isBlueLine); 

      chart.data.datasets.forEach((compDs, compIdx) => {
           if (compIdx === datasetIndex || !chart.isDatasetVisible(compIdx)) return;
           const compVal = compDs.data[activeIndex];
           
           if (compVal !== null && compVal !== undefined) {
               if (compVal > value) {
                   isMax = false; // 나보다 큰 값이 있으면 탈락
               } else if (compVal === value) {
                   // 🤝 동점일 때 서열 정리 (파란색 > 보라색)
                   const isCompMain = (compDs.label === '매출' || compDs.label.includes('올해'));
                   
                   // 상대방이 주인공(파란색)이고, 나는 조연(보라색)이라면 -> 내가 양보 (탈락)
                   if (isCompMain && !isMyMain) {
                       isMax = false;
                   }
               }
           }
      });

      if (!isMax) return; 

      // 🎨 색상 및 좌표 설정
      const isBlue = isBlueBar || isBlueLine;
      const rippleColor = isBlue ? 'rgba(59, 130, 246' : 'rgba(192, 132, 252';
      
      const x = element.x;
      const y = element.y;
      
      const duration = 800; 
      const offset = (now % duration) / duration; 

      // 📏 파장 크기: 기본 원(약 3~4px)에서 시작해 15px까지 확장
      const radius = 4 + (offset * 11); 
      const opacity = 1 - offset; 

      ctx.save();
      
      // --- 🌊 퍼져나가는 파장(링) 그리기 ---
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `${rippleColor}, ${opacity})`; 
      ctx.stroke();

      // --- ⭕ 마우스 오버 시에만 생기는 기본 '빈 원' ---
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `${rippleColor}, 0.8)`; 
      ctx.stroke();

      ctx.restore();
    });
    
    // 애니메이션 프레임 유지
    if (!chart._rippleAnimating) {
        chart._rippleAnimating = true;
        requestAnimationFrame(() => {
            chart._rippleAnimating = false;
            chart.draw();
        });
    }
  }
};
// ==========================================
// chart.js (최종 수정본: 중복 제거 및 완벽 정리)
// ==========================================

// ----------------------------------------------------
// 1. 전역 변수 설정
// ----------------------------------------------------
let salesChartInstance = null;
let dashboardData = {};
let currentRange = '1Y'; 
let currentProduct = 'all'; // 'all', 'st', 'rice'
let baseDate = new Date(); 
let isAiMode = false; // ✨ AI 모드 스위치

// ==========================================
// ✨ [UI] 커스텀 드롭다운 로직
// ==========================================

// 1. 드롭다운 열기/닫기 토글
function toggleUserDropdown() {
    const list = document.getElementById('userDropdownList');
    const arrow = document.getElementById('dropdownArrow');
    
    if (list.classList.contains('hidden')) {
        // 열기
        list.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)'; // 화살표 뒤집기
    } else {
        // 닫기
        list.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
}

// 2. 담당자 선택 처리
function selectUser(userName) {
    // (1) 버튼 텍스트 변경
    document.getElementById('selectedUserName').textContent = userName;
    
    // (2) 숨겨진 진짜 select 값 변경 (차트 로직과 연결)
    const realSelect = document.getElementById('dashboardUserSelect');
    realSelect.value = userName;
    
    // (3) 체크 아이콘 상태 업데이트
    const checkKim = document.getElementById('check-김원대');
    const checkJung = document.getElementById('check-정병준');
    
    if (userName === '김원대') {
        checkKim.classList.remove('opacity-0'); checkKim.classList.add('opacity-100');
        checkJung.classList.remove('opacity-100'); checkJung.classList.add('opacity-0');
    } else {
        checkKim.classList.remove('opacity-100'); checkKim.classList.add('opacity-0');
        checkJung.classList.remove('opacity-0'); checkJung.classList.add('opacity-100');
    }

    // (4) 드롭다운 닫기 & 차트 업데이트
    toggleUserDropdown();
    updateDashboardChart();
}

// 3. 화면 다른 곳 클릭시 드롭다운 닫기 (UX 디테일)
window.addEventListener('click', function(e) {
    const btn = document.getElementById('userDropdownBtn');
    const list = document.getElementById('userDropdownList');
    if (btn && list && !btn.contains(e.target) && !list.contains(e.target)) {
        list.classList.add('hidden');
        const arrow = document.getElementById('dropdownArrow');
        if(arrow) arrow.style.transform = 'rotate(0deg)';
    }
});

// ----------------------------------------------------
// 2. 유틸리티 & 초기화 함수
// ----------------------------------------------------

// ✨ [UI] 알약 이동 애니메이션
function movePill(pillId, targetBtn) {
    const pill = document.getElementById(pillId);
    if (pill && targetBtn) {
        pill.style.left = targetBtn.offsetLeft + 'px';
        pill.style.width = targetBtn.offsetWidth + 'px';
    }
}

// ✨ 상품 변경 함수
function changeProduct(prod) {
    currentProduct = prod;

    const btns = {
        'all': document.getElementById('btn-prod-all'),
        'st': document.getElementById('btn-prod-st'),
        'rice': document.getElementById('btn-prod-rice')
    };

    movePill('prod-pill', btns[prod]);

    for (const [key, btn] of Object.entries(btns)) {
        if (!btn) continue;
        // 🚨 focus:outline-none 추가!
        const commonClass = "relative z-10 px-4 py-1.5 text-sm transition-colors duration-200 focus:outline-none"; 
        
        if (key === prod) {
            btn.className = `${commonClass} font-bold text-blue-600 dark:text-blue-400`;
        } else {
            btn.className = `${commonClass} font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400`;
        }
    }

    updateDashboardChart();
}

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
  
  // 차트 그리기
  updateDashboardChart(); 

  // ✨ [초기화] 알약 위치 잡기
  setTimeout(() => {
      movePill('prod-pill', document.getElementById('btn-prod-all'));
      movePill('range-pill', document.getElementById('btn-1y')); // 기본값이 1Y
  }, 50);
}

// ----------------------------------------------------
// 3. 날짜 제어 & 기간 변경
// ----------------------------------------------------

function changeChartRange(range) {
    currentRange = range;
    
    // 날짜 이동 버튼 보이기
    const navControl = document.getElementById('dateNavControl');
    if (navControl) navControl.classList.remove('hidden');

    const btns = {
        '1D': document.getElementById('btn-1d'),
        '1M': document.getElementById('btn-1m'),
        '1Y': document.getElementById('btn-1y')
    };

    // 1. 알약 이동
    const targetId = `btn-${range.toLowerCase()}`;
    const targetBtn = document.getElementById(targetId);
    movePill('range-pill', targetBtn);

    // 2. 글자색 업데이트
    ['1D', '1M', '1Y'].forEach(r => {
        const btn = btns[r];
        if (btn) {
            const commonClass = "relative z-10 px-3 py-1.5 text-sm transition-colors duration-200 focus:outline-none";
            if (r === range) {
                btn.className = "relative z-10 px-3 py-1.5 text-sm font-bold text-blue-600 dark:text-blue-400 transition-colors duration-200";
            } else {
                btn.className = "relative z-10 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 transition-colors duration-200";
            }
        }
    });

    // ✨ [핵심 기능] 1Y가 아니면 AI 버튼 압수!
    const aiBtn = document.getElementById('btn-ai-predict');
    if (aiBtn) {
        if (range === '1Y') {
            // 1Y일 때는 등장!
            aiBtn.style.display = 'flex'; 
            setTimeout(() => aiBtn.style.opacity = '1', 50); // 부드럽게
        } else {
            // 1D, 1M일 때는 퇴장!
            aiBtn.style.display = 'none';
            aiBtn.style.opacity = '0';
            
            // 혹시 AI 모드가 켜져 있었다면 끄기 (차트 꼬임 방지)
            isAiMode = false;
        }
    }

    if (range === '1D') baseDate = new Date();
    updateDashboardChart();
}

function moveDate(delta) {
    const nextDate = new Date(baseDate);
    const today = new Date();

    if (currentRange === '1Y') {
        nextDate.setFullYear(baseDate.getFullYear() + delta);
    } else if (currentRange === '1M') {
        nextDate.setMonth(baseDate.getMonth() + delta);
    } else if (currentRange === '1D') {
        nextDate.setDate(baseDate.getDate() + (delta * 7));
    }

    // 미래 날짜 제한
    if (delta > 0) {
        const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const n = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
        
        if (currentRange === '1D') {
             const dayNum = t.getDay();
             const diffToMon = (dayNum === 0 ? -6 : 1) - dayNum;
             const thisMon = new Date(t); 
             thisMon.setDate(t.getDate() + diffToMon);
             if (n > thisMon) return;
        } else {
             if (n > t) return; 
        }
    }

    baseDate = nextDate;
    updateDashboardChart();
}

// ============================================================
// 4. 툴팁 관련 함수 (getOrCreateTooltip, externalTooltipHandler)
// ============================================================

const getOrCreateTooltip = (chart) => {
  let tooltipEl = document.getElementById('chartjs-custom-tooltip');

  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'chartjs-custom-tooltip';
    tooltipEl.classList.add('chartjs-tooltip');
    
    tooltipEl.style.background = 'rgba(17, 24, 39, 0.95)';
    tooltipEl.style.borderRadius = '8px';
    tooltipEl.style.color = 'white';
    tooltipEl.style.opacity = 1;
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.transition = 'all .1s ease'; 
    tooltipEl.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
    tooltipEl.style.zIndex = '9999';
    tooltipEl.style.minWidth = '200px'; 
    tooltipEl.style.maxWidth = '300px';
    tooltipEl.style.overflow = 'visible'; 

    const table = document.createElement('table');
    table.style.margin = '0px';
    table.style.width = '100%';
    tooltipEl.appendChild(table);

    const arrow = document.createElement('div');
    arrow.className = 'tooltip-arrow';
    arrow.style.position = 'absolute';
    arrow.style.width = '0';
    arrow.style.height = '0';
    arrow.style.borderStyle = 'solid';
    arrow.style.borderWidth = '8px';
    arrow.style.borderColor = 'transparent';
    arrow.style.top = '50%';
    arrow.style.transform = 'translateY(-50%)';
    
    tooltipEl.appendChild(arrow);
    document.body.appendChild(tooltipEl);
  }

  return tooltipEl;
};

const externalTooltipHandler = (context) => {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltip(chart);
  const arrowEl = tooltipEl.querySelector('.tooltip-arrow');

  if (tooltip.opacity === 0) { tooltipEl.style.opacity = 0; return; }

  if (tooltip.body) {
    const idx = tooltip.dataPoints[0].dataIndex;
    const datasets = chart.data.datasets;
    const isYearlyMode = (currentRange === '1Y'); // 연간 모드 확인

    const currentSet = datasets.find(d => d.label === '매출' || d.label.includes('올해'));
    const lastYearSet = datasets.find(d => d.label === '작년 동기');
    let prevSet = datasets.find(d => d.label === '지난주') || datasets.find(d => d.label === '전월 동기');
    let prevLabelName = prevSet && prevSet.label === '지난주' ? '지난주' : '전월';

    let currVal = currentSet ? currentSet.data[idx] : 0;
    if (currVal === null) currVal = 0;
    const lastVal = lastYearSet ? lastYearSet.data[idx] : 0;
    const prevVal = prevSet ? prevSet.data[idx] : 0;

    if ((!currVal && !prevVal && !lastVal) || (currVal === 0 && prevVal === 0 && lastVal === 0)) {
        tooltipEl.style.opacity = 0; return;
    }

    const currDetails = (currentSet && currentSet.customDetails) ? currentSet.customDetails[idx] : { s: 0, r: 0 };
    const getDiffHtml = (base, target) => {
      const diff = base - target;
      if (diff > 0) return `<span style="color:#ef4444; font-weight:bold;">▲${diff}</span>`;
      if (diff < 0) return `<span style="color:#3b82f6; font-weight:bold;">▼${Math.abs(diff)}</span>`;
      return `<span style="color:#9ca3af;">-</span>`;
    };

    const diffPrev = getDiffHtml(currVal, prevVal);
    const diffYear = getDiffHtml(currVal, lastVal);
    const title = chart.data.labels[idx];

    // ✨ [수정] 1Y일 때는 '성과 비교'에서 전월을 빼고 작년만 표시
    let comparisonHtml = '';
    if (isYearlyMode) {
        comparisonHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: #9ca3af;">작년(${lastVal})</span>
              <span style="font-size: 11px;">${diffYear}</span>
            </div>
        `;
    } else {
        comparisonHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; color: #c084fc;">${prevLabelName}(${prevVal})</span>
              <span style="font-size: 11px;">${diffPrev}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: #9ca3af;">작년(${lastVal})</span>
              <span style="font-size: 11px;">${diffYear}</span>
            </div>
        `;
    }

    tooltipEl.querySelector('table').innerHTML = `
      <div style="padding: 12px;">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #374151; padding-bottom: 5px; color: #f3f4f6;">${title} 현황</div>
        <div style="display: flex; gap: 12px; align-items: stretch;">
          <div style="flex: 1; text-align: left;">
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">이번 매출</div>
            <div style="font-size: 12px; color: #d1d5db; display: flex; justify-content: space-between;"><span>생탁</span> <span style="color:white; font-weight:500;">${currDetails.s}</span></div>
            <div style="font-size: 12px; color: #d1d5db; display: flex; justify-content: space-between;"><span>우리쌀</span> <span style="color:white; font-weight:500;">${currDetails.r}</span></div>
            <div style="margin-top: 6px; font-size: 16px; font-weight: 800; color: #60a5fa; text-align: right;">${currVal}개</div>
          </div>
          <div style="width: 1px; background: #4b5563; opacity: 0.5;"></div>
          <div style="flex: 1.1;">
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">성과 비교</div>
            ${comparisonHtml}
          </div>
        </div>
      </div>`;
  }

  const position = chart.canvas.getBoundingClientRect();
  const rootLeft = position.left + window.pageXOffset;
  const rootTop = position.top + window.pageYOffset;
  const chartWidth = chart.width;
  const bgColor = 'rgba(17, 24, 39, 0.95)';
  
  if (tooltip.caretX > chartWidth / 2) {
      tooltipEl.style.transform = 'translate(-105%, 0)'; 
      tooltipEl.style.left = (rootLeft + tooltip.caretX - 30) + 'px';
      arrowEl.style.left = 'auto'; arrowEl.style.right = '-16px';
      arrowEl.style.borderColor = `transparent ${bgColor} transparent transparent`;
      arrowEl.style.borderLeftColor = bgColor; arrowEl.style.borderRightColor = 'transparent';
  } else {
      tooltipEl.style.transform = 'translate(5%, 0)';
      tooltipEl.style.left = (rootLeft + tooltip.caretX + 30) + 'px';
      arrowEl.style.right = 'auto'; arrowEl.style.left = '-16px';
      arrowEl.style.borderColor = `transparent transparent transparent ${bgColor}`; 
      arrowEl.style.borderRightColor = bgColor; arrowEl.style.borderLeftColor = 'transparent';
  }

  // ✨ [2026년 대응 서열 정리] 올해 데이터가 0이면 데이터가 있는 다른 선에 붙음
  const points = tooltip.dataPoints;
  const mainPoint = points.find(p => p.dataset.label === '매출' || p.dataset.label.includes('올해'));
  
  let targetY = 0;
  // 올해 매출이 0보다 클 때만 파란 선에 붙음
  if (mainPoint && mainPoint.raw !== null && mainPoint.raw > 0) {
      targetY = mainPoint.element.y;
  } else {
      // 매출이 0이면 데이터가 살아있는(작년 동기 등) 첫 번째 포인트를 찾아 붙음
      const activePoint = points.find(p => p.raw !== null && p.raw > 0) || points[0];
      targetY = activePoint.element.y;
  }
  
  tooltipEl.style.top = (rootTop + targetY - 50) + 'px';
  tooltipEl.style.opacity = 1;
};
// ============================================================
// 5. 차트 업데이트 메인 함수
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

  // 데이터셋 그릇
  let chartLabels = [];
  let mainData = []; 
  let mainDetails = []; 
  let trendData = [];
  let prevMonthData = []; 
  let lastYearData = [];  
  let prevWeekData = [];  // 지난주 데이터

  // Helper 함수들
  const getVal = (dataObj) => {
      if (!dataObj) return 0;
      if (currentProduct === 'st') return dataObj.s || 0;     
      if (currentProduct === 'rice') return dataObj.r || 0;   
      return dataObj.t || 0;                                  
  };

  const getNthWeekDate = (year, month, nth, dayIdx) => {
      const firstDay = new Date(year, month - 1, 1);
      const firstDayIdx = firstDay.getDay(); 
      let dayOffset = dayIdx - firstDayIdx;
      if (dayOffset < 0) dayOffset += 7;
      const targetDate = 1 + dayOffset + (nth - 1) * 7;
      const lastDay = new Date(year, month, 0).getDate();
      if (targetDate > lastDay) return new Date(year, month - 1, targetDate - 7);
      return new Date(year, month - 1, targetDate);
  };

  // ------------------------------------------------
  // 데이터 가공 로직
  // ------------------------------------------------
// ------------------------------------------------
  // [수정] 1Y 연간 데이터 처리 (+ 2026년 맞춤형 AI 예측)
  // ------------------------------------------------
  if (currentRange === '1Y') {
    const y = baseDate.getFullYear();
    if (dateDisplay) dateDisplay.textContent = `${y}년`;
    chartLabels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    
    const processYearData = (detailsArray, totalArray) => {
        if (currentProduct === 'all') return totalArray; 
        return detailsArray.map(d => (currentProduct === 'st' ? d.s : d.r));
    };

    const thisYear = new Date().getFullYear();
    let targetDetails = [], targetTotal = [], lastDetails = [], lastTotal = [];

    // 데이터 가져오기
    if (y === thisYear) {
      targetDetails = userData.thisYearDetails || []; targetTotal = userData.thisYear;
      lastDetails = userData.lastYearDetails || []; lastTotal = userData.lastYear;
    } else if (y === thisYear - 1) {
      targetDetails = userData.lastYearDetails || []; targetTotal = userData.lastYear;
    }

    mainData = processYearData(targetDetails, targetTotal);
    mainDetails = targetDetails; 
    lastYearData = processYearData(lastDetails, lastTotal);
    
    // 툴팁용 전월 데이터
    prevMonthData = [];
    for (let i = 0; i < 12; i++) {
        if (i === 0) prevMonthData.push(lastYearData[11] || 0); 
        else prevMonthData.push(mainData[i - 1] || 0);
    }

    // ===============================================
    // 🤖 [AI 예측] 2026년 신년 맞춤형 로직 (강제 실행)
    // ===============================================
    let predictedData = new Array(12).fill(null); 
    
    // 1. 성장률 계산 (데이터가 없으면 작년과 동일하게 1배로 설정)
    let growthRate = 1; 
    let currentSum = 0;
    let lastSum = 0;
    let matchCount = 0;

    for (let i = 0; i < 12; i++) {
        // 올해와 작년 둘 다 데이터가 있는 구간만 비교 (지금은 2026년 데이터가 없으니 스킵됨)
        if ((mainData[i] !== null && mainData[i] !== 0) && 
            (lastYearData[i] !== null && lastYearData[i] !== 0)) {
            currentSum += mainData[i];
            lastSum += lastYearData[i];
            matchCount++;
        }
    }

    // 비교할 데이터가 있으면 성장률 반영, 없으면 그냥 1배(작년 그대로)
    if (matchCount > 0 && lastSum > 0) {
        growthRate = currentSum / lastSum;
    }

    // 2. [핵심] 조건문 없이 무조건 예측 데이터 채우기!
    for (let i = 0; i < 12; i++) {
        // 올해 데이터가 이미 있으면 그걸 쓰고 (실선)
        if (mainData[i] !== null && mainData[i] !== 0) {
             // (예측선 끊김 방지용)
        } 
        // 올해 데이터가 없으면(미래) -> 작년 데이터(족보)를 보고 무조건 예측 (점선)
        else {
            if (lastYearData[i] !== null && lastYearData[i] !== 0) {
                // 작년 값 * 성장률(또는 1)
                predictedData[i] = Math.floor(lastYearData[i] * growthRate);
            }
        }
    }
    
    trendData = predictedData; // 차트 변수에 저장
    // ===============================================
  
  } else if (currentRange === '1M') {
    // [1M] 월간
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth() + 1;
    if (dateDisplay) dateDisplay.textContent = `${y}.${String(m).padStart(2,'0')}`;

    const lastDay = new Date(y, m, 0).getDate();
    const prevDate = new Date(y, m - 2, 1);
    const pmY = prevDate.getFullYear(), pmM = prevDate.getMonth() + 1;

    for (let i = 1; i <= lastDay; i++) {
      chartLabels.push(`${i}일`);

      const key = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const d = (userData.daily && userData.daily[key]) || { t: 0, s: 0, r: 0 };
      const val = getVal(d);
      mainData.push(val === 0 ? null : val);
      mainDetails.push({ s: d.s, r: d.r });

      const pmKey = `${pmY}-${String(pmM).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const pmData = (userData.daily && userData.daily[pmKey]) || { t: 0 };
      const pmVal = getVal(pmData);
      prevMonthData.push(pmVal === 0 ? null : pmVal);

      const lyKey = `${y-1}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const lyData = (userData.daily && userData.daily[lyKey]) || { t: 0 };
      // ✅ 1. 값을 먼저 가져옵니다 (변수 선언)
      const lyVal = getVal(lyData); 
      
      // ✅ 2. 0이면 null로 바꿔서 넣습니다 (마그넷 효과 적용)
      lastYearData.push(lyVal === 0 ? null : lyVal);
    }

  } else if (currentRange === '1D') {
    // [1D] 주간
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth() + 1;
    const firstDayOfMonth = new Date(y, m - 1, 1);
    const offset = firstDayOfMonth.getDay();
    const dateNum = baseDate.getDate();
    const weekNum = Math.ceil((dateNum + offset) / 7);
    const weekName = ['첫째주', '둘째주', '셋째주', '넷째주', '다섯째주', '여섯째주'][weekNum - 1] || (weekNum + '주');
    
    if (dateDisplay) dateDisplay.textContent = `${y}.${m}월 ${weekName}`;

    const dayNum = baseDate.getDay();
    const diffToMon = (dayNum === 0 ? -6 : 1) - dayNum;
    const thisMon = new Date(baseDate);
    thisMon.setDate(baseDate.getDate() + diffToMon);
    const prevWeekStart = new Date(thisMon);
    prevWeekStart.setDate(thisMon.getDate() - 7);

    const pmDate = new Date(y, m - 2, 1);
    const pmY = pmDate.getFullYear(), pmM = pmDate.getMonth() + 1;
    const lyY = y - 1, lyM = m;

    for (let i = 0; i < 6; i++) {
      const tDay = new Date(thisMon);
      tDay.setDate(thisMon.getDate() + i);
      const ty = tDay.getFullYear(), tm = String(tDay.getMonth()+1).padStart(2,'0'), td = String(tDay.getDate()).padStart(2,'0');
      chartLabels.push(`${tDay.getDate()}일${dayNames[tDay.getDay()]}`);

      const key = `${ty}-${tm}-${td}`;
      const d = (userData.daily && userData.daily[key]) || { t: 0, s: 0, r: 0 };
      const val = getVal(d);
      mainData.push(val === 0 ? null : val);
      mainDetails.push({ s: d.s, r: d.r });

      const pwDay = new Date(prevWeekStart);
      pwDay.setDate(prevWeekStart.getDate() + i);
      const pwy = pwDay.getFullYear(), pwm = String(pwDay.getMonth()+1).padStart(2,'0'), pwd = String(pwDay.getDate()).padStart(2,'0');
      const pwKey = `${pwy}-${pwm}-${pwd}`;
      const pwdData = (userData.daily && userData.daily[pwKey]) || { t: 0, s: 0, r: 0 };
      prevWeekData.push(getVal(pwdData));

      const curDayIdx = tDay.getDay();
      const targetPm = getNthWeekDate(pmY, pmM, weekNum, curDayIdx);
      const pmKey = `${targetPm.getFullYear()}-${String(targetPm.getMonth()+1).padStart(2,'0')}-${String(targetPm.getDate()).padStart(2,'0')}`;
      const pmData = (userData.daily && userData.daily[pmKey]) || { t: 0, s: 0, r: 0 };
      prevMonthData.push(getVal(pmData));

      const targetLy = getNthWeekDate(lyY, lyM, weekNum, curDayIdx);
      const lyKey = `${targetLy.getFullYear()}-${String(targetLy.getMonth()+1).padStart(2,'0')}-${String(targetLy.getDate()).padStart(2,'0')}`;
      const lyData = (userData.daily && userData.daily[lyKey]) || { t: 0, s: 0, r: 0 };
      lastYearData.push(getVal(lyData));
    }
  }

  // ------------------------------------------------
  // 차트 디자인 설정 (데이터셋 조립)
  // ------------------------------------------------
  const isYearly = (currentRange === '1Y');
  
  const barGradient = ctx.createLinearGradient(0, 0, 0, 400);
  barGradient.addColorStop(0, '#3b82f6'); 
  barGradient.addColorStop(1, '#93c5fd'); 
  const lineGradient = ctx.createLinearGradient(0, 0, 0, 400);
  lineGradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); 
  lineGradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

  let finalDatasets = [];

  // 1. [핵심] 메인 데이터 (파란색)
  // 👉 1Y는 '선(Line)', 1D/1M은 '막대(Bar)'로 자동 변환
  finalDatasets.push({
      type: isYearly ? 'line' : 'bar', 
      label: isYearly ? '올해 (2025)' : '매출', 
      data: mainData, 
      customDetails: mainDetails,
      borderColor: '#3b82f6', 
      backgroundColor: isYearly ? lineGradient : barGradient, 
      borderWidth: isYearly ? 3 : 0, 
      tension: 0.4, 
      fill: true,
      pointRadius: isYearly ? 4 : 0, 
      pointBackgroundColor: 'white', 
      pointBorderColor: '#3b82f6',
      order: 1,
      barPercentage: 0.5,
      categoryPercentage: 0.8,
      borderRadius: 4
  });

  // 2. 비교 데이터 (보라색 선)
  if (currentRange === '1D') {
      // 1D: 지난주 (보라색 실선)
      finalDatasets.push({
          type: 'line', label: '지난주', data: prevWeekData, 
          borderColor: '#c084fc', borderWidth: 2, tension: 0.3, fill: false, order: 2,
          pointRadius: 0
      });
  } else {
      // 1M: 전월 동기 (보라색 실선)
      // 1Y: 전월 데이터는 보통 숨김 처리 (필요하면 hidden: false로 변경)
      finalDatasets.push({
          type: 'line', label: '전월 동기', data: prevMonthData,
          borderColor: '#c084fc', borderWidth: 2, tension: 0, fill: false, spanGaps: true, 
          hidden: isYearly, 
          order: 2,
          pointRadius: 0
      });
  }

  // 3. 작년 데이터 (회색 점선) - 모든 기간 공통
  finalDatasets.push({
      type: 'line', label: '작년 동기', data: lastYearData,
      borderColor: '#9ca3af', borderWidth: 2, borderDash: [5, 5], tension: 0.3, pointRadius: 0, fill: false, hidden: false, order: 4, spanGaps: true
  });

  // 4. [1Y 전용] AI 예측 (보라색 점선) - 버튼 눌렀을 때만
  if (isYearly && isAiMode) { 
      finalDatasets.push({
          type: 'line', 
          label: 'AI 예측', 
          data: trendData,        
          borderColor: '#8b5cf6', 
          borderWidth: 2, 
          borderDash: [5, 5],     
          tension: 0.4,           
          pointRadius: 0,         
          fill: false,
          order: 2,
          spanGaps: true,
          animations: {
              x: {
                  type: 'number',
                  easing: 'linear',
                  duration: 2000, 
                  from: NaN, 
                  delay(ctx) {
                      if (ctx.type !== 'data' || ctx.xStarted) return 0;
                      ctx.xStarted = true;
                      return ctx.index * 100; 
                  }
              },
              y: {
                  type: 'number',
                  easing: 'easeOutQuart',
                  duration: 2000,
                  from: (ctx) => ctx.chart.scales.y.getPixelForValue(0) 
              }
          }
      });
  }

// 1D: 지난주
  if (currentRange === '1D') {
      
      // 1. 지난주: 플러그인용 설정 (애니메이션 코드 삭제!)
      finalDatasets.push({
          type: 'line', label: '지난주', data: prevWeekData, 
          borderColor: '#c084fc', borderWidth: 2, tension: 0.3, fill: false, order: 2,
          pointRadius: 0 // ✅ 점은 숨김 (이제 플러그인이 알아서 그려줌)
      });
      
      // 2. 툴팁용 전월 데이터
      finalDatasets.push({ type: 'line', label: '전월 동기', data: prevMonthData, hidden: true });

      // 3. 작년 동기
      finalDatasets.push({
          type: 'line', label: '작년 동기', data: lastYearData,
          borderColor: '#9ca3af', borderWidth: 2, borderDash: [5, 5], tension: 0.3, pointRadius: 0, fill: false, hidden: false, order: 4, spanGaps: true
      });

  } else { // 1M, 1Y
      
      // 1M, 1Y: 전월 동기
      if (currentRange === '1M' || currentRange === '1Y') {
        finalDatasets.push({
          type: 'line', label: '전월 동기', data: prevMonthData,
          borderColor: '#c084fc', borderWidth: 2, tension: 0, fill: false, spanGaps: true, 
          hidden: currentRange === '1Y', order: 2,
          pointRadius: 0 // ✅ 여기도 점 숨김
        });
      }
      
      // 2. 작년 동기
      finalDatasets.push({
        type: 'line', label: '작년 동기', data: lastYearData,
        borderColor: '#9ca3af', borderWidth: 2, borderDash: [5, 5], tension: 0.3, pointRadius: 0, fill: false, hidden: false, order: 4, spanGaps: true
      });
  }
// ------------------------------------------------
  // ✨ [요약 알림판] (오리지널 디자인 복구: 반투명 스타일)
  // ------------------------------------------------
  const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
  const currentTotal = sum(mainData);
  const prevTotal = sum(prevMonthData); 
  const lastTotal = sum(lastYearData);

  const prodLabel = currentProduct === 'st' ? '생탁' : (currentProduct === 'rice' ? '우리쌀' : '합계');

  // 증감 표시 HTML (오리지널 스타일)
  const getDiffHtml = (curr, old, label) => {
      const diff = curr - old;
      let color = diff > 0 ? '#ef4444' : (diff < 0 ? '#3b82f6' : '#9ca3af');
      let icon = diff > 0 ? '▲' : (diff < 0 ? '▼' : '-');
      let val = Math.abs(diff);
      return `<div style="font-size:12px; color:#6b7280; display:flex; align-items:center; gap:4px; margin-top:2px;">
                <span>${label}</span> <span style="color:${color}; font-weight:bold;">${icon} ${val}</span>
              </div>`;
  };

  let summaryTitle = '', summaryContent = '';
  if (currentRange === '1D') {
      summaryTitle = `이번 주 ${prodLabel}`; 
      summaryContent = getDiffHtml(currentTotal, lastTotal, '작년 대비');
  } else if (currentRange === '1M') {
      summaryTitle = `이번 달 ${prodLabel}`; 
      summaryContent = getDiffHtml(currentTotal, prevTotal, '전월 대비') + getDiffHtml(currentTotal, lastTotal, '작년 대비');
  } else {
      summaryTitle = `올해 ${prodLabel}`; 
      summaryContent = getDiffHtml(currentTotal, lastTotal, '작년 대비');
  }

  // 알림판 요소 생성 (스타일: 오리지널 복구)
  const container = canvas.parentNode;
  let overlay = container.querySelector('.chart-summary-overlay');
  
  if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'chart-summary-overlay';
      Object.assign(overlay.style, {
          position: 'absolute', 
          top: '20px', 
          left: '20px', 
          background: 'rgba(255, 255, 255, 0.9)', // 반투명 흰색
          padding: '12px 16px', 
          borderRadius: '12px', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(229, 231, 235, 0.5)', 
          zIndex: '10', 
          pointerEvents: 'none'
      });
      container.appendChild(overlay);
  } else {
      // 혹시 클래스로 디자인이 바뀌어 있을까봐 강제로 스타일 다시 주입
      overlay.className = 'chart-summary-overlay';
      Object.assign(overlay.style, {
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '12px 16px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(229, 231, 235, 0.5)'
      });
  }
  
  overlay.innerHTML = `
      <div style="font-size:12px; color:#6b7280; font-weight:500;">${summaryTitle}</div>
      <div style="font-size:24px; color:#111827; font-weight:800; line-height:1.2;">${currentTotal}<span style="font-size:14px; color:#9ca3af; font-weight:normal;">개</span></div>
      <div style="margin-top:4px;">${summaryContent}</div>
  `;

salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: chartLabels, datasets: finalDatasets },

    plugins: [rippleEffectPlugin],
    
    options: {
      responsive: true, maintainAspectRatio: false,
      
      // 👇 여기를 수정하세요! (마그넷 효과 적용)
      interaction: { 
          mode: 'index',  // 'index' -> 'nearest'로 변경 (가까운 점에 붙음)
          axis: 'x',        // x축 방향으로 움직일 때 자연스럽게 넘어가도록 설정
          intersect: false  // 선 위에 정확히 안 올려도 근처에 가면 뜨게 함
      },
      
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false, external: externalTooltipHandler }
      },
      scales: {
        x: { grid: { display: true, color: 'rgba(200, 200, 200, 0.1)', drawBorder: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
        y: { grid: { display: true, color: 'rgba(200, 200, 200, 0.15)', borderDash: [4, 4], drawBorder: false }, ticks: { color: '#9ca3af' }, beginAtZero: true, grace: '50%' }
      }
    }
});
}

// ===============================================
// ✨ [최종 완성] AI 버튼 토글 함수 (슈퍼 애니메이션 Ver.)
// ===============================================
function toggleAIPrediction() {
    const btn = document.getElementById('btn-ai-predict');
    if (!salesChartInstance) return; // 차트가 없으면 중단

    isAiMode = !isAiMode;

    if (isAiMode) {
        // [ON] 켜짐: 버튼 스타일 & 애니메이션 그래프 추가
        btn.classList.add('ring-2', 'ring-purple-400', 'bg-purple-50');
        
        // 1. 즉석 데이터 계산 (기존 로직과 동일)
        const datasets = salesChartInstance.data.datasets;
        const mainDs = datasets.find(d => d.label.includes('올해') || d.label === '매출');
        const lastDs = datasets.find(d => d.label === '작년 동기');
        if (!mainDs || !lastDs) return;
        const mainData = mainDs.data; const lastYearData = lastDs.data;
        let predictedData = new Array(12).fill(null); 
        let growthRate = 1; let currentSum = 0, lastSum = 0, matchCount = 0;
        for (let i = 0; i < 12; i++) {
            if ((mainData[i] !== null && mainData[i] !== 0) && (lastYearData[i] !== null && lastYearData[i] !== 0)) {
                currentSum += mainData[i]; lastSum += lastYearData[i]; matchCount++;
            }
        }
        if (matchCount > 0 && lastSum > 0) growthRate = currentSum / lastSum;
        for (let i = 0; i < 12; i++) {
            if (mainData[i] === null || mainData[i] === 0) {
                if (lastYearData[i] !== null && lastYearData[i] !== 0) {
                    predictedData[i] = Math.floor(lastYearData[i] * growthRate);
                }
            }
        }

        // 2. ✨ [핵심] 슈퍼 애니메이션 데이터셋 정의
        const newAiDataset = {
            type: 'line', 
            label: 'AI 예측', 
            data: predictedData,        
            borderColor: '#8b5cf6', // 보라색
            borderWidth: 3,         // 선을 좀 더 두껍게 (강조)
            borderDash: [5, 5],     // 점선
            tension: 0.4,           // 부드러운 곡선
            pointRadius: 0,         // 평소엔 점 숨김
            pointHoverRadius: 6,    // 호버하면 점 커짐
            pointBackgroundColor: '#8b5cf6',
            fill: false,
            order: 0, // 맨 위에 그림
            spanGaps: true,
            
            // 🎬 [애니메이션 설정] 여기가 마법이 일어나는 곳입니다!
            animations: {
                // ① 선이 왼쪽에서 오른쪽으로 그려짐
                x: {
                    type: 'number',
                    easing: 'linear', // 일정한 속도로
                    duration: 2000,   // 2초 동안 천천히
                    from: NaN,        // 없는 상태에서 시작
                    delay(ctx) {
                        if (ctx.type !== 'data' || ctx.xStarted) return 0;
                        ctx.xStarted = true;
                        return ctx.index * 150; // 월별로 0.15초씩 딜레이 (순차적)
                    }
                },
                // ② 값이 바닥에서 위로 솟아오름 (쫄깃한 느낌)
                y: {
                    type: 'number',
                    easing: 'easeOutBack', // 🎯 팅~ 하고 튀어 오르는 탄성 효과!
                    duration: 2000,
                    from: (ctx) => ctx.chart.scales.y.getPixelForValue(0), // 바닥(0)에서 시작
                    delay(ctx) {
                        if (ctx.type !== 'data' || ctx.yStarted) return 0;
                        ctx.yStarted = true;
                        return ctx.index * 150; // X축과 동일한 딜레이
                    }
                },
                // ③ (선택) 점이 통통 튀어나오는 효과
                radius: {
                    duration: 400,
                    easing: 'easeOutBack',
                    from: 0,
                    delay(ctx) { return (ctx.index * 150) + 500; } // 선이 그려진 뒤에 뿅!
                }
            }
        };

        salesChartInstance.data.datasets.push(newAiDataset);
        salesChartInstance.update(); // 새로고침 없이 추가!

    } else {
        // [OFF] 꺼짐: 데이터셋 제거 (애니메이션 없이 즉시 사라짐)
        btn.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-50');
        salesChartInstance.data.datasets = salesChartInstance.data.datasets.filter(d => d.label !== 'AI 예측');
        salesChartInstance.update('none'); // 'none' 모드로 업데이트 (즉시 반영)
    }
}
