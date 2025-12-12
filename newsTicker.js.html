<script>
/**
 * newsTicker.js - 뉴스 티커 전용 스크립트
 */

// 문서 로드 완료 시 실행
document.addEventListener('DOMContentLoaded', () => {
    // PC 화면일 때만 뉴스 로딩 시도 (불필요한 모바일 데이터 소모 방지)
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
        // callAppsScript 함수는 index.html에 있다고 가정합니다.
        const result = await callAppsScript('getLocalNews'); 
        
        if (result.status === 'success' && result.news.length > 0) {
            
            // 뉴스 사이사이에 구분자 넣기
            const newsString = result.news.join('   🔴   '); 
            
            tickerText.textContent = newsString;
            
            // 내용 채운 뒤 보여주기 (PC CSS media query에 의해 PC에서만 보임)
            tickerContainer.classList.remove('hidden'); 
            console.log("📰 뉴스 로딩 완료 (" + result.news.length + "건)");
        }
    } catch (e) {
        console.warn("뉴스 로딩 실패 (일시적 오류):", e);
    }
}
</script>
