// [디자인 수정] 사장님 지시사항 100% 반영
// 1. 볼드 제거, 중앙 정렬
// 2. 초록점/초록배경 삭제
// 3. 높이 줄임 (h-14), 간격 최소화
function renderCalendar() {
    const container = document.getElementById('calendar-days');
    if (!container) return;
    container.innerHTML = '';

    document.getElementById('current-month-display').textContent = `${currentYear}년 ${currentMonth}월`;
    
    // 요일 빈칸
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = 0; i < firstDay; i++) container.innerHTML += '<div></div>';

    // 날짜 루프
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isSunday = new Date(currentYear, currentMonth - 1, day).getDay() === 0;
        
        const hasReport = reportsMap[dateKey];
        const config = holidayConfig[dateKey] || {};
        const label = config.label || "";
        const colorType = config.color || (isSunday ? 'red' : 'black');

        // [스타일]
        // font-normal (볼드 뺌)
        // text-center (중앙 정렬)
        // items-center justify-center (박스 내 중앙 정렬)
        let numStyle = "font-size: 14px;"; 
        if (colorType === 'red') numStyle += " color: #ef4444;"; // 빨강
        else if (colorType === 'blue') numStyle += " color: #3b82f6;"; // 파랑
        else numStyle += " color: #374151;"; // 기본 회색

        // [띠지 로직] (기능은 유지하되 디자인 방해 안 하게)
        let barHtml = "";
        if (label) {
            let prevCount=0, nextCount=0;
            for(let p=day-1; p>=1; p--) {
                if(holidayConfig[`${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(p).padStart(2,'0')}`]?.label === label) prevCount++; else break;
            }
            for(let n=day+1; n<=daysInMonth; n++) {
                if(holidayConfig[`${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(n).padStart(2,'0')}`]?.label === label) nextCount++; else break;
            }
            const totalLen = prevCount + 1 + nextCount;
            const isCenter = (prevCount === Math.floor((totalLen - 1) / 2));
            const isPrevSame = prevCount > 0;
            const isNextSame = nextCount > 0;

            let bgClass = colorType === 'red' ? 'bg-red-100 text-red-600' : (colorType === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600');
            let radiusClass = "";
            if (!isPrevSame && isNextSame) radiusClass = "rounded-l";
            else if (isPrevSame && !isNextSame) radiusClass = "rounded-r";
            else if (!isPrevSame && !isNextSame) radiusClass = "rounded";

            // 띠지: 숫자 바로 밑에 위치
            barHtml = `<div class="absolute bottom-1 left-0 right-0 h-3 flex items-center justify-center overflow-visible ${bgClass} ${radiusClass}">
                <span class="${isCenter ? 'opacity-100' : 'opacity-0'} text-[9px]" style="white-space:nowrap;">${label}</span>
            </div>`;
        }

        // [편집모드 선택 효과] (테두리만)
        let selectionClass = "";
        if (isEditMode && selectedDates.includes(dateKey)) {
            selectionClass = "ring-1 ring-green-500 bg-green-50"; 
        }

        // [최종 HTML]
        // h-14: 높이 줄임 (간격 축소)
        // flex-col items-center: 내용물 중앙 정렬
        // 초록점(reportMarker) 아예 제거함
        container.innerHTML += `
            <div class="h-14 relative border border-transparent hover:border-gray-200 cursor-pointer flex flex-col items-center justify-start pt-1 ${selectionClass}"
                 ontouchstart="handleTouchStart('${dateKey}', ${day}, ${isSunday})"
                 ontouchend="handleTouchEnd()"
                 onmousedown="handleMouseDown('${dateKey}', ${day}, ${isSunday})"
                 onmouseup="handleMouseUp()"
                 onclick="handleClick('${dateKey}', ${day}, ${isSunday})">
                
                <span style="${numStyle}">${day}</span>

                ${barHtml}
            </div>
        `;
    }
}
