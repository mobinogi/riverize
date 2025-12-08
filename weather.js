/**
 * @fileoverview OpenWeatherMap 날씨 정보 로드 (부산 강서구)
 * - 한글 지원 (&lang=kr)
 * - 고해상도 아이콘 (@4x)
 */

document.addEventListener('DOMContentLoaded', () => {
    loadWeather();
});

async function loadWeather() {
    // 1. 부산 강서구 대저동 좌표
    const LAT = 35.2128;
    const LON = 128.9806;
    
    // 🚨 [필수] 사장님의 API 키를 여기에 넣으세요!
    const API_KEY = "1a7442ec79a869ffb74c77f858f3f515"; // (이건 제 테스트 키입니다. 본인 키로 바꾸세요!)
    
    // ✅ [핵심] 끝에 &lang=kr 을 붙여야 '맑음', '구름' 처럼 한글로 옵니다.
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${API_KEY}&units=metric&lang=kr`;

    try {
        const response = await fetch(url);
        
        if (!response.ok) throw new Error(`API 호출 오류: ${response.status}`);

        const data = await response.json();
        
        if (data.main) {
            // 데이터 추출
            const temp = Math.round(data.main.temp);       // 온도 (반올림)
            // ✅ [수정 후] 이상한 한국어 교정 (온흐림 -> 흐림)
            let desc = data.weather[0].description;
            if (desc === '온흐림') desc = '흐림';
            if (desc === '튼구름') desc = '구름 조금';
            if (desc === '부서진 구름') desc = '구름 많음';
            const iconCode = data.weather[0].icon;         // 아이콘 코드
            const humidity = data.main.humidity;           // 습도
            const wind = Math.round(data.wind.speed * 10) / 10; // 풍속 (소수점 1자리)
            
            // 아이콘 이미지 (@4x로 선명하게)
            const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;

            // HTML 요소 찾기
            const elTemp = document.getElementById('weather-temp');
            const elDesc = document.getElementById('weather-desc');
            const elIcon = document.getElementById('weather-icon');
            const elHum = document.getElementById('weather-humidity');
            const elWind = document.getElementById('weather-wind');

            // 값 넣기 (요소가 있을 때만 넣어서 에러 방지)
            if(elTemp) animateValue(elTemp, 0, temp, 1000);
            if(elDesc) elDesc.textContent = desc;
            if(elIcon) elIcon.src = iconUrl;
            if(elHum) elHum.textContent = humidity + '%';
            if(elWind) elWind.textContent = wind + 'm/s';
            
            console.log(`🌦️ 날씨 로드 완료: ${temp}°C, ${desc}`);
        }
    } catch (e) {
        console.error("날씨 로드 실패:", e);
    }
}

// 숫자 올라가는 효과
function animateValue(obj, start, end, duration) {
    if(!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}
