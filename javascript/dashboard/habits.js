/* ================================================================
   ANGAD.LOG — habits.js (V2: Edit Mode & Auto-Reset)
   ================================================================ */

let isHabitEditMode = false;
let habitState = JSON.parse(localStorage.getItem('angad_habits_v2'));

// Helper: Get the timestamp for the exact start of the current week (Monday at 00:00:00)
function getStartOfWeek() {
    let d = new Date();
    let day = d.getDay();
    let diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff)).setHours(0, 0, 0, 0);
}

// Initialize Data and Check for New Week
function initHabitData() {
    const currentWeek = getStartOfWeek();

    // If no data exists, create default setup
    if (!habitState) {
        habitState = {
            weekStart: currentWeek,
            habits: [
                { name: "Workout", history: [false, false, false, false, false, false, false] },
                { name: "Read 20 pgs", history: [false, false, false, false, false, false, false] },
                { name: "Code Outside Work", history: [false, false, false, false, false, false, false] }
            ]
        };
    } 
    // If it's a new week, reset the history arrays to false!
    else if (habitState.weekStart !== currentWeek) {
        habitState.weekStart = currentWeek;
        habitState.habits.forEach(habit => {
            habit.history = [false, false, false, false, false, false, false];
        });
    }
    
    saveHabits();
}

function saveHabits() {
    localStorage.setItem('angad_habits_v2', JSON.stringify(habitState));
}

function renderHabits() {
    const container = document.getElementById('habit-tracker-container');
    if (!container) return;

    if (isHabitEditMode) {
        // ─── EDIT MODE UI ───
        let html = `<div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">`;
        
        habitState.habits.forEach((habit, index) => {
            html += `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="text" value="${habit.name}" onchange="updateHabitName(${index}, this.value)" style="flex: 1; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 12px; color: var(--text); font-family: 'Share Tech Mono', monospace; outline: none;">
                    <button onclick="deleteHabit(${index})" style="background: none; border: none; color: var(--tc-life); cursor: pointer; font-size: 16px; opacity: 0.7;" title="Delete Habit">✕</button>
                </div>
            `;
        });
        
        html += `</div>
            <button onclick="addNewHabit()" style="width: 100%; background: rgba(124, 108, 212, 0.1); border: 1px dashed rgba(124, 108, 212, 0.4); color: var(--purple-bright); padding: 10px; border-radius: 8px; cursor: pointer; font-family: 'Qaaxee', monospace; font-size: 12px;">+ ADD NEW HABIT</button>
        `;
        container.innerHTML = html;
        
    } else {
        // ─── NORMAL TRACKING UI ───
        let html = `
            <div style="display: grid; grid-template-columns: 1fr repeat(7, 24px); gap: 12px; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="font-size: 11px; color: var(--text-faint); font-weight: bold;">HABIT</div>
                <div style="font-size: 11px; color: var(--text-faint); text-align: center;">M</div>
                <div style="font-size: 11px; color: var(--text-faint); text-align: center;">T</div>
                <div style="font-size: 11px; color: var(--text-faint); text-align: center;">W</div>
                <div style="font-size: 11px; color: var(--text-faint); text-align: center;">T</div>
                <div style="font-size: 11px; color: var(--text-faint); text-align: center;">F</div>
                <div style="font-size: 11px; color: var(--text-faint); text-align: center;">S</div>
                <div style="font-size: 11px; color: var(--text-faint); text-align: center;">S</div>
            </div>
        `;

        habitState.habits.forEach((habit, hIndex) => {
            let daysHtml = habit.history.map((isDone, dIndex) => {
                const checkColor = isDone ? 'var(--purple-bright)' : 'transparent';
                const checkBorder = isDone ? 'var(--purple-bright)' : 'rgba(255,255,255,0.2)';
                const icon = isDone ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>` : '';
                
                return `
                    <div onclick="toggleHabitDay(${hIndex}, ${dIndex})" style="width: 20px; height: 20px; border-radius: 5px; border: 2px solid ${checkBorder}; background: ${checkColor}; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                        ${icon}
                    </div>
                `;
            }).join('');

            html += `
                <div style="display: grid; grid-template-columns: 1fr repeat(7, 24px); gap: 12px; align-items: center; padding: 8px 0;">
                    <div style="color: var(--text); font-size: 13px; font-family: 'Qaaxee', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${habit.name}</div>
                    ${daysHtml}
                </div>
            `;
        });
        container.innerHTML = html;
    }
}

// ─── ACTIONS ───

window.toggleHabitEditMode = function() {
    isHabitEditMode = !isHabitEditMode;
    
    // Change button text based on state
    const btn = document.querySelector('button[onclick="toggleHabitEditMode()"]');
    if (btn) btn.innerText = isHabitEditMode ? "DONE" : "EDIT";
    
    renderHabits();
};

window.toggleHabitDay = function(habitIndex, dayIndex) {
    habitState.habits[habitIndex].history[dayIndex] = !habitState.habits[habitIndex].history[dayIndex];
    saveHabits();
    renderHabits();
};

window.updateHabitName = function(index, newName) {
    if (newName.trim() === '') return;
    habitState.habits[index].name = newName;
    saveHabits();
};

window.deleteHabit = function(index) {
    habitState.habits.splice(index, 1);
    saveHabits();
    renderHabits();
};

window.addNewHabit = function() {
    habitState.habits.push({ name: "New Habit", history: [false, false, false, false, false, false, false] });
    saveHabits();
    renderHabits();
};

// ─── BOOT ───
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initHabitData(); renderHabits(); });
} else {
    initHabitData();
    renderHabits();
}