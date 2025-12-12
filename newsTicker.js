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
            
            // 뉴스 아이템 하나하나 태그로 만들기
            result.news.forEach((item) => {
                // 1. 기사 링크 생성
                const link = document.createElement('a');
                link.href = item.link;
                link.target = "_blank"; // 새 창에서 열기
                link.textContent = item.title;
                link.className = "news-link hover:text-yellow-300 transition-colors"; // 마우스 올리면 노란색
                
                // 2. 구분자 생성 (간격 넓게)
                const separator = document.createElement('span');
                // &nbsp; 를 많이 넣어서 간격을 벌립니다
                separator.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;🔴&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"; 
                separator.className = "text-red-500 text-[10px]";

                // 3. 화면에 붙이기
                tickerText.appendChild(link);
                tickerText.appendChild(separator);
            });
            
            // 내용 채운 뒤 보여주기
            tickerContainer.classList.remove('hidden'); 
        }
    } catch (e) {
        console.warn("뉴스 로딩 실패:", e);
    }
}
