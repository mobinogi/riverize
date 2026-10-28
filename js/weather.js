/**
 * @fileoverview 날씨 — 기상청 단기예보 (부산 강서구)
 *
 *  · 자료는 서버(code.gs 의 getWeather)가 기상청에서 받아 30분마다 새로 넘겨 줍니다.
 *    (예전에는 미국 오픈웨더맵을 브라우저에서 직접 불렀습니다)
 *  · 사이드바 위젯: 지금 기온·날씨·습도·오늘 최고/최저
 *  · 위젯을 누르면 시간별·주간 예보 창이 뜹니다 (페이지 이동 없음)
 *  · 이용 조건(저작자표시): 창 아래에 "자료: 기상청" 을 띄웁니다.
 */

const WEATHER_STORE_KEY = 'gangseo.weather';
const WEATHER_REFRESH_MS = 30 * 60 * 1000;   // 서버가 30분마다 새로 받으므로 맞춰 둡니다

document.addEventListener('DOMContentLoaded', () => {
    // 지난번 받아 둔 날씨로 먼저 그립니다. 서버 응답(1~2초)을 기다리는 동안 '--' 가 안 보이게.
    const saved = weatherLoadSaved();
    if (saved) {
        window.__weather = saved;
        renderWeatherWidget(saved, false);
    }
    loadWeather();
    setInterval(loadWeather, WEATHER_REFRESH_MS);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && weatherModalOpen()) closeWeatherModal();
    });
});

async function loadWeather() {
    if (typeof callAppsScript !== 'function') return;
    try {
        const r = await callAppsScript('getWeather');
        if (!r || r.status !== 'success') {
            console.warn('날씨 로드 실패:', r && r.message);
            return;
        }
        window.__weather = r;
        weatherSave(r);
        renderWeatherWidget(r, true);
        if (weatherModalOpen()) renderWeatherModal(r);
        console.log(`🌦️ 날씨 로드 완료: ${r.now.temp}°C, ${weatherText(r.now.pty, r.now.sky)}`);
    } catch (e) {
        console.error('날씨 로드 실패:', e);
    }
}

// ── 저장 (브라우저에 마지막 날씨를 남겨 두기) ─────────────────
function weatherLoadSaved() {
    try { return JSON.parse(localStorage.getItem(WEATHER_STORE_KEY) || 'null'); }
    catch (e) { return null; }
}
function weatherSave(r) {
    try { localStorage.setItem(WEATHER_STORE_KEY, JSON.stringify(r)); } catch (e) {}
}

// ── 기상청 코드 → 글자·그림 ────────────────────────────────────
//  강수형태(PTY): 없음0 비1 비/눈2 눈3 소나기4 빗방울5 빗방울눈날림6 눈날림7
//  하늘상태(SKY): 맑음1 구름많음3 흐림4
const PTY_TEXT = { 1: '비', 2: '비/눈', 3: '눈', 4: '소나기', 5: '빗방울', 6: '빗방울·눈날림', 7: '눈날림' };
const SKY_TEXT = { 1: '맑음', 3: '구름 많음', 4: '흐림' };

function weatherText(pty, sky) {
    if (pty) return PTY_TEXT[pty] || '비';
    return SKY_TEXT[sky] || '--';
}
function isNightHour(h) { return h >= 19 || h < 6; }
function weatherKind(pty, sky, night) {
    if (pty === 1 || pty === 4 || pty === 5) return 'rain';
    if (pty === 2 || pty === 6) return 'sleet';
    if (pty === 3 || pty === 7) return 'snow';
    if (sky === 3) return night ? 'partly-night' : 'partly-day';
    if (sky === 4) return 'cloud';
    return night ? 'moon' : 'sun';
}
function weatherIcon(kind) { return 'img/weather/' + kind + '.svg'; }
function rnd(v) { return (v === null || v === undefined || isNaN(v)) ? '--' : Math.round(v); }

// ── 사이드바 위젯 ─────────────────────────────────────────────
function renderWeatherWidget(r, fresh) {
    const elTemp = document.getElementById('weather-temp');
    const elDesc = document.getElementById('weather-desc');
    const elIcon = document.getElementById('weather-icon');
    const elHum  = document.getElementById('weather-humidity');
    const elMax  = document.getElementById('temp-max');
    const elMin  = document.getElementById('temp-min');
    if (!elTemp || !r || !r.now) return;

    const now = r.now;
    const night = isNightHour(new Date().getHours());
    const kind = weatherKind(now.pty, now.sky, night);
    const temp = rnd(now.temp);

    // 처음 받아온 순간에만 숫자가 올라가는 효과. 저장본을 그릴 땐 바로 표시.
    if (fresh && typeof temp === 'number' && elTemp.dataset.shown !== String(temp)) {
        animateValue(elTemp, 0, temp, 1000);
    } else {
        elTemp.textContent = temp;
    }
    elTemp.dataset.shown = String(temp);

    if (elDesc) elDesc.textContent = weatherText(now.pty, now.sky);
    if (elIcon) { elIcon.src = weatherIcon(kind); elIcon.alt = weatherText(now.pty, now.sky); }
    if (elHum)  elHum.textContent = (now.hum !== null && now.hum !== undefined) ? now.hum + '%' : '--%';
    if (elMax)  elMax.textContent = rnd(r.today && r.today.max);
    if (elMin)  elMin.textContent = rnd(r.today && r.today.min);

    // 새 날씨를 받으면 연출을 한 번 틉니다. (위젯이 화면에 보일 때만)
    window.__wxKind = kind;
    if (fresh) wxFxRequest();
}

