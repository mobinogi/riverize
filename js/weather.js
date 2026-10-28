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

    if (fresh) playWeatherAnimation(kind);
}

// 위젯 배경의 날씨 효과 (해·비·눈·구름). 몇 초 보여 주고 사라집니다.
function playWeatherAnimation(kind) {
    const widget = document.getElementById('weather-widget');
    const layer = widget ? widget.querySelector('.weather-animation-layer') : null;
    if (!widget || !layer) return;

    widget.classList.remove('rain-active', 'snow-active', 'clouds-active', 'sun-active');

    let cls = null, ms = 4000;
    if (kind === 'sun') {
        layer.innerHTML = '';
        cls = 'sun-active'; ms = 4000;
    } else if (kind === 'rain' || kind === 'sleet') {
        if (!layer.querySelector('.drop')) makeItRainJS(layer);
        cls = 'rain-active'; ms = 3000;
    } else if (kind === 'snow') {
        layer.innerHTML = '';
        cls = 'snow-active'; ms = 3000;
    } else if (kind === 'cloud' || kind === 'partly-day' || kind === 'partly-night') {
        if (!layer.querySelector('.cloud-1')) {
            layer.innerHTML = '<div class="cloud-1"><div class="cloud"></div></div>' +
                              '<div class="cloud-2"><div class="cloud"></div></div>';
        }
        cls = 'clouds-active'; ms = 10000;
    } else {
        layer.innerHTML = '';   // 맑은 밤: 효과 없음
    }

    if (cls) {
        widget.classList.add(cls);
        setTimeout(() => widget.classList.remove(cls), ms);
    }
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

    if (window.__weather) renderWeatherModal(window.__weather);
    else document.getElementById('wx-body').innerHTML =
        '<div class="py-16 text-center text-sm text-white/70">날씨를 불러오는 중입니다…</div>';

    m.classList.remove('hidden');
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

    // ── 지금 ──
    let html =
        '<div class="flex items-center gap-4 pt-1">' +
          '<img src="' + weatherIcon(kindNow) + '" alt="" class="w-20 h-20 shrink-0 drop-shadow-xl">' +
          '<div class="min-w-0">' +
            '<div class="flex items-start leading-none">' +
              '<span class="text-5xl font-black tracking-tighter tabular-nums">' + rnd(now.temp) + '</span>' +
              '<span class="text-2xl font-bold mt-1 text-white/80">°</span>' +
            '</div>' +
            '<div class="text-sm font-bold mt-1.5">' + weatherText(now.pty, now.sky) + '</div>' +
            '<div class="text-xs text-white/75 mt-0.5">최고 <b class="text-red-200">' + rnd(r.today.max) + '°</b>' +
              ' · 최저 <b class="text-sky-200">' + rnd(r.today.min) + '°</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-cols-3 gap-2 mt-4 text-center">' +
          wxStat('습도', (now.hum !== null && now.hum !== undefined) ? now.hum + '%' : '--') +
          wxStat('바람', (now.wind !== null && now.wind !== undefined) ? now.wind + 'm/s' : '--') +
          wxStat('강수확률', (now.pop !== null && now.pop !== undefined) ? now.pop + '%' : '--') +
        '</div>';

    // ── 시간별 (24시간, 옆으로 밀어서 보기) ──
    const hours = (r.hours || []).slice(0, 24);
    if (hours.length) {
        html += '<div class="mt-5 mb-2 text-xs font-bold text-white/70">시간별</div>' +
                '<div class="wx-scroll flex overflow-x-auto pb-1 -mx-1">';
        hours.forEach(function (h, i) {
            // 첫 칸 '지금' 은 위의 큰 숫자와 같은 관측값을 씁니다.
            //  (예보값을 쓰면 같은 '지금' 인데 15° / 16° 처럼 숫자가 달라 헷갈립니다)
            if (i === 0) h = Object.assign({}, h, { tmp: now.temp, pty: now.pty || h.pty });
            const hh = +h.t.slice(0, 2);
            const newDay = i > 0 && hh === 0;
            const label = i === 0 ? '지금' : (newDay ? (h.d === today ? '오늘' : '내일') : hh + '시');
            html +=
                '<div class="flex-none w-12 text-center px-0.5' + (newDay ? ' border-l border-white/20' : '') + '">' +
                  '<div class="text-[11px] ' + (i === 0 || newDay ? 'font-bold text-white' : 'text-white/65') + '">' + label + '</div>' +
                  '<img src="' + weatherIcon(weatherKind(h.pty, h.sky, isNightHour(hh))) + '" alt="" class="w-8 h-8 mx-auto my-1">' +
                  '<div class="text-sm font-bold tabular-nums">' + rnd(h.tmp) + '°</div>' +
                  '<div class="text-[11px] tabular-nums ' + popClass(h.pop) + '">' + (h.pop === null ? '' : h.pop + '%') + '</div>' +
                '</div>';
        });
        html += '</div>';
    }

    // ── 주간 ──
    const days = r.days || [];
    if (days.length) {
        const lo = Math.min.apply(null, days.map(d => d.min).filter(v => v !== null));
        const hi = Math.max.apply(null, days.map(d => d.max).filter(v => v !== null));
        const span = Math.max(1, hi - lo);

        html += '<div class="mt-5 mb-1 text-xs font-bold text-white/70">주간</div>' +
                '<div class="divide-y divide-white/10">';
        days.forEach(function (d, i) {
            const dt = ymdToDate(d.d);
            const name = d.d === today ? '오늘' : (i === 1 && d.d > today ? '내일' : WEEKDAY[dt.getDay()]);
            const weekend = dt.getDay() === 0 ? 'text-red-200' : (dt.getDay() === 6 ? 'text-sky-200' : '');
            const am = d.am || d.pm, pm = d.pm || d.am;
            const pop = Math.max(am && am.pop !== null ? am.pop : -1, pm && pm.pop !== null ? pm.pop : -1);
            const left  = d.min === null ? 0 : ((d.min - lo) / span * 100);
            const right = d.max === null ? 0 : ((hi - d.max) / span * 100);

            html +=
                '<div class="flex items-center gap-2 py-2.5">' +
                  '<div class="w-11 shrink-0 leading-tight">' +
                    '<div class="text-sm font-bold ' + weekend + '">' + name + '</div>' +
                    '<div class="text-[10px] text-white/55 tabular-nums">' + (dt.getMonth() + 1) + '/' + dt.getDate() + '</div>' +
                  '</div>' +
                  '<div class="flex items-center shrink-0" title="오전 / 오후">' +
                    '<img src="' + weatherIcon(weatherKind(am ? am.pty : 0, am ? am.sky : 1, false)) + '" alt="오전" class="w-7 h-7">' +
                    '<img src="' + weatherIcon(weatherKind(pm ? pm.pty : 0, pm ? pm.sky : 1, false)) + '" alt="오후" class="w-7 h-7">' +
                  '</div>' +
                  '<div class="w-10 shrink-0 text-right text-[12px] tabular-nums ' + popClass(pop < 0 ? null : pop) + '">' +
                    (pop < 0 ? '' : pop + '%') + '</div>' +
                  '<div class="flex-1 min-w-0 flex items-center gap-1.5">' +
                    '<span class="w-7 shrink-0 text-right text-sm font-bold text-sky-200 tabular-nums">' + rnd(d.min) + '°</span>' +
                    '<div class="relative flex-1 h-1.5 rounded-full bg-white/15">' +
                      '<div class="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-300 to-amber-300"' +
                      ' style="left:' + left.toFixed(1) + '%;right:' + right.toFixed(1) + '%"></div>' +
                    '</div>' +
                    '<span class="w-7 shrink-0 text-sm font-bold text-red-200 tabular-nums">' + rnd(d.max) + '°</span>' +
                  '</div>' +
                '</div>';
        });
        html += '</div>';
        if (days.length < 7) {
            html += '<div class="mt-1 text-[11px] text-white/45">그 뒤 날짜는 준비 중입니다.</div>';
        }
    }

    // ── 출처 (이용 조건: 저작자표시) ──
    const iss = r.issued || {};
    const hhOf = s => (s && s.length >= 10) ? (+s.slice(8, 10)) + '시' : '';
    html += '<div class="mt-5 pt-3 border-t border-white/10 flex justify-between text-[11px] text-white/55">' +
              '<span>자료: 기상청</span>' +
              '<span>' + (iss.now ? hhOf(iss.now) + ' 관측' : '') + (iss.fcst ? ' · ' + hhOf(iss.fcst) + ' 발표' : '') + '</span>' +
            '</div>';

    body.innerHTML = html;

    // PC 마우스 휠은 위아래로만 굴러서 옆으로 긴 시간별 줄을 넘기기 어렵습니다.
    //  그 줄 위에서는 휠을 옆으로 바꿔 줍니다. (터치·트랙패드는 원래대로)
    const strip = body.querySelector('.wx-scroll');
    if (strip) {
        strip.addEventListener('wheel', function (e) {
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            const atStart = strip.scrollLeft <= 0 && e.deltaY < 0;
            const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1 && e.deltaY > 0;
            if (atStart || atEnd) return;      // 끝에 닿으면 창 전체가 위아래로 스크롤되게 놔둡니다
            strip.scrollLeft += e.deltaY;
            e.preventDefault();
        }, { passive: false });
    }
}

function wxStat(label, value) {
    return '<div class="rounded-2xl bg-white/10 py-2">' +
             '<div class="text-[11px] text-white/60">' + label + '</div>' +
             '<div class="text-sm font-bold tabular-nums mt-0.5">' + value + '</div>' +
           '</div>';
}

// ----------------------------------------------------
// 빗방울 효과 (위젯 배경)
// ----------------------------------------------------
function makeItRainJS(targetLayer) {
    targetLayer.innerHTML = '';
    var increment = 0;
    var dropsHtml = "";
    while (increment < 400) {
        var randoHundo = (Math.floor(Math.random() * (98 - 1 + 1) + 1));
        var randoFiver = (Math.floor(Math.random() * (5 - 2 + 1) + 2));
        increment += randoFiver;
        dropsHtml += '<div class="drop" style="left: ' + increment + '%; bottom: ' + (randoFiver + randoFiver - 1 + 100) + '%; animation-delay: 0.' + randoHundo + 's; animation-duration: 0.5' + randoHundo + 's;"><div class="stem"></div><div class="splat"></div></div>';
    }
    targetLayer.innerHTML = dropsHtml;
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
