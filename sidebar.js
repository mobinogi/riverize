// ===============================================
// 1. 전역 변수 설정
// ===============================================
let currentConsolidatedYear = new Date().getFullYear();
let allConsolidatedFiles = [];

// ===============================================
// 2. 유틸리티 및 UI 헬퍼 함수
// ===============================================

/**
 * [핵심] 모든 모달과 오버레이를 강제로 숨기는 클린업 함수
 */
function cleanupOverlays() {
    // #report-option-modal 잔여물 제거
    const reportModal = document.getElementById('report-option-modal');
    if (reportModal) {
        reportModal.classList.add('hidden'); 
        // 애니메이션 클래스 초기화 (투명 잔여물 제거)
        document.getElementById('ro-sheet').classList.add('translate-y-full');
        document.getElementById('ro-backdrop').classList.add('opacity-0');
    }
    
    // 기타 오버레이/모달 강제 숨김
    document.getElementById('map-overlay').classList.add('hidden');
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('confirm-modal').classList.add('hidden');
    // 추가적인 바텀 시트들도 필요하면 여기에 추가 (예: nav-confirm-modal, delete-confirm-modal)
}


/**
 * [트럭 애니메이션용] 로딩 메시지를 설정하고 오버레이를 띄웁니다.
 */
function showLoader(message) { 
    const overlay = document.getElementById('loading-overlay');
    
    if (!overlay) {
        console.error("❌ 로딩 오버레이 #loading-overlay 요소를 찾을 수 없습니다.");
        return; 
    }
    
    // ID: loading-message-display 참조
    const msgEl = document.getElementById('loading-message-display'); 
    if (msgEl) {
        msgEl.textContent = message;
    } 
    
    overlay.classList.remove('hidden'); 
}

/**
 * 로딩 오버레이를 숨깁니다.
 */
function hideLoader() { 
    document.getElementById('loading-overlay').classList.add('hidden'); 
}

/**
 * 새 창 또는 앱으로 스프레드시트 링크를 엽니다.
 */
function openSalesSummary(url) {
    // index1.html의 openSheetApp 함수를 사용합니다.
    if (typeof openSheetApp === 'function') {
        openSheetApp(url);
    } else {
        window.open(url, '_blank');
    }
}


// ===============================================
// 3. 뷰 전환 및 목록 제어 함수
// ===============================================

/**
 * 메인 뷰(화면)을 전환하는 함수 (사이드바 메뉴 클릭 시)
 */
function changeView(viewName) {
  // 💡 [핵심] 뷰 전환 시, 모든 오버레이 잔여물을 강제로 제거합니다.
  cleanupOverlays();
  
  const views = document.querySelectorAll('.view-content');
  views.forEach(el => el.classList.add('hidden'));

  const targetView = document.getElementById('view-' + viewName);
  if (targetView) {
    targetView.classList.remove('hidden');
  } else {
    console.error(`❌ 오류: 'view-${viewName}' ID를 가진 요소를 찾을 수 없습니다. index1.html을 확인하세요.`);
    return;
  }

  document.querySelectorAll('#sidebar nav a').forEach(el => el.classList.remove('view-active'));
  const targetMenu = document.getElementById('menu-' + viewName);
  if (targetMenu) targetMenu.classList.add('view-active');
  
  if (viewName === 'consolidated') {
    fetchConsolidatedList();
  } else if (viewName === 'write') {
    // 💡 [수정] index1.html에 정의된 toggleSubTab을 호출합니다.
    if (typeof toggleSubTab === 'function') toggleSubTab('write'); 
  }
}

/**
 * 일보 작성 뷰 내의 서브 탭 전환 (index1.html에도 정의되어 있으면 중복)
 */
function toggleSubTab(tabName) {
    // 💡 [핵심] 이 함수는 index1.html에 정의된 것을 사용해야 합니다.
    // 여기서는 안전을 위해 정의를 생략하거나 index1.html과 동일하게 유지합니다.
    
    // 만약 index1.html에서 이 함수를 정의하지 않았다면 아래 코드를 사용합니다.
    document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.add('hidden'));
    const targetContent = document.getElementById('content-' + tabName);
    if (targetContent) targetContent.classList.remove('hidden');
    // ... (나머지 탭 전환 로직) ...
}

// ... (fetchConsolidatedList, changeConsolidatedYear 함수 유지) ...

/**
 * 통합본 아이콘 목록 렌더링 (최종 안정화 버전)
 */
function renderConsolidatedList() {
    // ... (목록 렌더링 로직 유지) ...
    // 이 함수는 hideLoader/showLoader를 사용하므로, 위에서 정의된 버전을 사용합니다.
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
    
    const openFunc = 'openSalesSummary'; 

    const iconUrl = "https://mobinogi.github.io/riverize/free-icon-text-files-72419.png"; 

    // 5. 아이콘 생성 및 텍스트 수정
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
                     class="w-16 h-16 mb-2 select-none group-hover:scale-120 transition-transform object-contain" 
                     onerror="this.onerror=null;this.src='https://via.placeholder.com/64/cccccc/000000?text=DOC'">
                <span class="text-xl font-bold text-gray-800 text-center leading-tight">
                    ${displayMonth}월
                </span>
            </div>
        `;
        listContainer.innerHTML += itemHtml;
    });
    
    statusEl.textContent = `상태: ${currentConsolidatedYear}년 데이터 ${filteredFiles.length}개 로드 완료.`;
}
