/* ================================================================
   ANGAD.LOG — dashboard.js
   Handles the private dashboard views, data, and interactivity
   ================================================================ */

// State Management
let allTodos = [];
let currentTaskFilter = 'all';

function showDashboard() {
    document.body.classList.add('dashboard-mode'); 
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    
    document.getElementById('view-dashboard').classList.add('active');
    document.getElementById('tabDash').classList.add('active');
    
    fetchTodos();
    fetchNotes();
    renderVault();
    renderCalendar();
}

/* ── UI INTERACTIONS ────────────────────────────────────────── */

// 1. Sidebar Tab Switching
function switchDashTab(tabName) {
    document.querySelectorAll('.dash-nav-item').forEach(btn => btn.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    const cards = document.querySelectorAll('.dash-card');
    cards.forEach(card => {
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
}

// 2. Action Buttons (Replaces Command Bar)
async function openAddTodo() {
    if (!authenticated) { toast('Access denied. Unlock terminal.', true); return; }
    const task = prompt("Enter new task:");
    if (!task) return;
    
    const { error } = await sb.from('todos').insert([{ task, is_done: false }]);
    if (error) { toast(`Error: ${error.message}`, true); return; }
    
    fetchTodos();
    toast('Task added.');
}

async function openAddNote() {
    if (!authenticated) { toast('Access denied. Unlock terminal.', true); return; }
    const content = prompt("Enter new note:");
    if (!content) return;

    const { error } = await sb.from('notes').insert([{ content: content, category: 'text' }]);
    if (error) { toast(`Error: ${error.message}`, true); return; }
    
    fetchNotes();
    toast('Note logged.');
}

async function addLink() {
    if (!authenticated) { toast('Access denied. Unlock terminal.', true); return; }
    let url = prompt("Paste Link URL:");
    if (!url) return;
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    const category = prompt("Category? (blog, docs, tools, general)", "general");
    
    const { error } = await sb.from('vault').insert([{ url: url, category: category, is_media: false }]);
    if (error) { toast(`Error: ${error.message}`, true); return; }
    
    renderVault();
    toast('Link saved to vault.');
}

// 3. Task Filtering
function setTaskFilter(filterType, element) {
    document.querySelectorAll('.task-filter-tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    currentTaskFilter = filterType;
    renderTodos();
}


/* ── DATA FETCHING & RENDERING ──────────────────────────────── */

// TODOS
async function fetchTodos() {
  if (typeof sb === 'undefined') return;
  const { data, error } = await sb.from('todos').select('*').order('created_at', { ascending: false });
  if (error) return console.error(error);
  
  allTodos = data;
  renderTodos();
}

function renderTodos() {
  const list = document.getElementById('todo-list');
  if (!list) return;

  let filtered = allTodos;
  const now = new Date();
  
  if (currentTaskFilter === 'completed') {
      filtered = allTodos.filter(t => t.is_done);
  } else if (currentTaskFilter === 'today') {
      filtered = allTodos.filter(t => !t.is_done && (now - new Date(t.created_at)) < 86400000); 
  } else if (currentTaskFilter === 'upcoming') {
      filtered = allTodos.filter(t => !t.is_done && (now - new Date(t.created_at)) >= 86400000); 
  }

  list.innerHTML = filtered.map(t => {
      // 1. Natural Language Parser for Tags (#) and Dates (@)
      let taskText = t.task;
      let tagMatch = taskText.match(/#(\w+)/);
      let dateMatch = taskText.match(/@(\w+)/);
      
      let tag = tagMatch ? tagMatch[1] : null;
      let date = dateMatch ? dateMatch[1] : null;
      
      // Clean the text for display
      let cleanTask = taskText.replace(/#\w+/g, '').replace(/@\w+/g, '').trim();

      // 2. Build the HTML chips
      let tagHtml = tag ? `<span class="tag-chip">${tag}</span>` : '';
      let dateHtml = date ? `<span class="date-chip">${date}</span>` : '';

      return `
        <li class="list-item">
          <input type="checkbox" class="custom-checkbox" ${t.is_done ? 'checked' : ''} onchange="toggleTodo(${t.id}, this.checked)">
          <span class="item-title" style="${t.is_done ? 'text-decoration:line-through; opacity:0.5' : ''}">${cleanTask}</span>
          ${tagHtml}
          
          <div class="item-meta right">
            ${dateHtml}
            <span>${relativeDate(t.created_at)}</span>
            <button onclick="deleteTodo(${t.id})" style="background:none; border:none; color:var(--tc-life); cursor:pointer; font-size:16px; margin-left:12px; opacity:0.7; transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">✕</button>
          </div>
        </li>
      `;
  }).join('');
  
  const countEl = document.getElementById('todo-count');
  const doneCount = allTodos.filter(t => t.is_done).length;
  if (countEl) countEl.innerText = `Completed ${doneCount} tasks`;
}

// NOTES
let allNotes = []; // Added state array

async function fetchNotes() {
  if (typeof sb === 'undefined') return;
  const { data, error } = await sb.from('notes').select('*').order('created_at', { ascending: false });
  if (error) return console.error(error);
  
  allNotes = data; // Save to state for the reader
  const list = document.getElementById('notes-list');
  if (list) {
    list.innerHTML = data.map(n => {
      // Create a smart title from the first sentence
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

// VAULT
async function renderVault() {
  if (typeof sb === 'undefined') return;
  const vaultEl = document.getElementById('vault-list');
  if (!vaultEl) return;
  
  const { data, error } = await sb.from('vault').select('*').order('created_at', { ascending: false });
  if (error) return;
  
  vaultEl.innerHTML = await Promise.all(data.map(async (item) => {
    try {
      const meta = await fetch(`https://api.microlink.io?url=${encodeURIComponent(item.url)}`).then(r => r.json());
      
      let title = meta.data.title || item.url.split('/')[2] || 'Link';
      let cleanUrl = item.url.replace(/^https?:\/\//, '').substring(0, 35) + '...';
      let initial = title.charAt(0).toUpperCase();
      
      let colors = ['#2563eb', '#7c6cd4', '#4dd4a0', '#e8c67d'];
      let bgColor = colors[title.length % colors.length];

      let logoHtml = meta.data.logo?.url 
        ? `<img src="${meta.data.logo.url}" class="link-icon" style="object-fit: contain; background: white;">` 
        : `<div class="link-icon" style="background: ${bgColor}; color: white;">${initial}</div>`;

      return `
        <a href="${item.url}" target="_blank" class="link-item">
          ${logoHtml}
          <div class="link-text">
            <span class="link-title">${title}</span>
            <span class="link-url">${cleanUrl}</span>
          </div>
          <span class="tag-chip right">${item.category || 'web'}</span>
        </a>
      `;
    } catch {
      let title = item.url.split('/')[2] || 'Link';
      return `
        <a href="${item.url}" target="_blank" class="link-item">
          <div class="link-icon" style="background: var(--purple-dim); color: white;">🔗</div>
          <div class="link-text">
            <span class="link-title">${title}</span>
            <span class="link-url">${item.url.substring(0, 30)}...</span>
          </div>
          <span class="tag-chip right">${item.category || 'link'}</span>
        </a>
      `;
    }
  })).then(res => res.join(''));
}


let currentCalDate = new Date(); // Tracks which month we are viewing

function renderCalendar() {
    const calEl = document.getElementById('mini-calendar');
    if (!calEl) return;

    const month = currentCalDate.toLocaleString('default', { month: 'short' });
    const year = currentCalDate.getFullYear();
    
    // Track actual today to highlight the current day
    const realToday = new Date();
    const isCurrentMonth = realToday.getMonth() === currentCalDate.getMonth() && 
                           realToday.getFullYear() === currentCalDate.getFullYear();
    const todayDate = realToday.getDate();
    
    // Calculate days for the grid
    const daysInMonth = new Date(year, currentCalDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(year, currentCalDate.getMonth(), 1).getDay();
    const startOffset = (firstDay === 0 ? 6 : firstDay - 1); // Make Monday the first day

    let daysHtml = '';
    const prevMonthDays = new Date(year, currentCalDate.getMonth(), 0).getDate();
    
    // Fill previous month's trailing days
    for (let i = startOffset - 1; i >= 0; i--) {
        daysHtml += `<div class="cal-day fade">${prevMonthDays - i}</div>`;
    }
    
    // Fill current month's days
    for (let i = 1; i <= daysInMonth; i++) {
        const isActive = (isCurrentMonth && i === todayDate) ? 'active' : '';
        
        // Dummy event dots (You will replace this logic when Apple Sync is live)
        const hasEvent = (isCurrentMonth && (i === todayDate || i === todayDate + 2)) ? '<div class="cal-dot"></div>' : '';
        
        daysHtml += `<div class="cal-day ${isActive}">${i}${hasEvent}</div>`;
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
      
      <div class="cal-events" id="calendar-events-container" style="border-top: none; padding-top: 1.5rem; margin-top: 0;">
         <div style="color: var(--text-faint); font-size: 12px; text-align: center; font-style: italic; margin-top: 10px;">Waiting for Apple Calendar Sync...</div>
      </div>
    `;
}

// Function to handle the arrow clicks
window.changeMonth = function(offset) {
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    renderCalendar();
}

document.getElementById('commandInput')?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const val = e.target.value.trim();
    if (!val) return;
    
    if (typeof authenticated !== 'undefined' && !authenticated) {
      toast('Access denied. Unlock terminal.', true);
      return;
    }

    try {
      if (val.startsWith('/todo ')) {
        const task = val.replace('/todo ', '');
        const { error } = await sb.from('todos').insert([{ task, is_done: false }]);
        if (error) throw error;
        fetchTodos();
        toast('Task added.');
      } 
      else if (val.startsWith('/link ')) {
        let url = val.replace('/link ', '').trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
        
        const { error } = await sb.from('vault').insert([{ url: url, category: 'general', is_media: false }]);
        if (error) throw error;
        renderVault();
        toast('Link saved to vault.');
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

/* ── MUTATIONS ── */
async function toggleTodo(id, is_done) { await sb.from('todos').update({ is_done }).eq('id', id); fetchTodos(); }
async function deleteTodo(id) { await sb.from('todos').delete().eq('id', id); fetchTodos(); }
async function deleteNote(id) { await sb.from('notes').delete().eq('id', id); fetchNotes(); }

/* ── INIT TIMERS ── */
/* ── INIT TIMERS & LISTENERS ── */
window.addEventListener('DOMContentLoaded', () => {
    initStars();
    setInterval(updateSpotify, 30000);
    setInterval(updateUptime, 1000);
    updateSpotify();
    updateUptime();
    
    if (document.getElementById('view-dashboard')?.classList.contains('active')) {
        showDashboard();
    }

    // Safely attach the command listener after the DOM is fully loaded
    const cmdInput = document.getElementById('commandInput');
    if (cmdInput) {
        cmdInput.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            const val = e.target.value.trim();
            if (!val) return;
            
            if (typeof authenticated !== 'undefined' && !authenticated) {
              toast('Access denied. Unlock terminal.', true);
              return;
            }

            try {
              if (val.startsWith('/todo ')) {
                const task = val.replace('/todo ', '');
                const { error } = await sb.from('todos').insert([{ task, is_done: false }]);
                if (error) throw error;
                fetchTodos();
                toast('Task added.');
              } 
              else if (val.startsWith('/link ')) {
                let url = val.replace('/link ', '').trim();
                if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
                
                const { error } = await sb.from('vault').insert([{ url: url, category: 'general', is_media: false }]);
                if (error) throw error;
                renderVault();
                toast('Link saved to vault.');
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