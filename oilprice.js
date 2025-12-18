/**
 * @fileoverview 오피넷 유가 정보 + T맵 "부산 강서구" 한정 정밀 검색
 */

let currentBestStationData = null;
const TMAP_APP_KEY = "QePeg5ee414bGfjbIx13L55PmUEim1vl9tvBSyp0"; // T맵 API 키

document.addEventListener('DOMContentLoaded', () => {
    // 1. 우선 기존 기능(강서구 정보 로드)을 실행합니다 (PC/모바일 공통)
    loadOilPrice();

    // 2. 그 다음, 모바일인지 체크해서 라벨을 버튼으로 바꿉니다.
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    const oilLabel = document.getElementById('oil-label'); // index.html에 있는 ID

    if (isMobile && oilLabel) {
        // 모바일일 때만 클릭 가능한 버튼 스타일로 변경
        oilLabel.style.cursor = 'pointer';
        oilLabel.style.color = '#60a5fa'; // 파란색으로 포인트
        oilLabel.innerHTML = '주변 최저가 찾기 📍';
        
        // 클릭 시 GPS 검색 함수 실행 (이 함수는 파일 하단에 따로 정의해주셔야 합니다!)
        oilLabel.onclick = startMobileGpsSearch; 
    }
});

async function loadOilPrice() {
    const elAvg = document.getElementById('diesel-avg-price');
    if (!elAvg) return; 

    // 1. 캐시 확인 (기존 유지)
    const cacheKey = 'OIL_PRICE_CACHE_DATA_V5'; 
    const cached = localStorage.getItem(cacheKey);
    const now = new Date().getTime();
    
    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (now - timestamp < 3 * 60 * 60 * 1000) { // 3시간
            updateOilWidget(data);
            return; 
        }
    }

    // 2. 서버 호출 (여기가 바뀜!)
    try {
        console.log("⛽ 서버(GAS)에 유가 정보 요청 중...");
        
        // 🚨 API 키, 지역코드 없이 그냥 함수 이름만 부르면 됩니다!
        // (code.js가 알아서 처리해서 가져다 줍니다)
        const result = await callAppsScript('getOilPrice'); 

        if (result.status === 'success' && result.data && result.data.RESULT) {
            
            let processedData = processOilData(result.data.RESULT.OIL);
            
            // T맵 검증 (기존 유지)
            const tmapInfo = await verifyWithTmap("부산 강서구 " + processedData.bestName);
            if (tmapInfo) {
                processedData.bestName = tmapInfo.name;
                processedData.coords = tmapInfo.coords; 
            }
            
            // 저장 및 업데이트
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: processedData }));
            updateOilWidget(processedData);

        } else {
            throw new Error("데이터 수신 실패");
        }
    } catch (e) {
        console.error("유가 로드 실패:", e);
        if (cached) updateOilWidget(JSON.parse(cached).data); // 실패 시 캐시라도 보여줌
        else document.getElementById('cheapest-st-name').textContent = "정보 수신 실패";
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

/**
 * ⛽ oilPrice.js - 모바일 주변 유가 검색 및 티맵 연동 로직
 */

// 1. 위치 추적 및 GAS 통신 엔진
function startMobileGpsSearch() {
  const oilLabel = document.getElementById('oil-label');
  if (oilLabel) oilLabel.innerText = "📍 위치 추적 중...";

  navigator.geolocation.getCurrentPosition(function(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    
    // 영점 보정 로직이 들어있는 GAS 액션 호출
    const requestUrl = `${API_URL}?action=getNearbyOil&lat=${lat}&lng=${lng}`; 

    fetch(requestUrl)
      .then(res => res.json())
      .then(data => {
        if (data && data.price) {
          renderOilPrice(data); 
          if (oilLabel) oilLabel.innerText = "📍 검색 완료!";
        } else {
          if (oilLabel) oilLabel.innerText = "📍 주변 결과 없음";
        }
      })
      .catch(err => {
        console.error("통신 에러:", err);
        if (oilLabel) oilLabel.innerText = "📍 통신 에러 발생";
      });
  }, function(err) {
    alert("위치 권한을 허용해야 주변 유가 확인이 가능합니다: " + err.message);
  });
}

// 2. 화면 렌더링 함수 (글래스모피즘 스타일 적용 가능 구조)
function renderOilPrice(data) {
  const oilContainer = document.getElementById('oil-result-container');
  if (!oilContainer) return;

  // 클릭 시 사용자님의 전매특허 티맵 강제 연동 실행
  oilContainer.innerHTML = `
    <div class="oil-card" onclick="startTmapNav('${data.name}')" style="cursor:pointer;">
      <div class="brand-tag">${data.brand}</div>
      <div class="price-val">${data.price}원</div>
      <div class="station-name">${data.name}</div>
      <div class="dist-info">직선거리 ${data.distance}</div>
      <div class="nav-hint">👆 터치 시 티맵 즉시 안내</div>
    </div>
  `;
}

/**
 * 주유소 클릭 시 실행되는 최종 내비 연동 함수
 */
async function handleNavClick(stationName) {
  // 1. 오피넷 이름으로 티맵 API에서 '진짜 정보'를 먼저 캐냅니다.
  // 특정 지역(김해 등)을 넣지 않아도, 티맵 API가 검색 결과 중 가장 타당한 곳을 줍니다.
  const tmapInfo = await verifyWithTmap(stationName);

  if (tmapInfo) {
    // 2. 검증된 정보가 있다면, 티맵 API가 준 '정확한 명칭'으로 앱을 실행합니다.
    // 이렇게 하면 검색 결과 리스트가 안 뜨고 바로 안내될 확률이 비약적으로 높아집니다!
    startTmapNav(tmapInfo.name); 
  } else {
    // 3. 만약 API 검색 실패 시, 고육지책으로 오피넷 이름을 그대로 던집니다.
    startTmapNav(stationName);
  }
}

// 🚀 실제 앱을 깨우는 '집행' 함수 (절대 삭제 불가!)
function startTmapNav(keyword) {
  // 사용자님이 설계하신 "검색어 강제 삽입"의 최종 목적지입니다.
  window.location.href = "tmap://search?name=" + encodeURIComponent(keyword);
}
