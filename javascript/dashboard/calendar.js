let currentCalDate = new Date(); 

let selectedCalDate = (() => {
    let t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
})();

function renderCalendar() {
    const calEl = document.getElementById('mini-calendar');
    if (!calEl) return;

    const month = currentCalDate.toLocaleString('default', { month: 'short' });
    const year = currentCalDate.getFullYear();
    
    const realToday = new Date();
    const isCurrentMonth = realToday.getMonth() === currentCalDate.getMonth() && 
                           realToday.getFullYear() === currentCalDate.getFullYear();
    const todayDate = realToday.getDate();
    
    const daysInMonth = new Date(year, currentCalDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(year, currentCalDate.getMonth(), 1).getDay();
    const startOffset = (firstDay === 0 ? 6 : firstDay - 1); 

    const activeDatedTasks = allTodos.filter(t => {
         const isDone = (t.is_done === true || t.is_done === 'true');
         if(isDone) return false; 
         let dateMatch = t.task.match(/@(\d{4}-\d{2}-\d{2})/);
         if(!dateMatch) return false; 
         t.parsedDate = dateMatch[1];
         return true;
    });

    let daysHtml = '';
    const prevMonthDays = new Date(year, currentCalDate.getMonth(), 0).getDate();
    
    for (let i = startOffset - 1; i >= 0; i--) {
        daysHtml += `<div class="cal-day fade">${prevMonthDays - i}</div>`;
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
        const isActive = (isCurrentMonth && i === todayDate) ? 'active' : '';
        const dayStr = `${year}-${String(currentCalDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const isSelected = (dayStr === selectedCalDate) ? 'selected' : '';
        const hasTask = activeDatedTasks.some(t => t.parsedDate === dayStr);
        const hasEvent = hasTask ? '<div class="cal-dot"></div>' : '';
        
        daysHtml += `<div class="cal-day ${isActive} ${isSelected}" onclick="selectCalDate('${dayStr}')">${i}${hasEvent}</div>`;
    }

    let agendaHtml = '';
    let [sy, sm, sd] = selectedCalDate.split('-');
    let sDateObj = new Date(sy, sm - 1, sd);
    let agendaTitle = sDateObj.toLocaleDateString('en-US', {weekday: 'long', month: 'short', day: 'numeric'});

    const dayTasks = activeDatedTasks.filter(t => t.parsedDate === selectedCalDate);

    if (dayTasks.length > 0) {
        agendaHtml = dayTasks.map(t => {
            let cleanTask = t.task.replace(/#\w+/g, '').replace(/@[\w-]+/g, '').replace(/!done_\S+/, '').trim();
            return `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-dim); margin-bottom: 12px; font-family: 'Share Tech Mono', monospace;">
                <span style="display: flex; align-items: center; gap: 10px;">
                    <span style="width: 6px; height: 6px; background: var(--purple-bright); border-radius: 50%; display: inline-block; flex-shrink: 0;"></span>
                    <span style="color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">${cleanTask}</span>
                </span>
            </div>
            `;
        }).join('');
    } else {
        agendaHtml = `<div style="color: var(--text-faint); font-size: 12px; text-align: center; font-style: italic; margin-top: 10px;">No events for this date</div>`;
    }

    calEl.innerHTML = `
      <div class="cal-header">
        <span style="cursor:pointer; color: var(--text-dim); padding: 0 10px;" onclick="changeMonth(-1)">&lt;</span>
        <span class="cal-month" style="font-size: 16px; font-weight: bold; color: var(--text);">${month} ${year}</span>
        <span style="cursor:pointer; color: var(--text-dim); padding: 0 10px;" onclick="changeMonth(1)">&gt;</span>
      </div>
      <div class="cal-grid" style="border-bottom: 1px solid var(--border-mid); padding-bottom: 1.5rem; margin-bottom: 0;">
        <div class="cal-day-head">MON</div><div class="cal-day-head">TUE</div><div class="cal-day-head">WED</div><div class="cal-day-head">THU</div><div class="cal-day-head">FRI</div><div class="cal-day-head">SAT</div><div class="cal-day-head">SUN</div>
        ${daysHtml}
      </div>
      <div class="cal-events" id="calendar-events-container" style="border-top: none; padding-top: 1rem; margin-top: 0; display: flex; flex-direction: column;">
         <div style="font-size: 11px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px dashed var(--border-mid); padding-bottom: 6px;">${agendaTitle}</div>
         ${agendaHtml}
      </div>
    `;
}

function changeMonth(offset) {
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    renderCalendar();
}

function selectCalDate(dateStr) {
    selectedCalDate = dateStr;
    renderCalendar();
}