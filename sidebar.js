// ===============================================
// 1. [설정] 전역 변수 (index.html의 변수를 참조함)
// ===============================================
// const API_URL = "..." (메인 스크립트에서 참조)
// let isDataLoading = false; (메인 스크립트에서 참조)


// ===============================================
// 2. 뷰 전환 및 UI 제어 함수 (Sidebar/Main Content)
// ===============================================

/**
 * 메인 뷰(화면)을 전환하는 함수 (사이드바 메뉴 클릭 시)
 * @param {string} viewName - 'write', 'consolidated'
 */
function changeView(viewName) {
  // 1. 뷰 콘텐츠 전환
  document.querySelectorAll('.view-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('view-' + viewName).classList.remove('hidden');

  // 2. 사이드바 메뉴 활성화/비활성화
  document.querySelectorAll('#sidebar nav a').forEach(el => el.classList.remove('view-active'));
  document.getElementById('menu-' + viewName).classList.add('view-active');

  // 3. 특정 뷰 로직 실행
  if (viewName === 'consolidated') {
    fetchConsolidatedList();
  } else if (viewName === 'write') {
    // 일보 작성 뷰로 돌아오면, 기본적으로 '작성' 탭 활성화 (메인 스크립트의 toggleSubTab 함수 사용)
    if (typeof toggleSubTab === 'function') toggleSubTab('write'); 
  }
}

/**
 * 기존 일보 작성 뷰 내의 서브 탭 전환 함수 (메인 스크립트에서 가져옴)
 */
function toggleSubTab(tabName) {
    document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('content-' + tabName).classList.remove('hidden');

    document.querySelectorAll('.flex.mb-4 button').forEach(el => el.classList.remove('tab-active', 'text-green-600'));
    document.getElementById('tab-' + tabName).classList.add('tab-active');
    
    // 날짜 검색 탭 로직 (메인 스크립트의 함수들 사용)
    if (tabName === 'review') {
        // isDataLoading, renderCalendar 등 메인 스크립트의 함수들을 호출합니다.
        if (typeof isDataLoading !== 'undefined' && isDataLoading) {
            if (typeof showLoader === 'function') showLoader(currentMonth + '월 달력 정보를 불러오는 중...');
        } else if (typeof renderCalendar === 'function') {
            renderCalendar();
        }
    }
}

/**
 * 매출표 작성 외부 링크 열기
 */
function openSalesSheet() {
    const url = 'https://docs.google.com/spreadsheets/d/1p2glfJaac4EZG4vDD4n290hYwZyj7sXHJNkXv1YYtq8/edit?gid=0#gid=0';
    window.open(url, '_blank');
}


// ===============================================
// 3. 통합본 목록 기능 (신규)
// ===============================================

async function fetchConsolidatedList() {
    const listContainer = document.getElementById('consolidated-list');
    const statusEl = document.getElementById('consolidated-status');
    listContainer.innerHTML = '<p class="text-gray-500 text-center">Drive에서 통합 파일을 검색 중입니다...</p>';
    statusEl.textContent = '상태: 검색 중...';
    
    if (typeof showLoader === 'function') showLoader('통합본 목록을 불러오는 중...');
    
    try {
        // [GAS 함수 호출] (callAppsScript 함수는 메인 스크립트에서 참조)
        const result = await callAppsScript('getAllConsolidatedFiles'); 
        
        if (result.status === 'success' && Array.isArray(result.files)) {
            renderConsolidatedList(result.files, result.currentYear);
            statusEl.textContent = '상태: 목록 로드 완료.';
        } else {
            listContainer.innerHTML = '<p class="text-red-500 text-center">파일 목록을 불러오는 데 실패했습니다.</p>';
            statusEl.textContent = '상태: 오류 발생.';
        }

    } catch (e) {
        listContainer.innerHTML = `<p class="text-red-500 text-center">서버 통신 오류: ${e.message}</p>`;
        statusEl.textContent = '상태: 통신 실패.';
    } finally {
        if (typeof hideLoader === 'function') hideLoader();
    }
}

/**
 * 통합본 아이콘 목록을 그리는 함수 (Windows 스타일)
 */
function renderConsolidatedList(files, currentYear) {
    const listContainer = document.getElementById('consolidated-list');
    listContainer.innerHTML = '';
    
    // 헤더 설정 (예: 2025년 통합본)
    document.getElementById('consolidated-header').textContent = `${currentYear}년 통합본`;

    if (files.length === 0) {
         listContainer.innerHTML = '<p class="text-gray-500 text-center col-span-full">현재 Drive에 등록된 통합본 파일이 없습니다.</p>';
         return;
    }
    
    const iconUrl = "https://mobinogi.github.io/riverize/free-icon-text-files-72419.png";

    files.forEach(file => {
        // 파일명에서 연/월 추출 (정규식은 백엔드에서 처리했으나, 혹시 몰라 이름에서 추출)
        const match = file.name.match(/(\d{4})년\s*(\d{1,2})월/);
        const displayYear = match ? match[1] : '';
        const displayMonth = match ? match[2] : '';


        const itemHtml = `
            <div onclick="openSalesSummary('${file.url}')" 
                 class="flex flex-col items-center p-4 rounded-xl border border-transparent 
                        hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer 
                        w-full max-w-[120px] active:bg-blue-100/70 active:border-blue-500">
                <img src="${iconUrl}" 
                     alt="통합본 아이콘" 
                     class="w-16 h-16 mb-2 select-none" 
                     onerror="this.onerror=null;this.src='https://via.placeholder.com/64/cccccc/000000?text=DOC'">
                <span class="text-xs font-semibold text-gray-700 text-center leading-tight">
                    ${displayYear}년 ${displayMonth}월 통합본
                </span>
            </div>
        `;
        listContainer.innerHTML += itemHtml;
    });
}

/**
 * 월별 통합본 파일을 새 창으로 여는 함수 (Drive File)
 */
function openSalesSummary(url) {
     window.open(url, '_blank');
}

// ===============================================
// 4. 초기화 실행 (DOMContentLoaded)
// ===============================================

// DOMContentLoaded는 메인 스크립트에서 처리하므로, 여기서는 changeView만 호출합니다.
// 메인 스크립트의 DOMContentLoaded 이벤트에서 changeView('write')를 호출해야 합니다.
