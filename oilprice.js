/**
 * @fileoverview 오피넷 유가 정보 + T맵 "부산 강서구" 한정 정밀 검색
 */

let currentBestStationData = null;
const TMAP_APP_KEY = "QePeg5ee414bGfjbIx13L55PmUEim1vl9tvBSyp0"; // T맵 API 키

document.addEventListener('DOMContentLoaded', () => {
    loadOilPrice();
});

async function loadOilPrice() {
    const elAvg = document.getElementById('diesel-avg-price');
    if (!elAvg) return; 

    // ✅ [1단계] 캐시 확인
    const cacheKey = 'OIL_PRICE_CACHE_DATA_V3'; // 로직 변경으로 키 업데이트
    const cached = localStorage.getItem(cacheKey);
    const now = new Date().getTime();
    const CACHE_DURATION = 3 * 60 * 60 * 1000; // 3시간

    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (now - timestamp < CACHE_DURATION) {
            console.log("⚡ [캐시] 저장된 유가 정보 사용");
            updateOilWidget(data);
            return; 
        }
    }

    // ✅ [2단계] 오피넷 서버 호출 (부산 강서구: 1011)
    const AREA_CODE = "1011"; 
    const API_KEY = "F251207227"; 
    const PROD_CODE = "D047"; 

    try {
        console.log(`⛽ 오피넷 정보 요청 중...`);
        const opinetUrl = `http://www.opinet.co.kr/api/lowTop10.do?out=json&code=${API_KEY}&prodcd=${PROD_CODE}&area=${AREA_CODE}&cnt=20`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(opinetUrl)}`;

        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Proxy Error: ${response.status}`);
        const data = await response.json();
        
        if (data && data.RESULT && data.RESULT.OIL && data.RESULT.OIL.length > 0) {
            
            let processedData = processOilData(data.RESULT.OIL);

            // 🚀 [3단계] "부산 강서구" + 주유소 이름으로 좌표 조회
            // 예: "대박주유소" -> "부산 강서구 대박주유소"로 검색
            console.log(`🔍 T맵 정밀 검색: 부산 강서구 ${processedData.bestName}`);
            
            // 검증 함수에 '지역명'을 아예 박아서 보냄
            const tmapInfo = await verifyWithTmap("부산 강서구 " + processedData.bestName);

            if (tmapInfo) {
                console.log("✅ 좌표 확보 성공:", tmapInfo);
                processedData.bestName = tmapInfo.name; // T맵에 등록된 깔끔한 이름 사용
                processedData.coords = tmapInfo.coords; 
            } else {
                console.warn("⚠️ T맵 검색 실패. 오피넷 기본 데이터 사용.");
            }
            
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: now,
                data: processedData
            }));

            updateOilWidget(processedData);
        } 
    } catch (e) {
        console.error("❌ 유가 로드 실패:", e);
        if (cached) {
            updateOilWidget(JSON.parse(cached).data);
        } else {
            const elName = document.getElementById('cheapest-st-name');
            if(elName) elName.textContent = "정보 수신 실패";
        }
    }
}

// 📡 T맵 검색 함수 (검색어 그대로 조회)
async function verifyWithTmap(fullSearchKeyword) {
    try {
        const encodedKeyword = encodeURIComponent(fullSearchKeyword);
        // 정확도순 정렬(searchType=name)보다는 관련도순(기본값)이 지역명 포함 검색엔 유리함
        const url = `https://apis.openapi.sk.com/tmap/pois?version=1&searchKeyword=${encodedKeyword}&resCoordType=WGS84GEO&reqCoordType=WGS84GEO&count=1&appKey=${TMAP_APP_KEY}`;
        
        const res = await fetch(url);
        const json = await res.json();

        if (json.searchPoiInfo && json.searchPoiInfo.pois.poi.length > 0) {
            const poi = json.searchPoiInfo.pois.poi[0];
            return {
                name: poi.name, 
                coords: {
                    lat: poi.noorLat,
                    lon: poi.noorLon
                }
            };
        }
        return null;
    } catch (e) {
        console.error("T맵 API 오류:", e);
        return null;
    }
}

