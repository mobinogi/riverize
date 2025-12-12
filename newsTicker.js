/* newsTicker.js - 개인화 뉴스 피드 기능 탑재 */

let newsInterval = null;
let lastNewsData = "";

// 기본 설정 (아무것도 선택 안 했을 때)
const DEFAULT_CATEGORIES = ['busan']; 

document.addEventListener('DOMContentLoaded', () => {
    const tickerContainer = document.getElementById('news-ticker');
    const tickerText = document.getElementById('ticker-text');
    
    // 1. 저장된 설정 불러와서 체크박스에 반영하기
    loadNewsSettingsUI();

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
// 1. 뉴스 티커 실행 로직 (자동 갱신 포함)
// ==========================================
function startNewsTicker() {
    fetchAndRenderNews();
    if (newsInterval) clearInterval(newsInterval);
    newsInterval = setInterval(fetchAndRenderNews, 600000); // 10분마다 갱신
}

async function fetchAndRenderNews() {
    const tickerText = document.getElementById('ticker-text');
    const tickerContainer = document.getElementById('news-ticker');
    const tooltip = document.getElementById('global-tooltip');

    // ★ [핵심] 현재 선택된 카테고리 가져오기
    const selectedCats = getSelectedCategories();
    
    // 라벨 텍스트 업데이트 (예: "부산 외 2개")
    updateLabelText(selectedCats);

    if (!tickerText) return;

    try {
        // ★ [핵심] 서버로 카테고리 정보 전송! (categories: 'busan,economy' 형태)
        // GAS 쪽에서 이 파라미터를 받아서 처리를 해줘야 함
        const result = await callAppsScript('getLocalNews', { 
            categories: selectedCats.join(',') 
        }); 
        
        if (result.status === 'success' && result.news.length > 0) {
            
            // 중복 갱신 방지
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
                
                // 툴팁
                if (tooltip) {
                    span.onmouseenter = () => { tooltip.classList.remove('hidden'); };
                    span.onmouseleave = () => { tooltip.classList.add('hidden'); };
                    span.onmousemove = (e) => {
                        tooltip.style.left = (e.clientX + 10) + 'px';
                        tooltip.style.top = (e.clientY - 60) + 'px'; 
                    };
                }
                track.appendChild(span);
            });

            tickerText.appendChild(track);

            // 속도 계산
            setTimeout(() => {
                const trackWidth = track.scrollWidth;
                const boxWidth = window.innerWidth;
                const totalDist = trackWidth + boxWidth;
                const speed = 60; 
                const duration = totalDist / speed;
                if (duration > 0) track.style.animationDuration = duration + 's';
            }, 100);
        } else {
            // 뉴스 없음 처리
            tickerText.innerHTML = '<div style="padding-left:20px; color:#aaa; font-size:13px;">선택한 카테고리의 뉴스가 없습니다.</div>';
        }
    } catch (e) {
        console.warn("뉴스 로딩 실패:", e);
    }
}

// ==========================================
// 2. 설정 팝업 & 저장 로직 (LocalStorage)
// ==========================================

// 팝업 열기/닫기
function toggleNewsSettings(e) {
    if(e) e.stopPropagation(); // 라벨 클릭 시 팝업 닫힘 방지
    const popup = document.getElementById('news-settings-popup');
    popup.classList.toggle('hidden');

    if (popup.classList.contains('hidden')) {
        // 열 때: 현재 설정대로 체크박스 UI 맞춤 (취소하고 나갔을 때 대비)
        loadNewsSettingsUI();
        popup.classList.remove('hidden');
    } else {
        // 닫을 때: 저장 & 적용
        closeNewsSettings();
    }
}

function closeNewsSettings() {
    document.getElementById('news-settings-popup').classList.add('hidden');
    if (popup && !popup.classList.contains('hidden')) {
        popup.classList.add('hidden');
        // ★ 여기서 저장 및 갱신 실행!
        saveNewsSettings();
    }
}

// 바깥 클릭 시 닫기
document.addEventListener('click', (e) => {
    const popup = document.getElementById('news-settings-popup');
    const label = document.querySelector('.ticker-label');
    // 팝업이 열려있고, 팝업이나 라벨을 클릭한 게 아니라면 -> 닫기
    if (popup && !popup.classList.contains('hidden')) {
        if (!popup.contains(e.target) && !label.contains(e.target)) {
            closeNewsSettings();
        }
    }
});

// 4. 저장 & 티커 새로고침 (변경사항 있을 때만!)
function saveNewsSettings() {
    const selected = [];
    document.querySelectorAll('input[name="news-cat"]:checked').forEach(el => {
        selected.push(el.value);
    });

    // ★ [부활 및 업그레이드] 하나도 선택 안 했으면 '강서구' 강제 주입
    if (selected.length === 0) {
        selected.push('gangseo'); 
    }

    // ① 변경된 게 있는지 확인 (없으면 리로딩 안 함 -> 깜빡임 방지)
    const currentSaved = JSON.parse(localStorage.getItem('user_news_settings') || "[]");
    
    // 배열 내용물 비교 (순서 상관없이)
    const isSame = JSON.stringify(selected.sort()) === JSON.stringify(currentSaved.sort());
    
    if (isSame) {
        return; // 바뀐 거 없으면 조용히 종료
    }

    // ② 변경사항 저장
    localStorage.setItem('user_news_settings', JSON.stringify(selected));

    // ③ UI 업데이트 (체크박스 상태도 강제 주입된 '강서구'로 다시 맞춤)
    loadNewsSettingsUI();

    // ④ 티커 새로고침
    const tickerText = document.getElementById('ticker-text');
    if(tickerText) tickerText.innerHTML = '<div style="padding-left:20px; color:#aaa; font-size:13px;">채널 변경 적용 중...</div>';
    
    lastNewsData = ""; 
    startNewsTicker(); 
}


// 초기 로딩 시 체크박스 상태 복구
function loadNewsSettingsUI() {
    const saved = localStorage.getItem('user_news_settings');
    let cats = DEFAULT_CATEGORIES;
    
    if (saved) {
        try { cats = JSON.parse(saved); } catch(e) {}
    }

    // 체크박스들 체크하기
    document.querySelectorAll('input[name="news-cat"]').forEach(el => {
        el.checked = cats.includes(el.value);
    });
}

// 현재 선택된 카테고리 배열 반환
function getSelectedCategories() {
    const saved = localStorage.getItem('user_news_settings');
    if (saved) {
        try { 
            const parsed = JSON.parse(saved); 
            return parsed.length > 0 ? parsed : DEFAULT_CATEGORIES;
        } catch(e) { return DEFAULT_CATEGORIES; }
    }
    return DEFAULT_CATEGORIES;
}

// 라벨 텍스트 업데이트 ("부산·강서" -> "부산전체 외 1개")
function updateLabelText(cats) {
    const label = document.getElementById('current-news-cate');
    const names = {
        'gangseo': '부산·강서',
        'busan': '부산전체',     // [추가됨]
        'national': '국내전체',
        'politics': '정치',
        'economy': '경제',
        'society': '사회'
    };

    if (cats.length === 0) {
        label.textContent = "부산·강서"; // 기본값
    } else if (cats.length === 1) {
        label.textContent = names[cats[0]] || cats[0];
    } else {
        const first = names[cats[0]] || cats[0];
        label.textContent = `${first} 외 ${cats.length - 1}`;
    }
}
