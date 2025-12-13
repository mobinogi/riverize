// ===============================================
// 1. 전역 변수 설정
// ===============================================
let currentConsolidatedYear = new Date().getFullYear();
let allConsolidatedFiles = [];

// ===============================================
// 2. 뷰 전환 및 UI 제어 함수
// ===============================================

/**
 * 메인 뷰(화면)을 전환하는 함수 (사이드바 메뉴 클릭 시)
 */
function changeView(viewName) {
  // 1. 모든 뷰 숨기기
  const views = document.querySelectorAll('.view-content');
  views.forEach(el => el.classList.add('hidden'));

  // 2. 선택한 뷰 보이기
  const targetView = document.getElementById('view-' + viewName);
  if (targetView) {
    targetView.classList.remove('hidden');
  } else {
    console.error(`❌ 오류: 'view-${viewName}' ID를 가진 요소를 찾을 수 없습니다. index1.html을 확인하세요.`);
    return;
  }

  // 3. 사이드바 메뉴 활성화 표시
  document.querySelectorAll('#sidebar nav a').forEach(el => el.classList.remove('view-active'));
  const targetMenu = document.getElementById('menu-' + viewName);
  if (targetMenu) targetMenu.classList.add('view-active');

  // 4. 뷰별 특수 로직 실행
  if (viewName === 'consolidated') {
    fetchConsolidatedList();
  } else if (viewName === 'write') {
    if (typeof toggleSubTab === 'function') toggleSubTab('write'); 
  }
}

/**
 * 일보 작성 뷰 내의 서브 탭 전환
 */
function toggleSubTab(tabName) {
    document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.add('hidden'));
    const targetContent = document.getElementById('content-' + tabName);
    if (targetContent) targetContent.classList.remove('hidden');

    const btnContainer = document.querySelector('.flex.mb-0'); 
    if(btnContainer) {
        btnContainer.querySelectorAll('button').forEach(el => el.classList.remove('tab-active'));
        const targetTab = document.getElementById('tab-' + tabName);
        if (targetTab) targetTab.classList.add('tab-active');
    }
    
    if (tabName === 'review') {
        // ✅ 그냥 달력 그리기만 호출하면 됩니다.
        // (로딩 중이면 HTML에 넣어둔 로딩막이 알아서 돌아가고 있습니다)
        if (typeof renderCalendar === 'function') renderCalendar();
    }
}

function openSalesSheet() {
    const url = 'https://docs.google.com/spreadsheets/d/1p2glfJaac4EZG4vDD4n290hYwZyj7sXHJNkXv1YYtq8/edit?gid=0#gid=0';
    window.open(url, '_blank');
}


// ===============================================
// 3. 통합본 목록 기능 (연도별 필터링 포함)
// ===============================================

/**
 * 서버에서 전체 파일 목록 가져오기 (최초 1회)
 */
async function fetchConsolidatedList() {
    const listContainer = document.getElementById('consolidated-list');
    const statusEl = document.getElementById('consolidated-status');
    
    // 이미 불러온 데이터가 있으면 재사용 (속도 향상)
    if (allConsolidatedFiles.length > 0) {
        renderConsolidatedList();
        return;
    }

    // 2. 🚛 [수정] 데이터가 없으면 트럭 출동! (배달중...)
    if (typeof showLoader === 'function') {
        showLoader('통합본 목록을 배달중...', true); 
    }
  
    listContainer.innerHTML = '<p class="text-gray-500 text-center col-span-full">Drive에서 통합 파일을 검색 중입니다...</p>';
    statusEl.textContent = '상태: 검색 중...';
    
    // showLoader는 제거하고, 뷰 전환 시에만 메시지를 보여주도록 합니다.
    // if (typeof showLoader === 'function') showLoader('통합본 목록을 불러오는 중...'); 
    
    try {
        const result = await callAppsScript('getAllConsolidatedFiles'); 
        
        if (result.status === 'success' && Array.isArray(result.files)) {
            allConsolidatedFiles = result.files; // 전체 목록 저장
            
            // 최신 파일의 연도로 초기화
            if (result.currentYear) currentConsolidatedYear = result.currentYear;
            
            renderConsolidatedList();
            statusEl.textContent = '상태: 목록 로드 완료.';
        } else {
            // 🚨 오류 메시지 수정: 이미지와 동일하게 '파일 목록을 불러오는 데 실패' 표시
            listContainer.innerHTML = '<p class="text-red-500 text-center col-span-full">파일 목록을 불러오는 데 실패했습니다.</p>'; 
            statusEl.textContent = '상태: 오류 발생.';
        }

    } catch (e) {
        listContainer.innerHTML = `<p class="text-red-500 text-center col-span-full">서버 통신 오류: ${e.message}</p>`;
        statusEl.textContent = '상태: 통신 실패.';
    } finally {
         if (typeof hideLoader === 'function') hideLoader(); // hideLoader 제거
    }
}
/**
 * 🚀 [신규] 연도 변경 버튼 클릭 시 호출
 */
