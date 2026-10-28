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
    //  폰: 위아래로 쌓음 / PC(md 이상): 왼쪽 큰 기온, 오른쪽 습도·바람·강수 한 줄
    let html =
        '<div class="md:flex md:items-center md:gap-8">' +
        '<div class="flex items-center gap-4 pt-1 md:shrink-0">' +
          '<img src="' + weatherIcon(kindNow) + '" alt="" class="w-24 h-24 md:w-32 md:h-32 shrink-0 drop-shadow-xl">' +
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
        '<div class="grid grid-cols-3 gap-2 mt-4 md:mt-0 md:flex-1 text-center">' +
          wxStat('습도', (now.hum !== null && now.hum !== undefined) ? now.hum + '%' : '--') +
          wxStat('바람', (now.wind !== null && now.wind !== undefined) ? now.wind + 'm/s' : '--') +
          wxStat('강수확률', (now.pop !== null && now.pop !== undefined) ? now.pop + '%' : '--') +
        '</div>' +
        '</div>';

    const days = r.days || [];
    const hours = r.hours || [];
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

    // ── 시간별: 세로 목록, 5줄 정도 보이고 위아래로 끌어서 보기 ──
    //  날짜가 바뀌는 자리에 '내일 · 10/29 (목)' 머리줄이 붙고, 끌어 내려도 위에 붙어 있습니다.
    if (hours.length) {
        //  머리줄은 목록 밖에 하나만 둡니다. 날짜가 넘어가면 글자만 바뀝니다.
        //  (예전엔 날짜마다 머리줄이 위에 붙어서, 넘어갈 때 서로 밀어 올리며 겹쳐 보였습니다)
        html += '<div class="mt-5 mb-2 text-xs font-bold text-white/70">시간별</div>' +
                '<div class="rounded-2xl bg-black/10 overflow-hidden">' +
                  '<div class="wx-dayhead px-4 py-1.5 text-[11px] font-bold text-white/85 overflow-hidden">' +
                    '<span id="wx-hours-head" class="wx-head-text">' + wxDayLabel(hours[0].d, today, tomorrow) + '</span>' +
                  '</div>' +
                '<div id="wx-hours" class="wx-hours wx-drag relative overflow-y-auto">';
        let lastD = hours[0].d;
        hours.forEach(function (h, i) {
            // 첫 줄 '지금' 은 위의 큰 숫자와 같은 관측값을 씁니다.
            //  (예보값을 쓰면 같은 '지금' 인데 15° / 16° 처럼 숫자가 달라 헷갈립니다)
            if (i === 0) h = Object.assign({}, h, { tmp: now.temp, pty: now.pty || h.pty });
            const hh = +h.t.slice(0, 2);

            // 날짜가 바뀌는 자리는 그 줄의 윗선만 진하게 긋습니다.
            //  날짜 글자는 위 머리줄이 이미 보여 주므로 여기엔 적지 않습니다.
            //  (적어 두면 카드를 눌러 넘어갔을 때 머리줄과 같은 글자가 두 번 보입니다)
            const newDay = h.d !== lastD;
            if (newDay) lastD = h.d;

            const rain = (h.pty && h.pcp && h.pcp !== '강수없음') ? ' · ' + h.pcp : '';
            html +=
                '<div data-d="' + h.d + '" class="wx-hrow flex items-center gap-3 px-4 h-12 border-t ' +
                  (newDay && i > 0 ? 'border-white/30' : 'border-white/5') + '">' +
                  '<div class="w-10 shrink-0 text-sm tabular-nums ' + (i === 0 ? 'font-bold' : 'text-white/80') + '">' +
                    (i === 0 ? '지금' : hh + '시') + '</div>' +
                  '<img src="' + weatherIcon(weatherKind(h.pty, h.sky, isNightHour(hh))) + '" alt="" class="w-8 h-8 md:w-9 md:h-9 shrink-0">' +
                  '<div class="flex-1 min-w-0 text-[13px] text-white/80 truncate">' + weatherText(h.pty, h.sky) + rain + '</div>' +
                  '<div class="w-14 shrink-0 text-right text-[12px] tabular-nums ' + popClass(h.pop) + '">' +
                    (h.pop === null ? '' : WX_DROP + h.pop + '%') + '</div>' +
                  '<div class="w-11 shrink-0 text-right text-base font-bold tabular-nums">' + rnd(h.tmp) + '°</div>' +
                '</div>';
        });
        html += '</div></div>';
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
    if (hoursEl) wxEnableDrag(hoursEl, 'y');

    if (hoursEl) wxBindHours(hoursEl, daysEl, today, tomorrow);
}

