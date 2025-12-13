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

    let temp = 0;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`날씨 API 오류: ${response.status}`);
        const data = await response.json();
        
        if (data.list && data.list.length > 0) {
            // (1) 현재 날씨
            const current = data.list[0];
            temp = Math.round(current.main.temp);
            
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

// 🚨 [신규] 4. 날씨 애니메이션 발동 로직 🚨
const weatherWidget = document.getElementById('weather-widget'); // 날씨 위젯의 ID를 'weather-widget'이라고 가정합니다.
if (weatherWidget) {
    // 기존의 애니메이션 클래스를 모두 제거 (중복 재생 방지)
    weatherWidget.classList.remove('rain-active', 'snow-active', 'clouds-active', 'sun-active');
    
    let animClass = null;
    let animDuration = 4000; // 4초 후 사라지게 설정 (ms)

    // 날씨 설명(desc) 또는 아이콘 코드(iconCode)를 기반으로 애니메이션 결정
    // iconCode (2xx:비, 5xx:비, 6xx:눈, 80x:구름)
    
    // 🚨 [순서 변경] 맑음 코드를 가장 먼저 확인합니다. 🚨
if (iconCode.startsWith('01')) { 
    // 맑음 (01d, 01n) - 햇빛 애니메이션
    animClass = 'sun-active';
    animDuration = 4000;
} 
else if (iconCode.startsWith('09') || iconCode.startsWith('10') || iconCode.startsWith('11') || iconCode.startsWith('5')) {
    // 비/소나기/천둥번개
    animClass = 'rain-active';
    animDuration = 3000;
} 
else if (iconCode.startsWith('13') || iconCode.startsWith('6')) {
    // 눈/진눈깨비
    animClass = 'snow-active';
    animDuration = 3000;
} 
else if (iconCode.startsWith('02') || iconCode.startsWith('03') || iconCode.startsWith('04') || desc.includes('구름')) {
    // 구름 조금, 구름 많음, 흐림
    animClass = 'clouds-active';
    animDuration = 3000;
}
    
    if (animClass) {
        // 1. 애니메이션 클래스 추가 (애니메이션 시작)
        weatherWidget.classList.add(animClass);
        
        // 2. animDuration 후 클래스 제거 (애니메이션 자동 소멸)
        setTimeout(() => {
            weatherWidget.classList.remove(animClass);
        }, animDuration);
    }
}
// 🚨 [삽입 종료]