// ── 위젯 배경 연출 ───────────────────────────────────────────
//  날씨에 맞는 연출이 0.6초 동안 나타나 5초쯤 보이고 1.2초 동안 사라집니다.
//  모양·움직임은 css/weather-animation.css 에 있습니다.
//
//  폰에서는 위젯이 사이드바 안에 숨어 있어서, 앱을 켤 때 틀면 아무도 못 봅니다.
//  그래서 '위젯이 화면에 보이는 순간' 틉니다. (폰: 사이드바를 열 때 / PC: 앱을 켤 때)
//  너무 자주 나오면 거슬리므로 45초에 한 번까지만.
const WX_FX_SHOW_MS = 5000;
const WX_FX_GAP_MS  = 45000;
let wxFxVisible = false, wxFxLastAt = 0, wxFxT1 = null, wxFxT2 = null;

document.addEventListener('DOMContentLoaded', function () {
    const widget = document.getElementById('weather-widget');
    if (!widget || !('IntersectionObserver' in window)) { wxFxVisible = true; return; }
    new IntersectionObserver(function (entries) {
        const vis = entries.some(function (e) { return e.isIntersecting && e.intersectionRatio > 0.5; });
        if (vis && !wxFxVisible) { wxFxVisible = true; wxFxRequest(); }
        else if (!vis) wxFxVisible = false;
    }, { threshold: [0, 0.5, 1] }).observe(widget);
});

function wxFxRequest() {
    if (!wxFxVisible || !window.__wxKind) return;
    if (Date.now() - wxFxLastAt < WX_FX_GAP_MS) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    wxFxLastAt = Date.now();
    playWeatherAnimation(window.__wxKind);
}

function playWeatherAnimation(kind) {
    const widget = document.getElementById('weather-widget');
    const layer = widget ? widget.querySelector('.weather-animation-layer') : null;
    if (!layer) return;

    clearTimeout(wxFxT1); clearTimeout(wxFxT2);
    layer.classList.remove('fx-on');
    layer.innerHTML = wxBuildFx(kind);
    if (!layer.innerHTML) return;
    // 구름만 위젯 안에서 놀고, 나머지는 위로 넘쳐 위 메뉴 위에서부터 보입니다.
    layer.classList.toggle('fx-tall', !/cloud|partly/.test(kind));
    wxFxPlace(widget, layer, kind);

    void layer.offsetWidth;                 // 투명한 상태를 먼저 그린 뒤
    layer.classList.add('fx-on');           // 서서히 나타납니다
    wxFxT1 = setTimeout(function () {
        layer.classList.remove('fx-on');
        delete widget.dataset.fx;           // 아이콘 움직임도 멈춥니다
    }, WX_FX_SHOW_MS);
    wxFxT2 = setTimeout(function () {       // 다 사라진 뒤 요소를 치웁니다
        if (!layer.classList.contains('fx-on')) layer.innerHTML = '';
    }, WX_FX_SHOW_MS + 1500);
}

// 해·달 빛이 아이콘 한가운데서 퍼지도록 아이콘 중심을 재서 넘겨 줍니다.
// 아이콘도 날씨에 맞게 움직입니다. (data-fx → css/weather-animation.css)
function wxFxPlace(widget, layer, kind) {
    const icon = widget.querySelector('#weather-icon');
    if (icon) {
        const a = icon.getBoundingClientRect(), b = layer.getBoundingClientRect();
        layer.style.setProperty('--cx', (a.left - b.left + a.width / 2).toFixed(0) + 'px');
        layer.style.setProperty('--cy', (a.top - b.top + a.height / 2).toFixed(0) + 'px');
    }
    widget.dataset.fx = kind;
}

function wxRand(a, b) { return a + Math.random() * (b - a); }

// 구름 모양 (아이콘과 같은 꼴)
const WX_CLOUD_SVG = '<svg viewBox="0 0 70 36" aria-hidden="true"><g fill="#cbd5e1">' +
    '<circle cx="20" cy="22" r="11"/><circle cx="35" cy="15" r="14"/><circle cx="50" cy="23" r="10"/>' +
    '<rect x="9" y="22" width="52" height="13" rx="6.5"/></g></svg>';

