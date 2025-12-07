/**
 * @fileoverview OpenWeatherMap 날씨 정보 로드
 */

document.addEventListener('DOMContentLoaded', () => {
    loadWeather();
});

async function loadWeather() {
    // 1. 부산 강서구 좌표 (대저동 기준)
    const LAT = 35.2128;
    const LON = 128.9806;
    
    // 🔑 API 키 (본인 키로 교체 권장: https://openweathermap.org/)
    // 일단 테스트용 무료 키를 사용합니다. (안 되면 발급받으세요!)
    const API_KEY = "8c66847424104273809081e836968037"; 
    
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${API_KEY}&units=metric&lang=kr`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.main) {
            // 온도 (반올림)
            const temp = Math.round(data.main.temp);
            // 습도
            const humidity = data.main.humidity;
            // 풍속
            const wind = data.wind.speed;
            // 아이콘 URL
            const iconCode = data.weather[0].icon;
            const iconUrl = `http://openweathermap.org/img/wn/${iconCode}@2x.png`;

            // 화면에 꽂아넣기
            animateValue(document.getElementById('weather-temp'), 0, temp, 1000);
            document.getElementById('weather-humidity').textContent = humidity;
            document.getElementById('weather-wind').textContent = wind;
            document.getElementById('weather-icon').src = iconUrl;
            
            console.log(`🌦️ 날씨 로드 완료: ${temp}°C, ${data.weather[0].description}`);
        }
    } catch (e) {
        console.error("날씨 정보 로드 실패:", e);
    }
}

// (숫자 카운트 함수 재활용)
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
