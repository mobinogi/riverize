/**
 * @fileoverview 오피넷 유가 정보 (캐싱 적용 + 안정성 강화 버전)
 * - 기능: 3시간 동안은 저장된 데이터를 보여줘서 서버 오류를 방지함
 */

let currentBestStationData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadOilPrice();
});

async function loadOilPrice() {
    const elAvg = document.getElementById('diesel-avg-price');
    const elName = document.getElementById('cheapest-st-name');
    const elPrice = document.getElementById('cheapest-price');
    const elAddr = document.getElementById('cheapest-st-addr');

    if (!elAvg) return; 

    // ✅ [1단계] 저장된 데이터(캐시)가 있는지 먼저 확인!
    const cacheKey = 'OIL_PRICE_CACHE_DATA';
    const cached = localStorage.getItem(cacheKey);
    const now = new Date().getTime();
    const CACHE_DURATION = 3 * 60 * 60 * 1000; // 3시간 (밀리초)

    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        // 저장한 지 3시간 안 지났으면 -> 서버 안 부르고 저장된 거 씀 (속도 0초, 에러 0%)
        if (now - timestamp < CACHE_DURATION) {
            console.log("⚡ 저장된 유가 정보 사용 (서버 요청 생략)");
            updateOilWidget(data);
            return; 
        }
    }

    // ✅ [2단계] 캐시가 없거나 오래됐으면 서버 호출
    const AREA_CODE = "1011"; // 부산 강서구
    const API_KEY = "F251207227"; 
    const PROD_CODE = "D047"; 

    try {
        console.log(`⛽ 오피넷 서버 요청 중...`);

        const opinetUrl = `http://www.opinet.co.kr/api/lowTop10.do?out=json&code=${API_KEY}&prodcd=${PROD_CODE}&area=${AREA_CODE}&cnt=20`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(opinetUrl)}`;

        const response = await fetch(proxyUrl);
        
        // 서버가 500 에러 등을 뱉으면 catch로 보냄
        if (!response.ok) throw new Error(`Proxy Server Error: ${response.status}`);

        const data = await response.json();
        
        if (data && data.RESULT && data.RESULT.OIL && data.RESULT.OIL.length > 0) {
            // 성공! 데이터를 가공해서 저장
            const processedData = processOilData(data.RESULT.OIL);
            
            // 폰에 저장 (다음 3시간 동안은 이거 씀)
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: now,
                data: processedData
            }));

            updateOilWidget(processedData);
            console.log("✅ 유가 정보 갱신 및 저장 완료");
        } 
    } catch (e) {
        console.error("❌ 유가 로드 실패:", e);
        
        // 🚨 [비상 대책] 서버가 터졌을 때, 옛날 데이터라도 있으면 그거라도 보여줌
        if (cached) {
            console.warn("⚠️ 서버 오류로 인해 이전 데이터를 표시합니다.");
            const { data } = JSON.parse(cached);
            updateOilWidget(data);
            
            // UI에 "업데이트 실패" 살짝 표시 (선택사항)
            if(elName) elName.textContent = data.bestName + " (기존)";
        } else {
            if(elName) elName.textContent = "정보 없음";
        }
    }
}

// 데이터 가공 함수 (정렬, 평균 계산)
function processOilData(stations) {
    // 1. 가격순 정렬
    stations.sort((a, b) => parseInt(a.PRICE) - parseInt(b.PRICE));
    const best = stations[0];

    // 2. 평균가 계산
    let sum = 0;
    stations.forEach(st => sum += parseInt(st.PRICE));
    const avg = Math.floor(sum / stations.length);

    return {
        avgPrice: avg,
        bestPrice: best.PRICE,
        bestName: best.OS_NM,
        bestAddr: best.VAN_ADR || best.NEW_ADR,
        rawAddr: best.VAN_ADR // 길안내용 원본 주소
    };
}

// 화면 그리기 함수
function updateOilWidget(info) {
    const elAvg = document.getElementById('diesel-avg-price');
    const elName = document.getElementById('cheapest-st-name');
    const elPrice = document.getElementById('cheapest-price');
    const elAddr = document.getElementById('cheapest-st-addr');

    // 숫자 카운트 효과
    animateValue(elAvg, 1500, info.avgPrice, 1000);
    animateValue(elPrice, 1400, info.bestPrice, 1000);
    
    if(elName) elName.textContent = info.bestName;
    
    // 주소 줄임 표시
    const shortAddr = (info.bestAddr || "").split(' ').slice(2).join(' ') || "강서구";
    if(elAddr) elAddr.textContent = shortAddr;

    // 전역 변수 업데이트 (길안내용)
    currentBestStationData = {
        name: info.bestName,
        address: info.rawAddr
    };
}

// 길안내 팝업
function confirmOilStationNav() {
    if (!currentBestStationData) {
        // 데이터가 없으면 강제로 새로고침 시도
        refreshOilPrice();
        return;
    }
    const fakeClient = { name: `⛽ ${currentBestStationData.name}`, address: currentBestStationData.address };
    
    if (typeof openNavPrompt === 'function') openNavPrompt(fakeClient, '시스템');
    else if(confirm(`${currentBestStationData.name}\n길안내를 시작할까요?`)) location.href = `tmap://search?name=${encodeURIComponent(currentBestStationData.name)}`;
}

// 수동 새로고침 (이때는 강제로 서버 부름)
function refreshOilPrice(btnElement) {
    const icon = document.getElementById('refresh-icon');
    if(icon) icon.classList.add('animate-spin');
    
    // 강제로 캐시 삭제 후 재로드
    localStorage.removeItem('OIL_PRICE_CACHE_DATA');
    
    loadOilPrice().then(() => {
        setTimeout(() => {
            if(icon) icon.classList.remove('animate-spin');
            if(typeof showToast === 'function') showToast("최신 정보로 업데이트했습니다.", "success");
        }, 500);
    });
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}