function wxBuildFx(kind) {
    let h = '';
    if (kind === 'sun') {
        h += '<div class="fx-sun"><div class="fx-sun-glow"></div>';
        for (let i = 0; i < 12; i++) {
            h += '<i class="fx-flare" style="--a:' + (i * 30 + wxRand(-8, 8)).toFixed(0) + 'deg;--d:' + wxRand(1.4, 2.8).toFixed(2) +
                 's;--dl:-' + wxRand(0, 2.8).toFixed(2) + 's"></i>';
        }
        for (let i = 0; i < 7; i++) {
            h += '<span class="fx-mote" style="left:' + wxRand(-45, 45).toFixed(0) + 'px;top:' + wxRand(-5, 35).toFixed(0) +
                 'px;animation-delay:' + wxRand(0, 3).toFixed(2) + 's"></span>';
        }
        h += '</div>';
    } else if (kind === 'cloud' || kind === 'partly-day' || kind === 'partly-night') {
        // 큰 구름은 왼쪽에서, 작은 구름은 오른쪽에서 엇갈려 들어옵니다.
        const clouds = [
            { side: 'from-left',  top: 8,   s: 1.0,  o: .34, to: 230, delay: 0 },
            { side: 'from-right', top: 52,  s: .75,  o: .28, to: 215, delay: .45 },
            { side: 'from-left',  top: 104, s: .58,  o: .22, to: 195, delay: .9 }
        ];
        clouds.forEach(function (c) {
            h += '<div class="fx-cloud ' + c.side + '" style="top:' + c.top + 'px;--s:' + c.s + ';--o:' + c.o +
                 ';--to:' + c.to + 'px;animation-delay:' + c.delay + 's">' + WX_CLOUD_SVG + '</div>';
        });
    } else if (kind === 'rain' || kind === 'sleet') {
        h += '<div class="fx-rain-dim"></div>';
        const n = kind === 'sleet' ? 40 : 60;
        for (let i = 0; i < n; i++) {
            h += '<i class="fx-rain" style="left:' + wxRand(-5, 125).toFixed(1) + '%;height:' + wxRand(18, 34).toFixed(0) +
                 'px;opacity:' + wxRand(.55, 1).toFixed(2) + ';animation-duration:' + wxRand(.5, .8).toFixed(2) +
                 's;animation-delay:-' + wxRand(0, .9).toFixed(2) + 's"></i>';
        }
        if (kind === 'sleet') h += wxSnowFlakes(12);
    } else if (kind === 'snow') {
        h += wxSnowFlakes(30);
    } else if (kind === 'moon') {
        h += '<div class="fx-moon-glow"></div>';
        for (let i = 0; i < 14; i++) {
            h += '<span class="fx-star" style="left:' + wxRand(4, 96).toFixed(0) + '%;top:' + wxRand(4, 70).toFixed(0) +
                 '%;animation-delay:-' + wxRand(0, 2.4).toFixed(2) + 's"></span>';
        }
    }
    return h;
}

function wxSnowFlakes(n) {
    let h = '';
    for (let i = 0; i < n; i++) {
        const size = wxRand(2, 5).toFixed(1);
        h += '<i class="fx-snow" style="left:' + wxRand(0, 100).toFixed(1) + '%;width:' + size + 'px;height:' + size +
             'px;opacity:' + wxRand(.6, 1).toFixed(2) + ';animation-duration:' + wxRand(4, 7).toFixed(2) +
             's;animation-delay:-' + wxRand(0, 6).toFixed(2) + 's"></i>';
    }
    return h;
}

// ── 날씨 창 (위젯을 누르면) ──────────────────────────────────
function weatherModalOpen() {
    const m = document.getElementById('weather-modal');
    return !!(m && !m.classList.contains('hidden'));
}

function openWeatherModal() {
    const m = document.getElementById('weather-modal');
    if (!m) return;

    // 폰에서는 위젯이 사이드바 안에 있습니다. 사이드바를 접고 본 화면 위에 띄웁니다.
    if (typeof window.closeSidebarNow === 'function') {
        try { window.closeSidebarNow(); } catch (e) {}
    }

    // 창을 먼저 띄운 뒤 그립니다. 숨긴 채로 그리면 상자 폭이 0으로 재져서
    //  시간별 그래프가 칸을 넓히지 못하고 왼쪽에 몰립니다.
    m.classList.remove('hidden');

    if (window.__weather) renderWeatherModal(window.__weather);
    else document.getElementById('wx-body').innerHTML =
        '<div class="py-16 text-center text-sm text-white/70">날씨를 불러오는 중입니다…</div>';

    const body = document.getElementById('wx-body');
    if (body) body.scrollTop = 0;

    if (typeof logClientActionAsync === 'function') {
        try { logClientActionAsync('날씨 상세 보기'); } catch (e) {}
    }
    if (!window.__weather) loadWeather();
}

function closeWeatherModal() {
    const m = document.getElementById('weather-modal');
    if (m) m.classList.add('hidden');
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
// 강수확률 앞의 작은 물방울. (☔ 이모지는 회색 바탕에서 탁한 보라색으로 보여서 직접 그립니다)
const WX_DROP = '<svg viewBox="0 0 10 12" class="inline-block w-2.5 h-3 mr-1 -mt-0.5 align-middle" aria-hidden="true">' +
                '<path d="M5 0.5C3.2 3.4 1 5.6 1 7.9A4 4 0 0 0 9 7.9C9 5.6 6.8 3.4 5 0.5Z" fill="currentColor"/></svg>';
function ymdToDate(ymd) { return new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)); }
function todayYmd() {
    const t = new Date();
    return t.getFullYear() + String(t.getMonth() + 1).padStart(2, '0') + String(t.getDate()).padStart(2, '0');
}
function popClass(p) {
    if (p === null || p === undefined) return 'text-white/30';
    if (p >= 60) return 'text-sky-300 font-bold';
    if (p >= 30) return 'text-sky-100';
    return 'text-white/45';
}