function processOilData(stations) {
    stations.sort((a, b) => parseInt(a.PRICE) - parseInt(b.PRICE));
    const best = stations[0];
    let sum = 0;
    stations.forEach(st => sum += parseInt(st.PRICE));

    return {
        avgPrice: Math.floor(sum / stations.length),
        bestPrice: best.PRICE,
        bestName: best.OS_NM,
        bestAddr: best.VAN_ADR || best.NEW_ADR,
        rawAddr: best.VAN_ADR,
        coords: null 
    };
}

function updateOilWidget(info) {
    const elAvg = document.getElementById('diesel-avg-price');
    const elName = document.getElementById('cheapest-st-name');
    const elPrice = document.getElementById('cheapest-price');
    const elAddr = document.getElementById('cheapest-st-addr');
    const wrapper = document.querySelector('.station-name-wrapper');

    animateValue(elAvg, 1500, info.avgPrice, 1000);
    animateValue(elPrice, 1400, info.bestPrice, 1000);
    
    // 스마트 마퀴
    if(elName && wrapper) {
        elName.innerHTML = info.bestName;
        wrapper.classList.remove('is-long'); 

        if (elName.scrollWidth > wrapper.clientWidth + 2) {
            wrapper.classList.add('is-long');
            elName.innerHTML = `<span class="pr-8">${info.bestName}</span><span>${info.bestName}</span>`;
        }
    }
    
    const shortAddr = (info.bestAddr || "").split(' ').slice(2).join(' ') || "강서구";
    if(elAddr) elAddr.textContent = shortAddr;

    currentBestStationData = {
        name: info.bestName,
        address: info.rawAddr,
        coords: info.coords
    };
}

// 🚀 [최종 복구] 길안내 실행 (바텀 시트 모달 연결)
function confirmOilStationNav() {
    // 데이터 없으면 새로고침
    if (!currentBestStationData) { 
        refreshOilPrice(); 
        return; 
    }

    // index.html에 있는 바텀 시트 함수(openNavPrompt)가 존재하는지 확인
    if (typeof openNavPrompt === 'function') {
        
        // 💡 [핵심] 기존 바텀 시트가 알아들을 수 있는 '가짜 거래처 객체'를 만듭니다.
        // index.html의 launchTMapApp 함수는 coords.lat(), coords.lng() 형태를 원하므로 맞춰줍니다.
        const fakeClient = {
            name: currentBestStationData.name,
            address: currentBestStationData.address,
            coords: currentBestStationData.coords ? {
                lat: () => currentBestStationData.coords.lat,
                lng: () => currentBestStationData.coords.lon
            } : null
        };

        // 바텀 시트 열기! (담당자는 '유가위젯'으로 표시)
        openNavPrompt(fakeClient, '유가위젯');

    } else {
        // (비상용 백업) 만약 바텀 시트 함수가 없으면 기본 confirm 창 띄움
        const { name, coords } = currentBestStationData;
        if (coords) {
            if(confirm(`'${name}'\n길안내를 시작할까요?`)) {
                location.href = `tmap://route?goalname=${encodeURIComponent(name)}&goalx=${coords.lon}&goaly=${coords.lat}`;
            }
        } else {
            if(confirm(`'${name}'\n길안내를 시작할까요?`)) {
                location.href = `tmap://search?name=${encodeURIComponent(name)}`;
            }
        }
    }
}

function refreshOilPrice() {
    const icon = document.getElementById('refresh-icon');
    if(icon) icon.classList.add('animate-spin');
    
    localStorage.removeItem('OIL_PRICE_CACHE_DATA_V3'); 
    
    loadOilPrice().then(() => {
        setTimeout(() => {
            if(icon) icon.classList.remove('animate-spin');
            if(typeof showToast === 'function') showToast("최신 정보 업데이트 완료", "success");
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
