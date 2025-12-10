/**
 * @fileoverview 오피넷 유가 정보 (캐싱 적용 + 안정성 강화 + 마키 효과 복구 버전)
 */

let currentBestStationData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadOilPrice();
});

async function loadOilPrice() {
    const elAvg = document.getElementById('diesel-avg-price');
    
    if (!elAvg) return; 

    // ✅ [1단계] 저장된 데이터(캐시) 확인
    const cacheKey = 'OIL_PRICE_CACHE_DATA';
    const cached = localStorage.getItem(cacheKey);
    const now = new Date().getTime();
    const CACHE_DURATION = 3 * 60 * 60 * 1000; // 3시간

    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        // 3시간 안 지났으면 저장된 거 사용
        if (now - timestamp < CACHE_DURATION) {
            console.log("⚡ 저장된 유가 정보 사용");
            updateOilWidget(data);
            return; 
        }
    }

    // ✅ [2단계] 서버 호출 (캐시 없거나 만료 시)
    const AREA_CODE = "1011"; // 부산 강서구
    const API_KEY = "F251207227"; 
    const PROD_CODE = "D047"; 

    try {
        console.log(`⛽ 오피넷 서버 요청 중...`);

        const opinetUrl = `http://www.opinet.co.kr/api/lowTop10.do?out=json&code=${API_KEY}&prodcd=${PROD_CODE}&area=${AREA_CODE}&cnt=20`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(opinetUrl)}`;

        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error(`Proxy Server Error: ${response.status}`);

        const data = await response.json();
        
        if (data && data.RESULT && data.RESULT.OIL && data.RESULT.OIL.length > 0) {
            const processedData = processOilData(data.RESULT.OIL);
            
            // 데이터 저장
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: now,
                data: processedData
            }));

            updateOilWidget(processedData);
            console.log("✅ 유가 정보 갱신 및 저장 완료");
        } 
    } catch (e) {
        console.error("❌ 유가 로드 실패:", e);
        
        // 비상 대책: 옛날 데이터라도 보여줌
        if (cached) {
            const { data } = JSON.parse(cached);
            updateOilWidget(data);
        } else {
            const elName = document.getElementById('cheapest-st-name');
            if(elName) elName.textContent = "정보 없음";
        }
    }
}

// 데이터 가공 함수
function processOilData(stations) {
    stations.sort((a, b) => parseInt(a.PRICE) - parseInt(b.PRICE));
    const best = stations[0];

    let sum = 0;
    stations.forEach(st => sum += parseInt(st.PRICE));
    const avg = Math.floor(sum / stations.length);

    return {
        avgPrice: avg,
        bestPrice: best.PRICE,
        bestName: best.OS_NM,
        bestAddr: best.VAN_ADR || best.NEW_ADR,
        rawAddr: best.VAN_ADR
    };
}

// 화면 그리기 함수 (수정됨: 길이 체크 로직 추가)
function updateOilWidget(info) {
    const elAvg = document.getElementById('diesel-avg-price');
    const elName = document.getElementById('cheapest-st-name');
    const elPrice = document.getElementById('cheapest-price');
    const elAddr = document.getElementById('cheapest-st-addr');
    const wrapper = document.querySelector('.station-name-wrapper'); // 래퍼 찾기

    // 숫자 카운트 애니메이션
    animateValue(elAvg, 1500, info.avgPrice, 1000);
    animateValue(elPrice, 1400, info.bestPrice, 1000);
    
    // 🚨 [핵심 수정 구간] 텍스트 길이에 따라 스마트하게 처리
    if(elName && wrapper) {
        // 1. 일단 텍스트를 하나만 넣어서 길이를 재봅니다. (초기화)
        elName.innerHTML = info.bestName;
        wrapper.classList.remove('is-long'); // 일단 클래스 제거

        // 2. 텍스트의 실제 길이(scrollWidth)가 박스(clientWidth)보다 큰지 확인
        // (약간의 여유 2px 정도 둠)
        if (elName.scrollWidth > wrapper.clientWidth + 2) {
            // 3. 넘친다면? -> 'is-long' 클래스 붙이고, 마퀴용 텍스트(두 번 반복)로 교체
            wrapper.classList.add('is-long');
            elName.innerHTML = `<span class="pr-8">${info.bestName}</span><span>${info.bestName}</span>`;
        }
    }
    
    // 주소 줄임 표시
    const shortAddr = (info.bestAddr || "").split(' ').slice(2).join(' ') || "강서구";
    if(elAddr) elAddr.textContent = shortAddr;

    // 전역 변수 업데이트
    currentBestStationData = {
        name: info.bestName,
        address: info.rawAddr
    };
}
// 길안내 팝업
function confirmOilStationNav() {
    if (!currentBestStationData) {
        refreshOilPrice();
        return;
    }
    const fakeClient = { name: `⛽ ${currentBestStationData.name}`, address: currentBestStationData.address };
    
    if (typeof openNavPrompt === 'function') openNavPrompt(fakeClient, '시스템');
    else if(confirm(`${currentBestStationData.name}\n길안내를 시작할까요?`)) location.href = `tmap://search?name=${encodeURIComponent(currentBestStationData.name)}`;
}

// 수동 새로고침
function refreshOilPrice(btnElement) {
    const icon = document.getElementById('refresh-icon');
    if(icon) icon.classList.add('animate-spin');
    
    localStorage.removeItem('OIL_PRICE_CACHE_DATA'); // 캐시 삭제 후 재요청
    
    loadOilPrice().then(() => {
        setTimeout(() => {
            if(icon) icon.classList.remove('animate-spin');
            if(typeof showToast === 'function') showToast("최신 정보로 업데이트했습니다.", "success");
        }, 500);
    });
}

function animateValue(obj, start, end, duration) {
    if(!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}
