/* newsTicker.js 전체 교체 */

document.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth >= 768) {
        startNewsTicker();
    }
});

async function startNewsTicker() {
    const tickerContainer = document.getElementById('news-ticker');
    const tickerText = document.getElementById('ticker-text');
    
    if (!tickerContainer || !tickerText) return;

    try {
        console.log("📰 최신 뉴스 가져오는 중...");
        const result = await callAppsScript('getLocalNews'); 
        
        if (result.status === 'success' && result.news.length > 0) {
            
            tickerText.innerHTML = ''; // 기존 내용 비우기
            
            // 뉴스 아이템 하나하나 만들기
            result.news.forEach((item) => {
                // 1. span 태그로 생성 (a태그 아님!)
                const span = document.createElement('span');
                
                // 2. 내용 및 클릭 이벤트 설정
                span.textContent = item.title;
                // 클릭하면 새 창으로 열리게 설정 (이게 href 대신입니다)
                span.onclick = () => window.open(item.link, '_blank');
                
                // 3. 클래스 설정 (CSS 디자인 + 마우스 오버 효과)
                // news-link: CSS에서 점(●)과 툴팁을 만들기 위한 핵심 클래스
                span.className = "news-link hover:text-yellow-300 transition-colors"; 
                
                // 4. 화면에 붙이기 (구분자는 CSS가 알아서 찍어줌)
                tickerText.appendChild(span);
            });
            
            // 내용 채운 뒤 보여주기
            tickerContainer.classList.remove('hidden'); 
        }
    } catch (e) {
        console.warn("뉴스 로딩 실패:", e);
    }
}
