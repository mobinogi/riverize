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
        if (typeof isDataLoading !== 'undefined' && isDataLoading) {
            if (typeof showLoader === 'function') showLoader('달력 정보를 불러오는 중...');
        } else if (typeof renderCalendar === 'function') {
            renderCalendar();
        }
    }
}

function openSalesSheet() {
    const url = 'https://docs.google.com/spreadsheets/d/1p2glfJaac4EZG4vDD4n290hYwZyj7sXHJNkXv1YYtq8/edit?gid=0#gid=0';
    window.open(url, '_blank');
}

// ⚠️ openSalesSummary 함수가 index1.html에 없으므로 여기에 포함시켜 둡니다.
function openSalesSummary(url) {
    if (typeof openSheetApp === 'function') {
        openSheetApp(url);
    } else {
        window.open(url, '_blank');
    }
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
    
    if (allConsolidatedFiles.length > 0) {
        renderConsolidatedList();
        return;
    }
    
    listContainer.innerHTML = '<p class="text-gray-500 text-center col-span-full">Drive에서 통합 파일을 검색 중입니다...</p>';
    statusEl.textContent = '상태: 검색 중...';
    
    try {
        const result = await callAppsScript('getAllConsolidatedFiles'); 
        
        if (result.status === 'success' && Array.isArray(result.files)) {
            allConsolidatedFiles = result.files;
            
            if (result.currentYear) currentConsolidatedYear = result.currentYear;
            
            renderConsolidatedList();
            statusEl.textContent = '상태: 목록 로드 완료.';
        } else {
            listContainer.innerHTML = '<p class="text-red-500 text-center col-span-full">파일 목록을 불러오는 데 실패했습니다.</p>'; 
            statusEl.textContent = '상태: 오류 발생.';
        }

    } catch (e) {
        listContainer.innerHTML = `<p class="text-red-500 text-center col-span-full">서버 통신 오류: ${e.message}</p>`;
        statusEl.textContent = '상태: 통신 실패.';
    } finally {
        // hideLoader() 호출 제거
    }
}
/**
 * 🚀 연도 변경 버튼 클릭 시 호출
 */
function changeConsolidatedYear(delta) {
    if (allConsolidatedFiles.length === 0) return;
    
    currentConsolidatedYear += delta;
    renderConsolidatedList();
}


/**
 * 통합본 아이콘 목록 렌더링 (최종 안정화 버전)
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
    
    // 5. 링크 연결 함수 정의 (openSalesSummary는 위에 정의됨)
    const openFunc = 'openSalesSummary'; 

    const iconUrl = "https://mobinogi.github.io/riverize/free-icon-text-files-72419.png"; 

    // 6. 아이콘 생성 및 텍스트 수정
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
                     class="w-16 h-16 mb-2 select-none group-hover:scale-120 transition-transform **object-contain**" 
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