/**
 * 목록을 정해진 위치까지 부드럽게 내립니다.
 *  브라우저 기본 '부드럽게 스크롤'은 브라우저마다 동작이 달라(안 움직이는 경우도 있음)
 *  직접 움직입니다. 처음엔 빠르게, 끝에서 천천히 섭니다.
 */
function wxSmoothScrollTop(el, to, ms) {
    const from = el.scrollTop;
    const max = el.scrollHeight - el.clientHeight;
    const target = Math.max(0, Math.min(max, to));
    if (Math.abs(target - from) < 1) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.scrollTop = target; return; }
    const t0 = performance.now();
    (function step(now) {
        const k = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - k, 3);   // 끝에서 천천히
        el.scrollTop = from + (target - from) * e;
        if (k < 1) requestAnimationFrame(step);
    })(t0);
}

/** 시간별 머리줄에 들어갈 글자: '내일 · 10/29 (목)' */
function wxDayLabel(ymd, today, tomorrow) {
    const dt = ymdToDate(ymd);
    const nm = ymd === today ? '오늘' : (ymd === tomorrow ? '내일' : '모레');
    return nm + ' · ' + (dt.getMonth() + 1) + '/' + dt.getDate() + ' (' + WEEKDAY[dt.getDay()] + ')';
}

/**
 * 시간별 목록 ↔ 머리줄 ↔ 주간 카드를 한 몸으로 묶습니다.
 *  · 목록을 끌어서 날짜가 넘어가면 머리줄 글자가 바뀌고, 위쪽 주간 카드 선택도 따라갑니다.
 *  · 주간 카드를 누르면 목록이 그날로 넘어가고 머리줄은 '한 번만' 바뀝니다.
 *    (오늘→모레를 누르면 중간에 내일을 거쳐 가는데, 그때마다 바뀌면 깜빡거리므로)
 *  · 머리줄 글자는 앞으로 가면 위로 빠지고 아래에서 올라오며, 뒤로 가면 반대입니다.
 */
function wxBindHours(hoursEl, daysEl, today, tomorrow) {
    const headEl = document.getElementById('wx-hours-head');
    let shownDay = (hoursEl.querySelector('.wx-hrow') || {}).dataset ? hoursEl.querySelector('.wx-hrow').dataset.d : null;
    let lockUntil = 0;

    function markCard(day) {
        if (!daysEl) return;
        daysEl.querySelectorAll('.wx-day').forEach(function (b) { b.classList.toggle('wx-day-on', b.dataset.day === day); });
    }

    function swapHead(day) {
        if (!headEl || day === shownDay) return;
        const forward = !shownDay || day > shownDay;
        shownDay = day;
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

    // 지금 맨 위에 보이는 줄의 날짜
    function topDay() {
        const rows = hoursEl.querySelectorAll('.wx-hrow');
        const top = hoursEl.scrollTop + 4;
        let day = rows.length ? rows[0].dataset.d : null;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].offsetTop + rows[i].offsetHeight > top) { day = rows[i].dataset.d; break; }
        }
        return day;
    }

    let ticking = false;
    hoursEl.addEventListener('scroll', function () {
        // 끝까지 내리면 아래쪽 흐림을 걷어 냅니다 (더 없다는 뜻)
        hoursEl.classList.toggle('wx-at-end', hoursEl.scrollTop + hoursEl.clientHeight >= hoursEl.scrollHeight - 2);
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
            ticking = false;
            if (Date.now() < lockUntil) return;          // 카드를 눌러 넘어가는 중에는 가만히
            const d = topDay();
            if (d) { swapHead(d); markCard(d); }
        });
    }, { passive: true });

    if (daysEl) {
        daysEl.addEventListener('click', function (e) {
            const btn = e.target.closest('.wx-day');
            if (!btn || btn.disabled) return;
            const day = btn.dataset.day;
            const first = hoursEl.querySelector('.wx-hrow[data-d="' + day + '"]');
            if (!first) return;
            lockUntil = Date.now() + 500;
            markCard(day);
            swapHead(day);
            wxSmoothScrollTop(hoursEl, first.offsetTop, 350);
        });
    }
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
    return '<div class="rounded-2xl bg-white/10 py-2 md:py-3">' +
             '<div class="text-[11px] md:text-xs text-white/60">' + label + '</div>' +
             '<div class="text-sm md:text-lg font-bold tabular-nums mt-0.5">' + value + '</div>' +
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
