/**
 * @fileoverview 오피넷 유가 정보 & T맵 연동
 */

// 🚨 최저가 주유소 정보를 담을 전역 변수
let currentBestStationData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadOilPrice();
});

async function loadOilPrice() {
    const elAvg = document.getElementById('diesel-avg-price');
    const elName = document.getElementById('cheapest-st-name');
    const elPrice = document.getElementById('cheapest-price');
    const elAddr = document.getElementById('cheapest-st-addr'); // 주소 표시용

    if (!elAvg) return; 

    // 오피넷 설정
    const API_KEY = "F251207227"; 
    const AREA = "0204"; // 부산 강서구
    const PROD = "D047"; // 경유
    
    const opinetUrl = `http://www.opinet.co.kr/api/lowTop10.do?out=json&code=${API_KEY}&prodcd=${PROD}&area=${AREA}&cnt=20`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(opinetUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data && data.RESULT && data.RESULT.OIL && data.RESULT.OIL.length > 0) {
            const stations = data.RESULT.OIL;
            const best = stations[0]; // 1등 주유소
            
            // 1. 전역 변수에 저장 (클릭 시 사용)
            // VAN_ADR: 지번주소 / NEW_ADR: 도로명주소 (API에 따라 다름, 보통 VAN_ADR 줌)
            currentBestStationData = {
                name: best.OS_NM,
                address: best.VAN_ADR || best.NEW_ADR || "주소 정보 없음"
            };

            // 2. 평균가 계산
            let sum = 0;
            stations.forEach(st => sum += parseInt(st.PRICE));
            const avg = Math.floor(sum / stations.length);
            
            // 3. 화면 업데이트
            animateValue(elAvg, 1500, avg, 1000);
            animateValue(elPrice, 1400, best.PRICE, 1000);
            
            // 이름이 너무 길면 마키 효과가 적용되도록 원본 텍스트 삽입
            elName.textContent = best.OS_NM; 
            // 흐르는 효과를 위해 텍스트가 짤리지 않게 style width 해제 (CSS가 제어)
            
            // 주소 표시 (동 이름만 따오기: "부산 강서구 대저1동..." -> "대저1동...")
            const shortAddr = best.VAN_ADR.split(' ').slice(2).join(' ') || "강서구";
            if(elAddr) elAddr.textContent = shortAddr;

        }
    } catch (e) {
        console.error("유가 정보 로드 실패:", e);
    }
}

/**
 * [핵심] 주유소 클릭 시 T맵 안내 팝업 띄우기
 * (index1.html에 있는 openNavPrompt 함수를 재활용합니다!)
 */
function confirmOilStationNav() {
    if (!currentBestStationData) {
        alert("주유소 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
        return;
    }

    // 기존 앱의 T맵 팝업 함수 호출
    // client 객체 형식을 맞춰서 넘겨줍니다.
    const fakeClient = {
        name: `⛽ ${currentBestStationData.name}`, // 이름 앞에 주유소 표시
        address: currentBestStationData.address
    };

    // '시스템'이라는 가상의 유저 이름으로 호출
    if (typeof openNavPrompt === 'function') {
        openNavPrompt(fakeClient, '시스템');
    } else {
        // 만약 팝업 함수가 없으면 바로 T맵 실행 (백업)
        if(confirm(`${currentBestStationData.name}\n길안내를 시작할까요?`)) {
             location.href = `tmap://search?name=${encodeURIComponent(currentBestStationData.name)}`;
        }
    }
}

// (숫자 카운트 함수는 기존 유지)
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
