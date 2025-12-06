/**
 * @fileoverview 오피넷 유가 정보 & T맵 연동 (부산 강서구 자동 탐색 버전)
 */

let currentBestStationData = null; // T맵 길안내용 데이터 저장소

document.addEventListener('DOMContentLoaded', () => {
    loadOilPrice();
});

async function loadOilPrice() {
    const elAvg = document.getElementById('diesel-avg-price');
    const elName = document.getElementById('cheapest-st-name');
    const elPrice = document.getElementById('cheapest-price');
    const elAddr = document.getElementById('cheapest-st-addr');

    if (!elAvg) return; 

    const API_KEY = "F251207227"; 
    const PROD = "D047"; // 경유

    try {
        // 1. [스마트 탐색] 부산 강서구 지역코드(Area Code) 찾기
        // (매번 찾으면 느리니까 localStorage에 저장해둡니다)
        let areaCode = localStorage.getItem('OPINET_AREA_CODE_BUSAN_GANGSEO');
        
        if (!areaCode) {
            console.log("📍 지역코드 탐색 시작...");
            areaCode = await findGangseoCode(API_KEY); // 자동으로 찾아오는 함수 실행
            if (areaCode) {
                localStorage.setItem('OPINET_AREA_CODE_BUSAN_GANGSEO', areaCode);
                console.log(`📍 지역코드 발견 및 저장: ${areaCode}`);
            } else {
                console.warn("지역코드를 찾지 못해 기본값(0204)을 사용합니다.");
                areaCode = "0204"; // 실패 시 임시 코드 (안양 등)
            }
        } else {
            console.log(`📍 저장된 지역코드 사용: ${areaCode}`);
        }

        // 2. 최저가 주유소 조회 (lowTop10.do)
        const opinetUrl = `http://www.opinet.co.kr/api/lowTop10.do?out=json&code=${API_KEY}&prodcd=${PROD}&area=${areaCode}&cnt=20`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(opinetUrl)}`;

        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data && data.RESULT && data.RESULT.OIL && data.RESULT.OIL.length > 0) {
            const stations = data.RESULT.OIL;
            
            // (1) 가격순 정렬 (가장 싼 곳이 맨 위로)
            stations.sort((a, b) => parseInt(a.PRICE) - parseInt(b.PRICE));
            const best = stations[0]; 

            // (2) 길안내용 데이터 저장
            currentBestStationData = {
                name: best.OS_NM,
                address: best.VAN_ADR || best.NEW_ADR || "주소 정보 없음"
            };

            // (3) 평균가 계산 (TOP 20 기준)
            let sum = 0;
            stations.forEach(st => sum += parseInt(st.PRICE));
            const avg = Math.floor(sum / stations.length);
            
            // (4) 화면 업데이트 (숫자 카운트 효과)
            animateValue(elAvg, 1500, avg, 1000);
            animateValue(elPrice, 1400, best.PRICE, 1000);
            
            elName.textContent = best.OS_NM; 
            
            // 주소 표시 (동 이름만 깔끔하게)
            const fullAddr = best.VAN_ADR || "";
            const shortAddr = fullAddr.split(' ').slice(2).join(' ') || "강서구";
            if(elAddr) elAddr.textContent = shortAddr;
        }
    } catch (e) {
        console.error("유가 정보 로드 실패:", e);
        if(elName) elName.textContent = "정보 없음";
    }
}

// 🗺️ 지역코드 자동 찾기 함수 (부산 -> 강서구)
async function findGangseoCode(apiKey) {
    try {
        // 1. 시/도 목록 가져오기
        const url1 = `https://api.allorigins.win/raw?url=${encodeURIComponent(`http://www.opinet.co.kr/api/areaCode.do?out=json&code=${apiKey}`)}`;
        const res1 = await fetch(url1);
        const data1 = await res1.json();
        
        // "부산" 찾기
        const busan = data1.RESULT.OIL.find(item => item.AREA_NM.includes("부산"));
        if (!busan) return null;
        
        // 2. 부산의 시/군/구 목록 가져오기
        const url2 = `https://api.allorigins.win/raw?url=${encodeURIComponent(`http://www.opinet.co.kr/api/areaCode.do?out=json&code=${apiKey}&area=${busan.AREA_CD}`)}`;
        const res2 = await fetch(url2);
        const data2 = await res2.json();
        
        // "강서구" 찾기
        const gangseo = data2.RESULT.OIL.find(item => item.AREA_NM.includes("강서구"));
        
        return gangseo ? gangseo.AREA_CD : null; // 코드 반환 (예: 0604)

    } catch (e) {
        console.error("지역코드 탐색 중 오류:", e);
        return null;
    }
}

// 🚗 T맵 길안내 팝업 띄우기
function confirmOilStationNav() {
    if (!currentBestStationData) {
        alert("주유소 정보를 불러오는 중입니다. 잠시만 기다려주세요.");
        return;
    }

    const fakeClient = {
        name: `⛽ ${currentBestStationData.name}`, 
        address: currentBestStationData.address
    };

    // index1.html에 있는 T맵 팝업 함수 호출
    if (typeof openNavPrompt === 'function') {
        openNavPrompt(fakeClient, '시스템');
    } else {
        if(confirm(`${currentBestStationData.name}\n길안내를 시작할까요?`)) {
             location.href = `tmap://search?name=${encodeURIComponent(currentBestStationData.name)}`;
        }
    }
}

// 숫자 카운트 애니메이션
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