function renderWeatherModal(r) {
    const body = document.getElementById('wx-body');
    if (!body || !r || !r.now) return;

    const now = r.now;
    const nightNow = isNightHour(new Date().getHours());
    const kindNow = weatherKind(now.pty, now.sky, nightNow);
    const today = todayYmd();
    const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
    const tomorrow = tmr.getFullYear() + String(tmr.getMonth() + 1).padStart(2, '0') + String(tmr.getDate()).padStart(2, '0');

    // ── 지금 ──
    //  왼쪽 큰 기온, 오른쪽 습도·바람·강수.
    //  폰: 오른쪽 셋을 세로로 쌓습니다 (아래로 따로 두면 한 줄을 더 먹어 스크롤이 생깁니다)
    //  PC: 오른쪽 셋을 가로로 늘어놓습니다
    let html =
        '<div class="flex items-center gap-3 md:gap-8">' +
        '<div class="flex items-center gap-2.5 md:gap-4 pt-1 shrink-0">' +
          // 아주 좁은 폰(360px 미만)에선 아이콘을 숨겨 오른쪽 세 칸 자리를 내줍니다.
          //  날씨는 아래 '맑음' 글자로 이미 보입니다.
          '<img src="' + weatherIcon(kindNow) + '" alt="" class="w-16 h-16 md:w-32 md:h-32 shrink-0 drop-shadow-xl max-[359px]:hidden">' +
          '<div class="min-w-0">' +
            '<div class="flex items-start leading-none">' +
              '<span class="text-5xl md:text-6xl font-black tracking-tighter tabular-nums">' + rnd(now.temp) + '</span>' +
              '<span class="text-2xl md:text-3xl font-bold mt-1 text-white/80">°</span>' +
            '</div>' +
            '<div class="text-sm md:text-base font-bold mt-1.5">' + weatherText(now.pty, now.sky) + '</div>' +
            '<div class="text-xs md:text-sm text-white/75 mt-0.5">최고 <b class="text-red-200">' + rnd(r.today.max) + '°</b>' +
              ' · 최저 <b class="text-sky-200">' + rnd(r.today.min) + '°</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="flex-1 min-w-0 flex flex-col gap-1.5 md:grid md:grid-cols-3 md:gap-2">' +
          wxStat('습도', (now.hum !== null && now.hum !== undefined) ? now.hum + '%' : '--') +
          wxStat('바람', (now.wind !== null && now.wind !== undefined) ? now.wind + 'm/s' : '--') +
          wxStat('강수확률', (now.pop !== null && now.pop !== undefined) ? now.pop + '%' : '--') +
        '</div>' +
        '</div>';

    const days = r.days || [];
    // 기상청 자료의 마지막 칸은 글피 다음날 0시 한 칸뿐이라, 그대로 두면 점 하나짜리 '하루' 가 생깁니다.
    //  오늘이 아닌 날 중 3시간이 안 되는 날은 시간별에서 뺍니다.
    const hoursAll = r.hours || [];
    const perDay = {};
    hoursAll.forEach(function (h) { perDay[h.d] = (perDay[h.d] || 0) + 1; });
    const hours = hoursAll.filter(function (h) { return h.d === hoursAll[0].d || perDay[h.d] >= 3; });
    const hourDays = {};
    hours.forEach(function (h) { hourDays[h.d] = true; });

    // ── 주간: 가로로 끌어서 보기 ──
    //  폰에서는 4장 남짓 보이고 옆으로 끕니다. PC는 넓어서 7장이 한 줄에 다 들어갑니다.
    //  카드를 누르면 아래 시간별이 그날로 넘어갑니다. (시간별은 이틀치까지라 그 안의 날만)
    if (days.length) {
        const lo = Math.min.apply(null, days.map(d => d.min).filter(v => v !== null));
        const hi = Math.max.apply(null, days.map(d => d.max).filter(v => v !== null));
        const span = Math.max(1, hi - lo);

        html += '<div class="mt-5 mb-2 flex items-baseline justify-between">' +
                  '<span class="text-xs font-bold text-white/70">주간</span>' +
                  '<span class="text-[10px] text-white/40 md:hidden">옆으로 밀어 보기</span>' +
                '</div>' +
                '<div id="wx-days" class="wx-scroll wx-drag flex gap-2 overflow-x-auto snap-x -mx-5 px-5 md:mx-0 md:px-0 pb-1">';
        days.forEach(function (d, i) {
            const v = wxDayView(d, i, today, lo, hi, span);
            const linkable = !!hourDays[d.d];
            html +=
                '<button type="button" data-day="' + d.d + '"' + (linkable ? '' : ' disabled') +
                ' class="wx-day' + (d.d === today ? ' wx-day-on' : '') + ' snap-start flex-none w-[84px] md:flex-1 md:w-auto md:min-w-0' +
                ' rounded-2xl bg-white/10 px-1 pt-3 pb-3 text-center transition-colors focus:outline-none' +
                (linkable ? ' hover:bg-white/15' : ' cursor-default') + '">' +
                  '<div class="text-sm font-bold ' + v.weekend + '">' + v.name + '</div>' +
                  '<div class="text-[11px] text-white/55 tabular-nums">' + v.md + '</div>' +
                  '<div class="flex justify-center mt-2">' +
                    '<div><img src="' + v.amIcon + '" alt="오전" class="w-9 h-9 md:w-11 md:h-11 mx-auto">' +
                      '<div class="text-[10px] text-white/45 -mt-0.5">오전</div></div>' +
                    '<div><img src="' + v.pmIcon + '" alt="오후" class="w-9 h-9 md:w-11 md:h-11 mx-auto">' +
                      '<div class="text-[10px] text-white/45 -mt-0.5">오후</div></div>' +
                  '</div>' +
                  '<div class="mt-1.5 text-[12px] md:text-[13px] tabular-nums ' + popClass(v.pop) + '">' +
                    (v.pop === null ? '&nbsp;' : v.pop + '%') + '</div>' +
                  // 폰: 카드가 좁아 막대를 세로로 세웁니다 (최고 위 · 최저 아래)
                  '<div class="md:hidden">' +
                    '<div class="mt-2 text-base font-bold text-red-200 tabular-nums">' + rnd(d.max) + '°</div>' +
                    '<div class="relative mx-auto my-1 w-1.5 h-12 rounded-full bg-white/15">' +
                      '<div class="absolute inset-x-0 rounded-full bg-gradient-to-t from-sky-300 to-amber-300"' +
                      ' style="top:' + v.barB + '%;bottom:' + v.barA + '%"></div>' +
                    '</div>' +
                    '<div class="text-base font-bold text-sky-200 tabular-nums">' + rnd(d.min) + '°</div>' +
                  '</div>' +
                  // PC: 가로로 눕힙니다. 숫자는 위 양 끝(최저 왼쪽 · 최고 오른쪽),
                  //  막대는 그 아래 카드 폭 전체로 — 숫자 옆에 끼우면 막대가 손톱만 해집니다.
                  '<div class="hidden md:block mt-3 px-2.5">' +
                    '<div class="flex justify-between text-sm font-bold tabular-nums">' +
                      '<span class="text-sky-200">' + rnd(d.min) + '°</span>' +
                      '<span class="text-red-200">' + rnd(d.max) + '°</span>' +
                    '</div>' +
                    '<div class="relative mt-1 h-1.5 rounded-full bg-white/15">' +
                      '<div class="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-300 to-amber-300"' +
                      ' style="left:' + v.barA + '%;right:' + v.barB + '%"></div>' +
                    '</div>' +
                  '</div>' +
                '</button>';
        });
        html += '</div>';
    }

    // ── 시간별: 하루치를 그래프로 ──
    //  위 줄에 시각·날씨·기온, 가운데 기온 곡선(노랑)과 강수확률 선(하늘색), 아래 줄에 강수확률.
    //  하루치를 상자 폭에 맞춰 한눈에 보여 줍니다. (옆으로 끌어 넘기지 않습니다)
    //  그래프를 왼쪽으로 밀면 다음날, 오른쪽으로 밀면 전날. 주간 카드를 눌러도 그날로 갑니다.
    let hrs = [];
    if (hours.length) {
        // 첫 칸 '지금' 은 위의 큰 숫자와 같은 관측값을 씁니다.
        //  (예보값을 쓰면 같은 '지금' 인데 15° / 16° 처럼 숫자가 달라 헷갈립니다)
        hrs = hours.slice();
        hrs[0] = Object.assign({}, hrs[0], { tmp: now.temp, pty: now.pty || hrs[0].pty, now: true });

        html += '<div class="mt-5 mb-2 flex items-baseline justify-between">' +
                  '<span class="text-xs font-bold text-white/70">시간별</span>' +
                  '<span class="text-[10px] text-white/40">옆으로 밀어 다른 날 보기</span>' +
                '</div>' +
                '<div class="rounded-2xl bg-black/10 overflow-hidden">' +
                  '<div class="wx-dayhead px-4 py-1.5 text-[11px] font-bold text-white/85 overflow-hidden flex items-center justify-between gap-3">' +
                    '<span id="wx-hours-head" class="wx-head-text">' + wxDayLabel(hrs[0].d, today, tomorrow) + '</span>' +
                    '<span class="flex items-center gap-3 font-normal text-white/55 whitespace-nowrap">' +
                      '<span><i class="wx-key bg-amber-300"></i>기온</span>' +
                      '<span><i class="wx-key bg-sky-300"></i>강수확률</span>' +
                    '</span>' +
                  '</div>' +
                  '<div id="wx-hours" class="wx-drag wx-swipe overflow-hidden">' +
                    '<div id="wx-hstage" class="wx-hstage">' + wxHourPane(wxHoursOf(hrs, hrs[0].d)) + '</div>' +
                  '</div>' +
                '</div>';
    }

    // ── 출처 (이용 조건: 저작자표시) ──
    const iss = r.issued || {};
    const hhOf = s => (s && s.length >= 10) ? (+s.slice(8, 10)) + '시' : '';
    html += '<div class="mt-5 pt-3 border-t border-white/10 flex justify-between text-[11px] text-white/55">' +
              '<span>자료: 기상청</span>' +
              '<span>' + (iss.now ? hhOf(iss.now) + ' 관측' : '') + (iss.fcst ? ' · ' + hhOf(iss.fcst) + ' 발표' : '') + '</span>' +
            '</div>';

    body.innerHTML = html;

    // ── 끌기 ──
    //  폰은 손가락으로 원래 끌립니다. PC 마우스로도 잡아 끌 수 있게 합니다.
    const daysEl = document.getElementById('wx-days');
    const hoursEl = document.getElementById('wx-hours');
    if (daysEl) { wxEnableDrag(daysEl, 'x'); wxWheelToX(daysEl); }
    if (hoursEl) {
        // 상자 폭을 알았으니 첫 그래프를 그 폭에 맞춰 다시 그립니다.
        document.getElementById('wx-hstage').innerHTML = wxHourPane(wxHoursOf(hrs, hrs[0].d), hoursEl.clientWidth);
    }

    if (hoursEl) wxBindHours(hoursEl, daysEl, hrs, today, tomorrow);
}

