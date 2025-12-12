document.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth >= 768) {
        startNewsTicker();
    }
});

async function startNewsTicker() {
    const tickerContainer = document.getElementById('news-ticker');
    const tickerText = document.getElementById('ticker-text'); // .ticker-content
    
    // 글로벌 툴팁 요소 가져오기
    const tooltip = document.getElementById('global-tooltip');

    if (!tickerContainer || !tickerText) return;

    try {
        const result = await callAppsScript('getLocalNews'); 
        
        if (result.status === 'success' && result.news.length > 0) {
            tickerText.innerHTML = ''; 
            
            // ★ 움직이는 트랙 생성 (애니메이션 대상)
            const track = document.createElement('div');
            track.className = 'ticker-track';
            
            // 뉴스 아이템 생성
            result.news.forEach((item) => {
                const span = document.createElement('span');
                span.className = "news-item";
                span.textContent = item.title;
                span.onclick = () => window.open(item.link, '_blank');
                
                // ★ 툴팁 이벤트 (마우스 따라다니기)
                if (tooltip) {
                    span.onmouseenter = () => { tooltip.classList.remove('hidden'); };
                    span.onmouseleave = () => { tooltip.classList.add('hidden'); };
                    span.onmousemove = (e) => {
                        tooltip.style.left = e.clientX + 15 + 'px';
                        tooltip.style.top = e.clientY + 15 + 'px';
                    };
                }

                track.appendChild(span);
            });

            tickerText.appendChild(track);
            tickerContainer.classList.remove('hidden'); 
        }
    } catch (e) {
        console.warn("뉴스 로딩 실패:", e);
    }
}