function changeConsolidatedYear(delta) {
    // 데이터가 없으면 반응 안 함
    if (allConsolidatedFiles.length === 0) return;
    
    currentConsolidatedYear += delta;
    renderConsolidatedList();
}


 /* 통합본 아이콘 목록 렌더링 (최종 안정화 버전)
 */
function renderConsolidatedList() {
    const listContainer = document.getElementById('consolidated-list');
    const headerYearEl = document.getElementById('consolidated-header-year');
    const statusEl = document.getElementById('consolidated-status');

    // 1. 헤더 연도 업데이트
    if(headerYearEl) {
        headerYearEl.textContent = `${currentConsolidatedYear}년`; 
    }

    // 2. 현재 연도에 맞는 파일만 필터링
    const filteredFiles = allConsolidatedFiles.filter(file => 
        file.name.includes(currentConsolidatedYear + '년')
    );
    
    // 3. 월별 오름차순 (1월 -> 12월) 정렬
    filteredFiles.sort((a, b) => {
        const getMonthNum = (name) => {
            const match = name.match(/(\d{1,2})월/); 
            return match ? parseInt(match[1], 10) : 0;
        };
        return getMonthNum(a.name) - getMonthNum(b.name); 
    });
    
    listContainer.innerHTML = '';

    // 4. 파일 없음 처리
    if (filteredFiles.length === 0) {
         listContainer.innerHTML = `<p class="text-gray-400 text-center col-span-full py-10">${currentConsolidatedYear}년도 통합본 파일이 없습니다.</p>`;
         statusEl.textContent = `상태: ${currentConsolidatedYear}년 데이터 없음.`;
         return;
    }
    
    // 5. 링크 연결 함수 정의
    const openFunc = typeof openSalesSummary === 'function' ? 'openSalesSummary' : 'openSheetApp'; 

    const iconUrl = "https://mobinogi.github.io/riverize/free-icon-text-files-72419.png"; 

    // 6. 아이콘 생성 및 텍스트 수정 (폰트 크기 안정화)
    filteredFiles.forEach(file => {
        const match = file.name.match(/(\d{1,2})월/); 
        const displayMonth = match ? match[1] : '??';

        const itemHtml = `
            <div onclick="${openFunc}('${file.url}')" 
                 class="flex flex-col items-center p-4 rounded-xl border border-transparent 
                        hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer 
                        w-full max-w-[120px] active:bg-blue-100/70 active:border-blue-500 group">
                <img src="${iconUrl}" 
                     alt="통합본 아이콘" 
                     class="w-16 h-16 mb-2 select-none group-hover:scale-110 transition-transform" 
                     onerror="this.onerror=null;this.src='https://via.placeholder.com/64/cccccc/000000?text=DOC'">
                <span class="text-lg font-bold text-gray-800 text-center leading-tight">
                    ${displayMonth}월
                </span>
            </div>
        `;
        listContainer.innerHTML += itemHtml;
    });
    
    statusEl.textContent = `상태: ${currentConsolidatedYear}년 데이터 ${filteredFiles.length}개 로드 완료.`;
}

/**
 * [핵심] 모든 모달과 오버레이를 강제로 숨기는 클린업 함수
 */