// ── 시간별 그래프 ─────────────────────────────────────────
const WX_COL = 48;     // 글자(시각·아이콘·기온) 한 칸에 필요한 최소 폭(px)
const WX_GH  = 92;     // 그래프 높이(px)
let wxGradSeq = 0;     // 그래프마다 채움색 id 를 다르게 (갈아끼우는 동안 두 장이 함께 있으므로)

function wxHoursOf(hrs, day) { return hrs.filter(function (h) { return h.d === day; }); }
function wxNum(v) { return v !== null && v !== undefined && !isNaN(v); }

/** 점들을 부드러운 곡선으로 잇습니다. */
function wxSmooth(p) {
    const f = v => v.toFixed(1);
    let d = 'M' + f(p[0][0]) + ',' + f(p[0][1]);
    for (let i = 0; i < p.length - 1; i++) {
        const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
        d += 'C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ',' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
                   f(p2[0] - (p3[0] - p1[0]) / 6) + ',' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' +
                   f(p2[0]) + ',' + f(p2[1]);
    }
    return d;
}

/**
 * 하루치 그래프 한 장 (위 줄 · 곡선 · 아래 줄)
 *  fitW: 상자 폭. 하루치를 이 폭 안에 다 넣습니다.
 *  한 시간 칸이 글자 넣기엔 좁으면(폰에서 24시간) 2·3·4·6시간마다 글자를 답니다. 곡선은 매시간 그대로.
 */
