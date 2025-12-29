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
function updateDashboardChart() {
  const canvas = document.getElementById('salesStatusChart'); // 캔버스 요소 가져오기
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d'); // 🖌️ 그라데이션을 위해 붓(context)을 꺼냅니다.

  // 셀렉트 박스에서 현재 선택된 담당자 가져오기
  const userSelect = document.getElementById('dashboardUserSelect');
  const selectedUser = userSelect ? userSelect.value : '김원대';

  // 데이터가 없으면 중단
  if (!dashboardData || !dashboardData[selectedUser]) return;

  const userData = dashboardData[selectedUser]; // { thisYear: [...], lastYear: [...] }

  // 기존 차트가 있으면 삭제 (중복 생성 방지)
  if (salesChartInstance) {
    salesChartInstance.destroy();
  }

  // ✨ [1. 그라데이션 만들기] : 위쪽은 은은한 파랑 -> 아래는 투명하게 사라짐
  // (0, 0, 0, 400)은 그라데이션 방향(위->아래)입니다.
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // 맨 위: 살짝 진한 파랑 (투명도 0.5)
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)'); // 맨 아래: 완전 투명 (흰색이랑 섞임)

  // 새 차트 생성
  salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
      datasets: [
        {
          label: `올해 (2025)`,
          data: userData.thisYear,
          borderColor: '#3b82f6', // 선 색상 (진한 파랑)
          
          // ✨ [그라데이션 적용] 단순 단색이 아니라, 아까 만든 그라데이션을 입힙니다.
          backgroundColor: gradient, 
          
          borderWidth: 3,
          tension: 0.4, // 곡선을 조금 더 부드럽게 (0.3 -> 0.4)
          pointBackgroundColor: '#ffffff', // 포인트 안쪽은 흰색
          pointBorderColor: '#3b82F6', // 포인트 테두리는 파란색
          pointBorderWidth: 2, // 포인트 테두리 두께
          pointRadius: 4, // 평소 포인트 크기
          pointHoverRadius: 6, // 마우스 올렸을 때 포인트 크기
          fill: true // 채우기 켜기
        },
        {
          label: `작년 (2024)`,
          data: userData.lastYear,
          borderColor: '#9ca3af', // 회색 (Tailwind gray-400)
          borderWidth: 2,
          borderDash: [5, 5], // 점선
          tension: 0.3,
          pointRadius: 0, // 점 숨김
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      
      // ✨ [2. 말풍선 안 잘리게 레이아웃 여백 확보]
      layout: {
          padding: {
              top: 20, // 차트 위쪽에 20px 공백 강제 추가
              right: 10,
              left: 10,
              bottom: 0
          }
      },

      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          labels: {
            color: '#6b7280',
            font: { family: 'Pretendard', size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.9)', // 툴팁 배경 (진한 검정)
          titleColor: '#fff',
          bodyColor: '#e5e7eb',
          padding: 12,
          cornerRadius: 8,
          displayColors: false // 툴팁 안에 색깔 네모 박스 제거 (깔끔하게)
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(200, 200, 200, 0.1)' },
          ticks: { color: '#9ca3af' }
        },
        y: {
          // ✨ [핵심] grace: '10%' -> 데이터 최댓값보다 10% 더 높게 천장을 잡습니다.
          // 이렇게 하면 그래프가 꼭대기에 안 닿아서 말풍선이 뜰 공간이 생깁니다.
          grace: '30%',
          
          grid: { color: 'rgba(200, 200, 200, 0.1)' },
          ticks: { color: '#9ca3af' },
          beginAtZero: true
        }
      }
    }
  });
}
