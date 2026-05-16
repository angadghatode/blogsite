/* ================================================================
   ANGAD.LOG — dashboard.js
   Handles the private dashboard views, data, and interactivity
   ================================================================ */

// State Management
let allTodos = [];
let allNotes = [];
let allLinks = []; // NEW: Cached link state
let currentTaskFilter = 'today';
let currentDashTab = 'overview'; // NEW: Tracks current view for layout changes

function showDashboard() {
    document.body.classList.add('dashboard-mode'); 
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    
    document.getElementById('view-dashboard').classList.add('active');
    document.getElementById('tabDash').classList.add('active');
    
    fetchTodos();
    fetchNotes();
    fetchVault(); // CHANGED: Replaced renderVault()
    renderCalendar();
}

/* ── UI INTERACTIONS ────────────────────────────────────────── */

function switchDashTab(tabName) {
    currentDashTab = tabName; // Update state
    
    document.querySelectorAll('.dash-nav-item').forEach(btn => btn.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    const cards = document.querySelectorAll('.dash-card');
    const commandBar = document.querySelector('.dash-command');

    cards.forEach(card => {
        if (card === commandBar) return; 
        if (tabName === 'overview') {
            card.style.display = 'flex'; 
        } else {
            if (card.classList.contains(`dash-${tabName}`)) {
                card.style.display = 'flex';
                card.style.gridColumn = '1 / -1'; 
            } else {
                card.style.display = 'none';
            }
        }
    });

    if (tabName === 'overview') {
        document.querySelector('.dash-tasks').style.gridColumn = 'span 1';
        document.querySelector('.dash-links').style.gridColumn = 'span 1';
        document.querySelector('.dash-calendar').style.gridColumn = '3';
        document.querySelector('.dash-calendar').style.gridRow = '1 / span 2';
        document.querySelector('.dash-notes').style.gridColumn = 'span 1';
        document.querySelector('.dash-secure-vault').style.gridColumn = 'span 1';
    }
    
    // Dynamically rebuild the links layout based on the new tab
    renderVault(); 
}

function setTaskFilter(filterType, element) {
    document.querySelectorAll('.task-filter-tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    currentTaskFilter = filterType.toLowerCase().trim();
    renderTodos();
}

/* ── DATA FETCHING & RENDERING ──────────────────────────────── */

// TODOS
async function fetchTodos() {
  if (typeof sb === 'undefined') return;
  const { data, error } = await sb.from('todos').select('*').order('created_at', { ascending: false });
  if (error) return console.error(error);
  
  allTodos = data.filter(t => {
      const isDone = (t.is_done === true || t.is_done === 'true');
      if (isDone) {
          const doneMatch = t.task.match(/!done_(\S+)/);
          if (doneMatch) {
              const doneDate = new Date(doneMatch[1]);
              const diffHours = (new Date() - doneDate) / (1000 * 60 * 60);
              if (diffHours > 48) {
                  sb.from('todos').delete().eq('id', t.id).then(); 
                  return false;
              }
          }
      }
      return true;
  });
  renderTodos();
}

function renderTodos() {
  const list = document.getElementById('todo-list');
  if (!list) return;

  const now = new Date();
  now.setHours(0,0,0,0);
  
  let filter = currentTaskFilter;
  if (filter === 'done') filter = 'completed'; 

  let filtered = allTodos.filter(t => {
      const isDone = (t.is_done === true || t.is_done === 'true');

      let dateMatch = t.task.match(/@(\d{4}-\d{2}-\d{2})/);
      let taskDate = null;
      
      if (dateMatch) {
          let [y, m, d] = dateMatch[1].split('-');
          taskDate = new Date(y, m - 1, d);
          taskDate.setHours(0,0,0,0);
      }

      let isTodayOrOverdue = false;
      let isUpcoming = true;

      if (taskDate) {
          let diffTime = taskDate.getTime() - now.getTime();
          let diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
          
          if (diffDays <= 0) { 
              isTodayOrOverdue = true; 
              isUpcoming = false; 
          } else {
              isTodayOrOverdue = false;
              isUpcoming = true;
          }
      }

      if (filter === 'all') return true; 
      if (filter === 'today') return !isDone && isTodayOrOverdue;
      if (filter === 'upcoming') return !isDone && isUpcoming;
      if (filter === 'completed') return isDone;
      return false; 
  });

  list.innerHTML = filtered.map(t => {
      const isDone = (t.is_done === true || t.is_done === 'true');
      let taskText = t.task.replace(/!done_\S+/, ''); 
      
      let tagMatch = taskText.match(/#(\w+)/);
      let dateMatch = taskText.match(/@(\d{4}-\d{2}-\d{2})/);
      
      let tag = tagMatch ? tagMatch[1] : null;
      let absoluteDate = dateMatch ? dateMatch[1] : null;
      
      let cleanTask = taskText.replace(/#\w+/g, '').replace(/@[\w-]+/g, '').trim();

      let tagHtml = tag ? `<span class="tag-chip">${tag}</span>` : '';
      let dateHtml = '';

      if (absoluteDate) {
          let [y, m, d] = absoluteDate.split('-');
          let tDate = new Date(y, m - 1, d);
          tDate.setHours(0,0,0,0);
          
          let diffDays = Math.round((tDate - now) / (1000 * 60 * 60 * 24));
          let label = "";
          let colorStyle = "";
          
          if (diffDays === 0) { label = "Today"; }
          else if (diffDays === 1) { label = "Tomorrow"; }
          else if (diffDays < 0) { 
              label = "Overdue"; 
              colorStyle = "color: var(--tc-life); border-color: var(--tc-life); background: rgba(232,125,125,0.1);"; 
          }
          else { label = tDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}); }
          
          dateHtml = `<span class="date-chip" style="${colorStyle}">${label}</span>`;
      }

      return `
        <li class="list-item">
          <input type="checkbox" class="custom-checkbox" ${isDone ? 'checked' : ''} onchange="toggleTodo(${t.id}, this.checked)">
          
          <span class="item-title" style="${isDone ? 'text-decoration:line-through; opacity:0.5' : ''}; cursor: pointer;" onclick="editTodo(${t.id})" title="Click to edit">${cleanTask}</span>
          
          ${tagHtml}
          
          <div class="item-meta right">
            ${dateHtml}
            <button onclick="deleteTodo(${t.id})" style="background:none; border:none; color:var(--tc-life); cursor:pointer; font-size:16px; margin-left:12px; opacity:0.7; transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">✕</button>
          </div>
        </li>
      `;
  }).join('');
  
  const countEl = document.getElementById('todo-count');
  const doneCount = allTodos.filter(t => (t.is_done === true || t.is_done === 'true')).length;
  if (countEl) countEl.innerText = `Completed ${doneCount} tasks`;

  renderCalendar();
}

// NOTES
async function fetchNotes() {
  if (typeof sb === 'undefined') return;
  const { data, error } = await sb.from('notes').select('*').order('created_at', { ascending: false });
  if (error) return console.error(error);
  
  allNotes = data; 
  const list = document.getElementById('notes-list');
  if (list) {
    list.innerHTML = data.map(n => {
      let lines = n.content.split('\n');
      let title = lines[0].length > 35 ? lines[0].substring(0, 35) + '...' : lines[0];
      let excerpt = (lines[1] || lines[0]).substring(0, 60) + '...';
      
      return `
      <div class="note-item" onclick="openFullNote(${n.id})">
        <svg class="note-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        <div class="note-text-block">
          <span class="note-title">${title}</span>
          <span class="note-excerpt">${excerpt}</span>
        </div>
        
        <div class="item-meta right">
          <span>${relativeDate(n.created_at)}</span>
          <button onclick="event.stopPropagation(); deleteNote(${n.id})" style="background:none; border:none; color:var(--tc-life); cursor:pointer; font-size:14px; margin-left: 12px; opacity: 0.7; transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">✕</button>
        </div>
      </div>
    `}).join('');
  }
}

function openFullNote(id) {
    const note = allNotes.find(n => n.id === id);
    if (!note) return;
    let lines = note.content.split('\n');
    document.getElementById('fullNoteTitle').innerText = lines[0];
    document.getElementById('fullNoteDate').innerText = fmtDate(note.created_at);
    document.getElementById('fullNoteContent').innerText = note.content;
    document.getElementById('noteReaderOverlay').classList.add('open');
}

function closeFullNote() {
    document.getElementById('noteReaderOverlay').classList.remove('open');
}

// VAULT (LINKS)
async function fetchVault() {
  if (typeof sb === 'undefined') return;
  const { data, error } = await sb.from('vault').select('*').order('created_at', { ascending: false });
  if (error) return console.error(error);
  
  // Cache the Microlink metadata so tab switching is instant
  allLinks = await Promise.all(data.map(async (item) => {
      try {
          const metaRes = await fetch(`https://api.microlink.io?url=${encodeURIComponent(item.url)}`);
          const metaJson = await metaRes.json();
          item.meta = metaJson.data;
      } catch (e) {
          item.meta = null;
      }
      return item;
  }));
  
  renderVault();
}

function renderVault() {
  const vaultEl = document.getElementById('vault-list');
  if (!vaultEl) return;

  // Reusable HTML generator for a single link item
  const buildLinkHtml = (item) => {
      let title = item.meta?.title || item.url.split('/')[2] || 'Link';
      let cleanUrl = item.url.replace(/^https?:\/\//, '').substring(0, 35) + '...';
      let initial = title.charAt(0).toUpperCase();
      let category = item.category || 'General';
      
      let colors = ['#2563eb', '#7c6cd4', '#4dd4a0', '#e8c67d'];
      let bgColor = colors[title.length % colors.length];

      let logoHtml = item.meta?.logo?.url 
        ? `<img src="${item.meta.logo.url}" class="link-icon" style="object-fit: contain; background: white;">` 
        : `<div class="link-icon" style="background: ${bgColor}; color: white;">${initial}</div>`;

      // NOTE: event.preventDefault() stops the link from opening when clicking the X
      return `
        <a href="${item.url}" target="_blank" class="link-item">
          ${logoHtml}
          <div class="link-text">
            <span class="link-title">${title}</span>
            <span class="link-url">${cleanUrl}</span>
          </div>
          <span class="tag-chip right">${category}</span>
          <button class="delete-link-btn" onclick="event.preventDefault(); event.stopPropagation(); deleteLink(${item.id})" style="background:none; border:none; color:var(--tc-life); cursor:pointer; font-size:16px; margin-left:12px;">✕</button>
        </a>
      `;
  };

  if (currentDashTab === 'overview') {
      // 1. OVERVIEW MODE: Render only the Top 5 most recent links as a simple list
      const top5 = allLinks.slice(0, 5);
      vaultEl.style.display = "flex"; // Revert to standard flex list
      vaultEl.innerHTML = top5.map(buildLinkHtml).join('');
      
  } else {
      // 2. EXPANDED TAB MODE: Render the full categorized breakdown
      vaultEl.style.display = "block"; // Required to stack categories properly

      // Group links into categories using a reducer
      let groupedLinks = allLinks.reduce((acc, item) => {
          let cat = (item.category || 'General').toLowerCase();
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(item);
          return acc;
      }, {});

      let html = '';
      for (let cat in groupedLinks) {
          html += `
              <div class="vault-category">
                  <h3 class="category-title">${cat}</h3>
                  <div class="category-grid">
                      ${groupedLinks[cat].map(buildLinkHtml).join('')}
                  </div>
              </div>
          `;
      }
      vaultEl.innerHTML = html;
  }
}

/* ── DYNAMIC CALENDAR & EVENT ENGINE ────────────────────────── */
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

    // 1. EXTRACT ALL ACTIVE DATED TASKS
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
    
    // Trailing days
    for (let i = startOffset - 1; i >= 0; i--) {
        daysHtml += `<div class="cal-day fade">${prevMonthDays - i}</div>`;
    }
    
    // Current month days (Now Clickable!)
    for (let i = 1; i <= daysInMonth; i++) {
        const isActive = (isCurrentMonth && i === todayDate) ? 'active' : '';
        const dayStr = `${year}-${String(currentCalDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        // Check if this specific day is the one the user clicked
        const isSelected = (dayStr === selectedCalDate) ? 'selected' : '';
        
        const hasTask = activeDatedTasks.some(t => t.parsedDate === dayStr);
        const hasEvent = hasTask ? '<div class="cal-dot"></div>' : '';
        
        // Added onclick="selectCalDate('YYYY-MM-DD')"
        daysHtml += `<div class="cal-day ${isActive} ${isSelected}" onclick="selectCalDate('${dayStr}')">${i}${hasEvent}</div>`;
    }

    // 2. BUILD THE AGENDA LIST FOR THE SELECTED DAY
    let agendaHtml = '';
    
    // Create a readable title for the selected day (e.g. "Monday, May 18")
    let [sy, sm, sd] = selectedCalDate.split('-');
    let sDateObj = new Date(sy, sm - 1, sd);
    let agendaTitle = sDateObj.toLocaleDateString('en-US', {weekday: 'long', month: 'short', day: 'numeric'});

    // Filter tasks strictly to the selected day
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

    // 3. INJECT THE FINAL HTML
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

window.changeMonth = function(offset) {
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    renderCalendar();
}

// THE NEW INTERACTIVE CLICK LISTENER
window.selectCalDate = function(dateStr) {
    selectedCalDate = dateStr;
    renderCalendar();
}

window.changeMonth = function(offset) {
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    renderCalendar();
}

/* ── HELPER: NLP DATE PARSER ── */
function convertRelativeDateTag(taskStr) {
    let tagMatch = taskStr.match(/@(\w+)/);
    if (!tagMatch) return taskStr;

    let keyword = tagMatch[1].toLowerCase();
    let targetDate = new Date();

    if (['today', 'tod'].includes(keyword)) {
    } else if (['tomorrow', 'tmrw', 'tom'].includes(keyword)) {
        targetDate.setDate(targetDate.getDate() + 1);
    } else {
        const days = ['sun','mon','tue','wed','thu','fri','sat'];
        const dayIndex = days.findIndex(d => keyword.startsWith(d));
        if (dayIndex !== -1) {
            let currentDay = targetDate.getDay();
            let diff = dayIndex - currentDay;
            if (diff <= 0) diff += 7; 
            targetDate.setDate(targetDate.getDate() + diff);
        } else if (keyword.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return taskStr; 
        } else {
            return taskStr; 
        }
    }
    
    let y = targetDate.getFullYear();
    let m = String(targetDate.getMonth() + 1).padStart(2, '0');
    let d = String(targetDate.getDate()).padStart(2, '0');
    let localDateStr = `${y}-${m}-${d}`;
    
    return taskStr.replace(`@${tagMatch[1]}`, `@${localDateStr}`);
}

function customPrompt(title, defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('inputOverlay');
        const titleEl = document.getElementById('inputModalTitle');
        const inputEl = document.getElementById('inputModalField');
        const submitBtn = document.getElementById('inputModalSubmit');
        const cancelBtn = document.getElementById('inputModalCancel');

        // Set the text and open the modal
        titleEl.innerText = title;
        inputEl.value = defaultValue;
        overlay.style.display = 'flex';
        
        // Slight delay to allow CSS transitions to fire, then focus the input
        setTimeout(() => overlay.classList.add('active'), 10);
        setTimeout(() => inputEl.focus(), 100);

        // Helper to close and clean up event listeners
        const cleanup = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.style.display = 'none', 200); 
            submitBtn.onclick = null;
            cancelBtn.onclick = null;
            inputEl.onkeydown = null;
        };

        // Resolve the promise based on user action
        submitBtn.onclick = () => { cleanup(); resolve(inputEl.value); };
        cancelBtn.onclick = () => { cleanup(); resolve(null); };
        
        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') { cleanup(); resolve(inputEl.value); }
            if (e.key === 'Escape') { cleanup(); resolve(null); }
        };
    });
}

/* ── MUTATIONS ── */

async function editTodo(id) {
    let taskObj = allTodos.find(x => x.id === id);
    if (!taskObj) return;

    // Strip out the hidden completion timestamp
    let rawTask = taskObj.task.replace(/ !done_\S+/, '');

    // THE FIX: Use our sleek custom async prompt instead of window.prompt!
    let updatedTask = await customPrompt("edit_task", rawTask);
    
    // If they clicked cancel or left it blank, abort
    if (updatedTask === null || updatedTask.trim() === "") return;

    // Run the text through the NLP date parser
    let finalTask = convertRelativeDateTag(updatedTask.trim());

    // Re-attach the hidden completion timestamp if it was already checked
    if (taskObj.is_done) {
        let doneMatch = taskObj.task.match(/!done_\S+/);
        if (doneMatch) finalTask += ` ${doneMatch[0]}`;
    }

    // Optimistic UI Update
    taskObj.task = finalTask;
    renderTodos(); 

    // Sync to DB
    await sb.from('todos').update({ task: finalTask }).eq('id', id); 
    fetchTodos(); 
}

async function toggleTodo(id, is_done) { 
    let taskObj = allTodos.find(x => x.id === id);
    if (!taskObj) return;
    
    let newTaskText = taskObj.task.replace(/ !done_\S+/, ''); 
    if (is_done) {
        let isoNow = new Date().toISOString();
        newTaskText += ` !done_${isoNow}`;
    }
    
    taskObj.is_done = is_done;
    taskObj.task = newTaskText;
    renderTodos(); 
    
    await sb.from('todos').update({ is_done: is_done, task: newTaskText }).eq('id', id); 
    fetchTodos(); 
}

async function deleteTodo(id) { await sb.from('todos').delete().eq('id', id); fetchTodos(); }
async function deleteNote(id) { await sb.from('notes').delete().eq('id', id); fetchNotes(); }
async function deleteLink(id) { 
    // Optimistic UI update
    allLinks = allLinks.filter(l => l.id !== id);
    renderVault(); 
    
    // Background sync
    await sb.from('vault').delete().eq('id', id); 
    fetchVault(); 
    toast('Link deleted.');
}

/* ── COMMAND LISTENER & WIDGETS ── */
window.addEventListener('DOMContentLoaded', () => {
    initStars();
    setInterval(updateSpotify, 30000);
    setInterval(updateUptime, 1000);
    updateSpotify();
    updateUptime();
    
    if (document.getElementById('view-dashboard')?.classList.contains('active')) {
        showDashboard();
    }

    const cmdInput = document.getElementById('commandInput');
    if (cmdInput) {
        cmdInput.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            let val = e.target.value.trim();
            if (!val) return;
            
            if (typeof authenticated !== 'undefined' && !authenticated) {
              toast('Access denied. Unlock terminal.', true);
              return;
            }

            try {
              if (val.startsWith('/todo ')) {
                const rawTask = val.replace('/todo ', '');
                const finalTask = convertRelativeDateTag(rawTask);
                
                const { error } = await sb.from('todos').insert([{ task: finalTask, is_done: false }]);
                if (error) throw error;
                fetchTodos();
                toast('Task added.');
              } 
              else if (val.startsWith('/link ')) {
                let text = val.replace('/link ', '').trim();
                let parts = text.split('#');
                let url = parts[0].trim();
                let cat = parts.length > 1 ? parts[1].trim() : 'general';

                if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
                
                const { error } = await sb.from('vault').insert([{ url: url, category: cat, is_media: false }]);
                if (error) throw error;
                fetchVault(); // Re-fetch to get microlink metadata
                toast('Link saved.');
              }
              else if (val.startsWith('/note ')) {
                const content = val.replace('/note ', '');
                const { error } = await sb.from('notes').insert([{ content: content, category: 'text' }]);
                if (error) throw error; 
                fetchNotes(); 
                toast('Note logged.'); 
              }
              e.target.value = ''; 
            } catch (err) { toast('Error: ' + err.message, true); }
          }
        });
    }
});

function initStars() {
  const sf = document.getElementById('starfield');
  if(!sf) return;
  sf.innerHTML = '';
  for (let i = 0; i < 90; i++) {
    const el = document.createElement('div');
    const size = Math.random() < 0.85 ? 4 : 1;
    const op   = (Math.random() * 0.5 + 0.15).toFixed(2);
    const dur  = (2 + Math.random() * 4).toFixed(1);
    const del  = (Math.random() * 5).toFixed(1);
    el.className = 'star';
    el.style.cssText = `width:${size}px; height:${size}px; left:${(Math.random()*100).toFixed(2)}%; top:${(Math.random()*100).toFixed(2)}%; --op:${op}; opacity:${op}; animation:twinkle ${dur}s ease-in-out ${del}s infinite alternate`;
    sf.appendChild(el);
  }
}

const LASTFM_USER = "angadghatode"; 
const LASTFM_API_KEY = "0dc0c17d61c50cafe7501409b028c517";

async function updateSpotify() {
  try {
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USER}&api_key=${LASTFM_API_KEY}&format=json&limit=1`);
    const data = await response.json();
    const track = data.recenttracks.track[0];
    if (track) {
      document.getElementById('song-title').innerText = track.name;
      document.getElementById('song-artist').innerText = track.artist['#text'];
      document.getElementById('album-art').src = track.image[2]['#text'] || 'https://placehold.co/150x150/1c1a2e/7c6cd4?text=Audio';
      const isPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';
      const bars = document.getElementById('music-bars');
      if(bars) isPlaying ? bars.classList.add('active') : bars.classList.remove('active');
    }
  } catch (error) {}
}

function updateUptime() {
  const start = new Date("2004-09-30T00:00:00"); 
  const diff = new Date() - start;
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const uptimeEl = document.getElementById('uptime-val');
  if (uptimeEl) { uptimeEl.innerText = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`; }
}