function wxHourPane(list, fitW) {
    const n = list.length, H = WX_GH, top = 12, bot = 10;
    const W = Math.max(200, Math.floor(fitW || 0) || n * WX_COL);
    const unit = W / n;
    let step = 6;
    for (const k of [1, 2, 3, 4, 6]) { if (unit * k >= WX_COL) { step = k; break; } }
    const LW = Math.min(64, unit * step);              // 글자 칸 폭

    const temps = list.map(h => h.tmp).filter(wxNum);
    let lo = temps.length ? Math.min.apply(null, temps) : 0;
    let hi = temps.length ? Math.max.apply(null, temps) : 1;
    // 기온 차가 작은 날을 산처럼 부풀리지 않게, 최소 4도 폭으로 그립니다.
    if (hi - lo < 4) { const m = (hi + lo) / 2; lo = m - 2; hi = m + 2; }
    const yT = v => top + (hi - v) / (hi - lo) * (H - top - bot);
    const yP = v => top + (100 - v) / 100 * (H - top - bot);
    const x = i => (i + 0.5) * unit;
    // 글자 칸 왼쪽. 칸 가운데를 그 시각에 맞추고, 양 끝에서는 아이콘(32px)이 잘리지 않을 만큼만 안으로 당깁니다.
    //  (칸 전체를 안으로 밀어 넣으면 첫 칸만 왼쪽에 붙어 간격이 들쭉날쭉해집니다)
    const lx = i => (Math.max(18, Math.min(W - 18, x(i))) - LW / 2).toFixed(1);

    // 양 끝 바깥까지 이어 그려서 그래프가 칸 가운데서 뚝 끊기지 않게 합니다.
    const ext = pts => [[0, pts[0][1]]].concat(pts, [[W, pts[pts.length - 1][1]]]);
    const tLine = wxSmooth(ext(list.map((h, i) => [x(i), yT(wxNum(h.tmp) ? h.tmp : lo)])));
    const pLine = wxSmooth(ext(list.map((h, i) => [x(i), yP(wxNum(h.pop) ? h.pop : 0)])));
    const id = 'wxg' + (++wxGradSeq);

    let grid = '', labels = '', pops = '';
    list.forEach(function (h, i) {
        if (i % step) return;
        const hh = +h.t.slice(0, 2);
        grid += '<line x1="' + x(i).toFixed(1) + '" y1="0" x2="' + x(i).toFixed(1) + '" y2="' + H + '"/>';
        labels +=
            '<div class="absolute top-0 text-center pt-3" style="left:' + lx(i) + 'px;width:' + LW + 'px">' +
              '<div class="text-[12px] tabular-nums ' + (h.now ? 'font-bold' : 'text-white/75') + '">' + (h.now ? '지금' : hh + '시') + '</div>' +
              '<img src="' + weatherIcon(weatherKind(h.pty, h.sky, isNightHour(hh))) + '" alt="' + weatherText(h.pty, h.sky) + '" class="w-8 h-8 mx-auto mt-1">' +
              '<div class="text-sm font-bold tabular-nums mt-0.5">' + rnd(h.tmp) + '°</div>' +
            '</div>';
        pops +=
            '<div class="absolute top-1 text-center text-[11px] tabular-nums ' + popClass(h.pop) + '" style="left:' + lx(i) + 'px;width:' + LW + 'px">' +
              (wxNum(h.pop) ? h.pop + '%' : '') + '</div>';
    });

    return '<div class="wx-hpane" style="width:' + W + 'px">' +
             '<div class="wx-hlabels relative" style="height:86px">' + labels + '</div>' +
             '<div class="wx-hgraph" style="height:' + H + 'px">' +
               '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
                 '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
                   '<stop offset="0" stop-color="#fcd34d" stop-opacity=".42"/>' +
                   '<stop offset="1" stop-color="#fcd34d" stop-opacity="0"/>' +
                 '</linearGradient></defs>' +
                 '<g stroke="rgba(255,255,255,.06)" stroke-width="1">' + grid + '</g>' +
                 '<path d="' + tLine + ' L' + W + ',' + H + ' L0,' + H + ' Z" fill="url(#' + id + ')"/>' +
                 '<path d="' + tLine + '" fill="none" stroke="#fcd34d" stroke-width="2" stroke-linecap="round"/>' +
                 '<path d="' + pLine + '" fill="none" stroke="#7dd3fc" stroke-opacity=".85" stroke-width="1.5" stroke-linecap="round"/>' +
               '</svg>' +
             '</div>' +
             '<div class="wx-hpops relative" style="height:28px">' + pops + '</div>' +
           '</div>';
}

