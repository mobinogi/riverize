/* newsTicker.js - 자동 갱신 기능 추가됨 */

let newsInterval = null;     // 타이머 저장 변수
let lastNewsData = "";       // 중복 갱신 방지용 (이전 뉴스 기억)

document.addEventListener('DOMContentLoaded', () => {
    const tickerContainer = document.getElementById('news-ticker'); 
    const tickerText = document.getElementById('ticker-text');
    
    if (tickerContainer && window.innerWidth >= 768) {
        tickerContainer.classList.remove('hidden'); 
        tickerContainer.style.display = 'flex';     
        
        // 처음엔 로딩 표시
        if(tickerText && !tickerText.innerHTML.trim()) {
            tickerText.innerHTML = '<div style="padding-left:20px; color:#aaa; font-size:13px;">뉴스 로딩 중...</div>';
        }
        
        // 티커 시작!
        startNewsTicker();
    }
});

function startNewsTicker() {
    // 1. 처음에 한 번 실행
    fetchAndRenderNews();

    // 2. 이미 타이머가 돌고 있으면 끄고 (중복 방지)
    if (newsInterval) clearInterval(newsInterval);

    // 3. 10분마다(600,000ms) 자동으로 뉴스 갱신
    newsInterval = setInterval(fetchAndRenderNews, 600000); 
}

// 실제 뉴스를 가져와서 그리는 함수 (분리됨)
async function fetchAndRenderNews() {
    const tickerContainer = document.getElementById('news-ticker');
    const tickerText = document.getElementById('ticker-text'); 
    const tooltip = document.getElementById('global-tooltip');

    if (!tickerContainer || !tickerText) return;

    try {
        // console.log("📰 뉴스 업데이트 확인 중..."); // 로그 너무 많이 찍히면 주석 처리
        const result = await callAppsScript('getLocalNews'); 
        
        if (result.status === 'success' && result.news.length > 0) {
            
            // ★ [핵심] 스마트 갱신: 뉴스가 이전과 똑같으면 화면을 건드리지 않음 (티커 끊김 방지)
            const currentNewsJson = JSON.stringify(result.news);
            if (currentNewsJson === lastNewsData) {
                // console.log("✅ 새 뉴스가 없습니다. 기존 티커 유지.");
                return; 
            }
            
            // 뉴스가 달라졌을 때만 아래 실행 (화면 갱신)
            lastNewsData = currentNewsJson; // 새 뉴스 기억
            // console.log("🔥 새로운 뉴스가 감지되어 티커를 갱신합니다!");

            tickerText.innerHTML = ''; // 기존 내용 지움
            
            const track = document.createElement('div');
            track.className = 'ticker-track';
            
            result.news.forEach((item) => {
                const span = document.createElement('span');
                span.className = "news-item";
                span.textContent = item.title;
                span.onclick = () => window.open(item.link, '_blank');
                
                // 툴팁 설정
                if (tooltip) {
                    span.onmouseenter = () => { tooltip.classList.remove('hidden'); };
                    span.onmouseleave = () => { tooltip.classList.add('hidden'); };
                    span.onmousemove = (e) => {
                        tooltip.style.left = (e.clientX + 10) + 'px';
                        
                        // 높이 계산 (화면 뚫으면 위로)
                        const spaceBottom = window.innerHeight - e.clientY;
                        tooltip.style.top = (e.clientY - 60) + 'px'; 
                    };
                }
                track.appendChild(span);
            });

            tickerText.appendChild(track);

            // 속도 계산 및 적용
            setTimeout(() => {
                const trackWidth = track.scrollWidth;
                const boxWidth = tickerContainer.clientWidth;
                const totalDist = trackWidth + boxWidth;
                const speed = 50; 
                const duration = totalDist / speed;
                
                if (duration > 0) track.style.animationDuration = duration + 's';
            }, 100);
        }
    } catch (e) {
        console.warn("뉴스 갱신 실패 (잠시 후 다시 시도합니다):", e);
    }
}