function cleanupOverlays() {
    // 보고서 옵션 모달 잔여물 제거 (버튼 먹통 해결)
    const reportModal = document.getElementById('report-option-modal');
    if (reportModal) {
        reportModal.classList.add('hidden'); 
        document.getElementById('ro-sheet').classList.add('translate-y-full');
        document.getElementById('ro-backdrop').classList.add('opacity-0');
    }
    
    // 기타 오버레이/모달 강제 숨김
    document.getElementById('map-overlay').classList.add('hidden');
    document.getElementById('loading-overlay').classList.add('hidden'); // 로딩 오버레이 닫기
    document.getElementById('confirm-modal').classList.add('hidden');
}

// ===============================================
// 🖱️ 사이드바 제어 (PC/모바일 통합 + 스와이프)
// ===============================================

/**
 * [마스터 함수] 사이드바 열고 닫기
 * - PC: 밀어내기 방식 (.closed 토글)
 * - 모바일: 덮어쓰기 방식 (.open 토글 + 백드롭)
 */
/* sidebar.js - toggleSidebar 함수 (최종_확정.js) */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const handle = document.getElementById('sidebar-handle'); 
    const body = document.body;
    
    // ★ 뉴스 티커 요소 가져오기
    const ticker = document.getElementById('news-ticker');

    if (!sidebar) return;

    // 현재 화면 너비 확인 (768px 미만이면 모바일)
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
        // 📱 [모바일] 기존 로직 유지 (티커 건드리지 않음)
        const isOpen = sidebar.classList.contains('open');
        if (isOpen) {
            sidebar.classList.remove('open');
            if (backdrop) {
                backdrop.classList.remove('opacity-100');
                setTimeout(() => backdrop.classList.add('hidden'), 300);
            }
            if (handle) handle.style.display = 'flex';
        } else {
            sidebar.classList.add('open');
            if (backdrop) {
                backdrop.classList.remove('hidden');
                setTimeout(() => backdrop.classList.add('opacity-100'), 10);
            }
            if (handle) handle.style.display = 'none';
        }

    } else {
        // 💻 [PC] 너비(Width) 직접 제어 방식
        sidebar.classList.toggle('closed');
        const isClosed = sidebar.classList.contains('closed');

        if (isClosed) {
            // [닫힘] 사이드바 사라짐 -> 티커가 왼쪽 구석(0)부터 끝(100%)까지 차지
            body.classList.add('sidebar-collapsed');
            
            if (ticker) {
                ticker.style.left = '0px';      // 왼쪽 벽에 딱 붙임
                ticker.style.width = '100%';    // 너비를 화면 전체로 늘림
            }

        } else {
            // [열림] 사이드바 나옴 -> 티커가 16rem만큼 비키고 나머지만 차지
            body.classList.remove('sidebar-collapsed');
            
            if (ticker) {
                ticker.style.left = '16rem';              // 사이드바 너비만큼 오른쪽으로 밀어냄
                ticker.style.width = 'calc(100% - 16rem)'; // 전체에서 사이드바만큼 뺀 나머지만 가짐
            }
        }
    }
}

// 👇 [제스처] 갤럭시처럼 화면 왼쪽 끝을 밀어서 열기 (Swipe)
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, {passive: true});

document.addEventListener('touchend', e => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const xDiff = touchEndX - touchStartX;
    const yDiff = touchEndY - touchStartY;

    // 1. 가로로 길게 밀었고 (50px 이상)
    // 2. 세로보다 가로 이동이 훨씬 클 때만 실행 (스크롤 오작동 방지)
    if (Math.abs(xDiff) > Math.abs(yDiff) && Math.abs(xDiff) > 50) {
        
        // Case A: 화면 왼쪽 끝(30px 이내)에서 오른쪽으로 밀었을 때 -> 열기
        if (touchStartX < 30 && xDiff > 0) {
            const sidebar = document.getElementById('sidebar');
            // 모바일에서만 작동 & 닫혀있을 때만 염
            if (window.innerWidth < 768 && sidebar && !sidebar.classList.contains('open')) {
                toggleSidebar();
            }
        }
        
        // Case B: 사이드바가 열려있을 때 왼쪽으로 밀었을 때 -> 닫기
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth < 768 && sidebar && sidebar.classList.contains('open') && xDiff < 0) {
            toggleSidebar();
        }
    }
}, {passive: true});