/** 시간별 머리줄에 들어갈 글자: '내일 · 10/29 (목)' */
function wxDayLabel(ymd, today, tomorrow) {
    const dt = ymdToDate(ymd);
    const diff = Math.round((dt - ymdToDate(today)) / 86400000);
    const nm = ['오늘', '내일', '모레', '글피'][diff] || WEEKDAY[dt.getDay()] + '요일';
    return nm + ' · ' + (dt.getMonth() + 1) + '/' + dt.getDate() + ' (' + WEEKDAY[dt.getDay()] + ')';
}

/**
 * 주간 카드 ↔ 시간별 그래프 ↔ 머리줄을 한 몸으로 묶습니다.
 *  · 카드를 누르거나 그래프를 옆으로 밀면(왼쪽 = 다음날, 오른쪽 = 전날) 날짜가 바뀝니다.
 *  · 바뀔 때 지금 그래프는 아래로 가라앉고, 그날 그래프가 아래에서 올라옵니다.
 *  · 머리줄 글자는 앞날로 가면 위로 빠지고 아래에서 올라오며, 뒷날로 가면 반대입니다.
 */
function wxBindHours(hoursEl, daysEl, hrs, today, tomorrow) {
    const headEl = document.getElementById('wx-hours-head');
    const stage = document.getElementById('wx-hstage');
    let shownDay = hrs.length ? hrs[0].d : null;
    if (!stage) return;

    function markCard(day) {
        if (!daysEl) return;
        daysEl.querySelectorAll('.wx-day').forEach(function (b) { b.classList.toggle('wx-day-on', b.dataset.day === day); });
    }

    function swapHead(day, forward) {
        if (!headEl) return;
        headEl.classList.remove('wx-in-up', 'wx-in-down');
        headEl.classList.add(forward ? 'wx-out-up' : 'wx-out-down');
        setTimeout(function () {
            headEl.textContent = wxDayLabel(day, today, tomorrow);
            headEl.classList.remove('wx-out-up', 'wx-out-down');
            headEl.classList.add(forward ? 'wx-in-up' : 'wx-in-down');
            void headEl.offsetWidth;                         // 시작 위치를 먼저 그리게 한 뒤
            headEl.classList.remove('wx-in-up', 'wx-in-down'); // 제자리로 미끄러져 들어옵니다
        }, 150);
    }

    function swapGraph(day) {
        // 빠르게 연달아 누른 경우: 가라앉던 장은 바로 치우고, 지금 장을 제자리에 앉힌 뒤 시작합니다.
        stage.querySelectorAll('.wx-hpane.wx-out').forEach(function (el) { el.remove(); });
        const old = stage.querySelector('.wx-hpane');
        if (old) old.classList.remove('wx-float');

        stage.insertAdjacentHTML('beforeend', wxHourPane(wxHoursOf(hrs, day), hoursEl.clientWidth));
        const nu = stage.lastElementChild;
        nu.classList.add('wx-float', 'wx-pre');          // 겹쳐 놓고, 그래프는 아래에 숨겨 둔 채로
        void nu.offsetWidth;
        if (old) old.classList.add('wx-out');            // 지금 장은 가라앉고
        nu.classList.remove('wx-pre');                   // 새 장은 올라옵니다
        hoursEl.scrollLeft = 0;
        setTimeout(function () {
            if (old) old.remove();
            nu.classList.remove('wx-float');
        }, 520);
    }

    function goDay(day) {
        if (!day || day === shownDay || !wxHoursOf(hrs, day).length) return;
        const forward = !shownDay || day > shownDay;
        shownDay = day;
        markCard(day);
        swapHead(day, forward);
        swapGraph(day);
    }

    if (daysEl) {
        daysEl.addEventListener('click', function (e) {
            const btn = e.target.closest('.wx-day');
            if (btn && !btn.disabled) goDay(btn.dataset.day);
        });
    }

    // 그래프 밀기: 손가락(또는 마우스)을 옆으로 40px 넘게, 위아래보다 옆으로 더 많이 움직였을 때만.
    //  위아래로 움직이면 창 스크롤로 두고 날짜는 그대로입니다.
    const dayList = [];
    hrs.forEach(function (h) { if (dayList.indexOf(h.d) < 0) dayList.push(h.d); });
    let sx = null, sy = 0;
    hoursEl.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
    hoursEl.addEventListener('pointercancel', function () { sx = null; });
    hoursEl.addEventListener('pointerup', function (e) {
        if (sx === null) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        sx = null;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        goDay(dayList[dayList.indexOf(shownDay) + (dx < 0 ? 1 : -1)]);
    });
}

