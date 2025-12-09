/**
 * @fileoverview OpenWeatherMap 날씨 정보 로드 (부산 강서구)
 * - 기능: 현재 날씨 + 오늘 최고/최저 기온 계산
 * - 자동 갱신: 1시간마다 조용히 데이터만 새로고침 (로그 X)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. 앱 켜지자마자 즉시 실행
    loadWeather();

    // 2. 1시간마다 자동 갱신 (60분 * 60초 * 1000ms)
    // 로그 없이 조용히 숫자만 바꿉니다.
    setInterval(() => {
        loadWeather();
    }, 3600000); 
});

async function loadWeather() {
    const elTemp = document.getElementById('weather-temp');
    const elDesc = document.getElementById('weather-desc');
    const elIcon = document.getElementById('weather-icon');
    const elHum = document.getElementById('weather-humidity');
    const elMax = document.getElementById('temp-max');
    const elMin = document.getElementById('temp-min');

    if (!elTemp) return;

    // 1. 설정
    const LAT = 35.2128;
    const LON = 128.9806;
    const API_KEY = "1a7442ec79a869ffb74c77f858f3f515"; // 사장님 키
    
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&appid=${API_KEY}&units=metric&lang=kr`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`날씨 API 오류: ${response.status}`);
        const data = await response.json();
        
        if (data.list && data.list.length > 0) {
            // (1) 현재 날씨
            const current = data.list[0];
            const temp = Math.round(current.main.temp);
            
            // 설명 교정 (온흐림 -> 흐림)
            let desc = current.weather[0].description;
            if (desc === '온흐림') desc = '흐림';
            if (desc === '튼구름') desc = '구름 조금';
            if (desc === '부서진 구름') desc = '구름 많음';

            const iconCode = current.weather[0].icon;
            const humidity = current.main.humidity;
            
            // (2) 오늘 최고/최저 계산
            const todayStr = new Date().toISOString().split('T')[0];
            const todayForecasts = data.list.filter(item => item.dt_txt.startsWith(todayStr));
            
            let maxTemp = temp;
            let minTemp = temp;
            
            if (todayForecasts.length > 0) {
                maxTemp = Math.round(Math.max(...todayForecasts.map(item => item.main.temp_max)));
                minTemp = Math.round(Math.min(...todayForecasts.map(item => item.main.temp_min)));
            }

            // (3) 화면 업데이트
            const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;

            animateValue(elTemp, 0, temp, 1000);
            if(elDesc) elDesc.textContent = desc;
            if(elIcon) elIcon.src = iconUrl;
            if(elHum) elHum.textContent = humidity + '%';
            
            if(elMax) elMax.textContent = maxTemp;
            if(elMin) elMin.textContent = minTemp;

            console.log(`🌦️ 날씨 로드 완료: ${temp}°C, ${desc}`);
        }
        
    } catch (e) {
        console.error("날씨 로드 실패:", e);
    }
}

// 숫자 카운트 애니메이션
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
