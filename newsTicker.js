/* newsTicker.js 전체 교체 */

document.addEventListener('DOMContentLoaded', () => {
    // 혹시 모를 로딩 지연 대비 텍스트 표시
    const tickerContainer = document.getElementById('news-ticker'); 
    const tickerText = document.getElementById('ticker-text');
    
    if (tickerContainer && tickerText && window.innerWidth >= 768) {
        // 일단 보이게 처리
        tickerContainer.style.display = 'flex';
        // 로딩 중 문구
        if(!tickerText.innerHTML.trim()) {
            tickerText.innerHTML = '<div style="padding-left:20px; color:#aaa; font-size:13px;">뉴스 로딩 중...</div>';
        }
        startNewsTicker();
    }
});

async function startNewsTicker() {
    const tickerContainer = document.getElementById('news-ticker');
    const tickerText = document.getElementById('ticker-text'); 
    const tooltip = document.getElementById('global-tooltip');

    if (!tickerContainer || !tickerText) return;

    try {
        const result = await callAppsScript('getLocalNews'); 
        
        if (result.status === 'success' && result.news.length > 0) {
            tickerText.innerHTML = ''; 
            
            const track = document.createElement('div');
            track.className = 'ticker-track';
            
            result.news.forEach((item) => {
                const span = document.createElement('span');
                span.className = "news-item";
                span.textContent = item.title;
                span.onclick = () => window.open(item.link, '_blank');
                
                // ★ 툴팁 위치 수정 (마우스 위쪽으로)
                if (tooltip) {
                    span.onmouseenter = () => { tooltip.classList.remove('hidden'); };
                    span.onmouseleave = () => { tooltip.classList.add('hidden'); };
                    span.onmousemove = (e) => {
                        tooltip.style.left = (e.clientX + 10) + 'px';
                        // 마우스보다 40px 위에 표시
                        tooltip.style.top = (e.clientY - 40) + 'px'; 
                    };
                }
                track.appendChild(span);
            });

            tickerText.appendChild(track);

            // 🚀 글자 길이에 맞춰 속도 최적화 (너무 빠르지 않게)
            setTimeout(() => {
                const trackWidth = track.scrollWidth; // 글자 전체 길이
                const boxWidth = tickerContainer.clientWidth; // 화면 너비
                const totalDist = trackWidth + boxWidth; // 이동할 총 거리
                
                // 속도: 초당 50픽셀 (숫자가 작을수록 느림)
                const speed = 50; 
                const duration = totalDist / speed;
                
                // 계산된 시간이 0이 아니면 적용
                if (duration > 0) {
                    track.style.animationDuration = duration + 's';
                }
            }, 100); // 0.1초 뒤 계산 (안정성)
        }
    } catch (e) {
        console.warn("뉴스 로딩 실패:", e);
    }
}