/**
 * PC 마우스로 잡아 끌어서 넘기기. (터치는 원래 되므로 마우스만 다룹니다)
 *  조금(4px) 움직여야 끌기로 치고, 그 전에 놓으면 그냥 '누르기' 입니다.
 *  끌다가 놓은 자리의 카드가 눌린 것으로 처리되지 않게 막습니다.
 */
function wxEnableDrag(el, axis) {
    let down = false, moved = false, startPos = 0, startScroll = 0;
    el.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        down = true; moved = false;
        startPos = axis === 'x' ? e.clientX : e.clientY;
        startScroll = axis === 'x' ? el.scrollLeft : el.scrollTop;
    });
    el.addEventListener('pointermove', function (e) {
        if (!down) return;
        const d = (axis === 'x' ? e.clientX : e.clientY) - startPos;
        if (!moved && Math.abs(d) > 4) {
            moved = true;
            try { el.setPointerCapture(e.pointerId); } catch (err) {}
            el.classList.add('wx-grabbing');
        }
        if (!moved) return;
        if (axis === 'x') el.scrollLeft = startScroll - d;
        else el.scrollTop = startScroll - d;
    });
    const end = function () {
        if (!down) return;
        down = false;
        el.classList.remove('wx-grabbing');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', function (e) {
        if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
    }, true);
}

/** 옆으로 긴 줄 위에서는 마우스 휠을 옆으로 바꿔 줍니다. 끝에 닿으면 창 전체가 굴러가게 놔둡니다. */
function wxWheelToX(el) {
    el.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
        const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0;
        if (atStart || atEnd) return;
        el.scrollLeft += e.deltaY;
        e.preventDefault();
    }, { passive: false });
}

/** 주간 한 칸에 필요한 값을 한 곳에서 계산합니다. (폰 목록·PC 카드 공용) */
function wxDayView(d, i, today, lo, hi, span) {
    const dt = ymdToDate(d.d);
    const am = d.am || d.pm, pm = d.pm || d.am;
    const p = Math.max(am && am.pop !== null ? am.pop : -1, pm && pm.pop !== null ? pm.pop : -1);
    return {
        name: d.d === today ? '오늘' : (i === 1 && d.d > today ? '내일' : WEEKDAY[dt.getDay()]),
        md: (dt.getMonth() + 1) + '/' + dt.getDate(),
        weekend: dt.getDay() === 0 ? 'text-red-200' : (dt.getDay() === 6 ? 'text-sky-200' : ''),
        amIcon: weatherIcon(weatherKind(am ? am.pty : 0, am ? am.sky : 1, false)),
        pmIcon: weatherIcon(weatherKind(pm ? pm.pty : 0, pm ? pm.sky : 1, false)),
        pop: p < 0 ? null : p,
        // 막대: 이번 주 최저~최고 사이에서 그날이 차지하는 구간
        //  barA = 아래(폰은 왼쪽) 여백 %, barB = 위(폰은 오른쪽) 여백 %
        barA: (d.min === null ? 0 : (d.min - lo) / span * 100).toFixed(1),
        barB: (d.max === null ? 0 : (hi - d.max) / span * 100).toFixed(1)
    };
}

function wxStat(label, value) {
    // 폰: 한 줄짜리 (이름 왼쪽 · 값 오른쪽)  /  PC: 위아래 가운데 정렬 칸
    return '<div class="rounded-xl md:rounded-2xl bg-white/10 px-3 py-1.5 md:px-0 md:py-3' +
                  ' flex items-center justify-between gap-2 md:block md:text-center">' +
             '<div class="text-[11px] md:text-xs text-white/60 whitespace-nowrap">' + label + '</div>' +
             '<div class="text-sm md:text-lg font-bold tabular-nums whitespace-nowrap md:mt-0.5">' + value + '</div>' +
           '</div>';
}

// 숫자 카운트 효과 (음수도 자연스럽게)
function animateValue(obj, start, end, duration) {
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.round(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}
