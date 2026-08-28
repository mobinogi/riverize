/* newsTicker.js - 최종 완성본 (툴팁, 설정 저장, 팝업, 자동 갱신 포함) */

let newsInterval = null;
let lastNewsData = "";

// 기본 설정값
const DEFAULT_CATEGORIES = ['gangseo']; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. 저장된 설정 불러와서 체크박스 미리 체크해두기
    loadNewsSettingsUI();

    const tickerContainer = document.getElementById('news-ticker'); 
    const tickerText = document.getElementById('ticker-text');
    
    if (tickerContainer && window.innerWidth >= 768) {
        tickerContainer.classList.remove('hidden'); 
        tickerContainer.style.display = 'flex';     
        
        if(tickerText && !tickerText.innerHTML.trim()) {
            tickerText.innerHTML = '<div style="padding-left:20px; color:#aaa; font-size:13px;">뉴스 로딩 중...</div>';
        }
        startNewsTicker();
    }
});

// ==========================================
// 1. 뉴스 티커 실행 로직
// ==========================================
function startNewsTicker() {
    fetchAndRenderNews();
    if (newsInterval) clearInterval(newsInterval);
    newsInterval = setInterval(fetchAndRenderNews, 600000); // 10분마다 갱신
}

async function fetchAndRenderNews() {
    const tickerText = document.getElementById('ticker-text');
    
    // ★ [복구] 툴팁 요소 가져오기 (인덱스 파일 어딘가에 id="global-tooltip"이 있어야 함)
    const tooltip = document.getElementById('global-tooltip');

    const selectedCats = getSelectedCategories();
    updateLabelText(selectedCats); // 라벨 이름 바꾸기

    if (!tickerText) return;

    try {
        // 서버(code.js)로 요청
        const result = await callAppsScript('getLocalNews', { 
            categories: selectedCats.join(',') 
        }); 
        
        if (result.status === 'success' && result.news.length > 0) {
            
            const currentNewsJson = JSON.stringify(result.news);
            if (currentNewsJson === lastNewsData) return;
            lastNewsData = currentNewsJson;

            tickerText.innerHTML = ''; 
            const track = document.createElement('div');
            track.className = 'ticker-track';
            
            result.news.forEach((item) => {
                const span = document.createElement('span');
                span.className = "news-item";
                span.textContent = item.title;
                span.onclick = () => window.open(item.link, '_blank');
                
                // ★★★ [수정됨] 내용을 덮어쓰지 않고 보여주기만 함! ★★★
                if (tooltip) {
                    span.onmouseenter = () => { 
                        // tooltip.textContent = item.title;  <-- 범인 검거! 이 줄을 삭제했습니다.
                        tooltip.classList.remove('hidden'); 
                    };
                    span.onmouseleave = () => { 
                        tooltip.classList.add('hidden'); 
                    };
                    span.onmousemove = (e) => {
                        tooltip.style.left = (e.clientX + 10) + 'px';
                        tooltip.style.top = (e.clientY - 40) + 'px'; 
                    };
                }
                
                track.appendChild(span);
            });

            tickerText.appendChild(track);

            // 애니메이션 속도 조절
            setTimeout(() => {
                const trackWidth = track.scrollWidth;
                const boxWidth = window.innerWidth;
                const totalDist = trackWidth + boxWidth;
                const duration = totalDist / 60; // 속도 조절
                if (duration > 0) track.style.animationDuration = duration + 's';
            }, 100);
        } else {
            // 뉴스 없을 때
            const msg = (result.news && result.news.length > 0) ? result.news[0].title : "선택한 카테고리의 뉴스가 없습니다.";
            tickerText.innerHTML = `<div style="padding-left:20px; color:#aaa; font-size:13px;">${msg}</div>`;
        }
    } catch (e) {
        console.warn("뉴스 로딩 실패:", e);
    }
}

// ==========================================
// 2. 설정 팝업 & 저장 로직
// ==========================================

// 팝업 열기/닫기 (토글)
function toggleNewsSettings(e) {
    if(e) e.stopPropagation();
    const popup = document.getElementById('news-settings-popup');
    
    if (popup.classList.contains('hidden')) {
        // 열 때: 저장된 상태로 체크박스 UI 동기화
        loadNewsSettingsUI();
        popup.classList.remove('hidden');
    } else {
        // 닫을 때: 저장하고 닫기
        closeNewsSettings();
    }
}

function closeNewsSettings() {
    const popup = document.getElementById('news-settings-popup');
    if (popup && !popup.classList.contains('hidden')) {
        popup.classList.add('hidden');
        // 닫히면서 저장 실행!
        saveNewsSettings();
    }
}

// 바깥 클릭 시 닫기
document.addEventListener('click', (e) => {
    const popup = document.getElementById('news-settings-popup');
    const label = document.querySelector('.ticker-label');
    if (popup && !popup.classList.contains('hidden')) {
        if (!popup.contains(e.target) && !label.contains(e.target)) {
            closeNewsSettings();
        }
    }
});

// 저장 및 티커 갱신 (변경된 게 있을 때만)
function saveNewsSettings() {
    const selected = [];
    document.querySelectorAll('input[name="news-cat"]:checked').forEach(el => {
        selected.push(el.value);
    });

    // 다 끄면 강서구 강제 주입
    if (selected.length === 0) {
        selected.push('gangseo'); 
    }

    const currentSaved = JSON.parse(localStorage.getItem('user_news_settings') || "[]");
    const isSame = JSON.stringify(selected.sort()) === JSON.stringify(currentSaved.sort());
    
    if (isSame) return; // 변경 없으면 종료

    // 저장
    localStorage.setItem('user_news_settings', JSON.stringify(selected));

    // UI 동기화 (강제 주입된 '강서구' 체크 등)
    loadNewsSettingsUI();

    // 티커 새로고침 (로딩 표시)
    const tickerText = document.getElementById('ticker-text');
    if(tickerText) tickerText.innerHTML = '<div style="padding-left:20px; color:#aaa; font-size:13px;">채널 변경 적용 중...</div>';
    
    lastNewsData = ""; 
    startNewsTicker(); 
}

// ==========================================
// 3. 필수 부속품 함수들
// ==========================================

// UI에 체크박스 상태 반영
function loadNewsSettingsUI() {
    const saved = localStorage.getItem('user_news_settings');
    let cats = DEFAULT_CATEGORIES;
    if (saved) { try { cats = JSON.parse(saved); } catch(e) {} }
    
    document.querySelectorAll('input[name="news-cat"]').forEach(el => {
        el.checked = cats.includes(el.value);
    });
}

// 현재 저장된 카테고리 가져오기
function getSelectedCategories() {
    const saved = localStorage.getItem('user_news_settings');
    if (saved) { try { const parsed = JSON.parse(saved); return parsed.length > 0 ? parsed : DEFAULT_CATEGORIES; } catch(e) { return DEFAULT_CATEGORIES; } }
    return DEFAULT_CATEGORIES;
}

// 라벨 이름 업데이트
function updateLabelText(cats) {
    const label = document.getElementById('current-news-cate');
    if(!label) return;
    
    const names = { 
        'gangseo': '부산·강서', 
        'busan': '부산전체', 
        'national': '국내전체', 
        'politics': '정치', 
        'economy': '경제', 
        'society': '사회' 
    };

    if (cats.length === 0) label.textContent = "부산·강서";
    else if (cats.length === 1) label.textContent = names[cats[0]] || cats[0];
    else {
        const first = names[cats[0]] || cats[0];
        label.textContent = `${first} 외 ${cats.length - 1}`;
    }
}
