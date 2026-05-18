/* ================================================================
   ANGAD.LOG — dashboard.js
   Handles the private dashboard views, data, and interactivity
   ================================================================ */

// State Management
let allTodos = [];
let allNotes = [];
let allLinks = []; 
let allSecureFiles = []; 

// Navigation State
let currentTaskFilter = 'today';
let currentDashTab = 'overview'; 
let currentNoteFolderId = null; 
let currentActiveNoteId = null; 

function showDashboard() {
    document.body.classList.add('dashboard-mode'); 
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    
    document.getElementById('view-dashboard').classList.add('active');
    document.getElementById('tabDash').classList.add('active');
    
    fetchTodos();
    fetchNotes();
    fetchVault(); 
    fetchSecureFiles(); 
    renderCalendar();
}

/* ── UI INTERACTIONS ────────────────────────────────────────── */

function switchDashTab(tabName) {
    currentDashTab = tabName; 
    
    document.querySelectorAll('.dash-nav-item').forEach(btn => btn.classList.remove('active'));
    
    const activeBtn = document.querySelector(`.dash-nav-item[onclick*="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const cards = document.querySelectorAll('.dash-card');
    const commandBar = document.querySelector('.dash-command');

    const targetClass = tabName === 'vault' ? 'dash-secure-vault' : `dash-${tabName}`;

    cards.forEach(card => {
        if (card === commandBar) return; 
        
        if (tabName === 'overview') {
            card.style.display = ''; 
            card.style.gridColumn = '';
            card.style.gridRow = '';
        } else {
            if (card.classList.contains(targetClass)) {
                card.style.display = 'flex';
                card.style.gridColumn = '1 / -1'; 
                card.style.gridRow = 'auto'; 
            } else {
                card.style.display = 'none';
            }
        }
    });

    renderVault(); 
    renderNotesView(); // Triggers the dynamic notes UI swap!
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
    
    const { data, error } = await sb.from('todos')
        .select('*')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false });
        
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
        <li class="list-item" draggable="true" data-id="${t.id}">
            <div class="drag-handle" title="Drag to reorder">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
            </div>
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

/* ── INFINITE FOLDER NOTES ENGINE ───────────────────────────── */

async function fetchNotes() {
    if (typeof sb === 'undefined') return;
    const { data, error } = await sb.from('notes').select('*').order('is_folder', { ascending: false }).order('updated_at', { ascending: false });
    if (error) return console.error("Notes Error:", error);
    allNotes = data || []; 
    renderNotesView();
}

function renderNotesView() {
    const container = document.getElementById('dynamic-notes-container');
    if (!container) return;

    if (currentDashTab === 'overview') {
        // OVERVIEW: Show only Favorite Notes
        const favorites = allNotes.filter(n => n.is_favorite && !n.is_folder);
        let listHtml = favorites.length === 0 
            ? `<div style="padding:20px; text-align:center; color:var(--text-faint); font-size:12px; font-style:italic;">No pinned notes. Star a note to see it here.</div>`
            : favorites.map(n => `
                <div class="list-item" style="cursor:pointer;" onclick="openNoteInTab(${n.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--purple-bright)" stroke="var(--purple-bright)" stroke-width="2" style="margin-right:12px; flex-shrink:0;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    <span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.title}</span>
                </div>
              `).join('');

        container.innerHTML = `
            <div class="card-header"><div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg> PINNED NOTES</div></div>
            <div class="list-container" style="flex:1; overflow-y:auto;">${listHtml}</div>
        `;
    } 
    else if (currentDashTab === 'notes') {
        // FULL TAB: Show either the Editor or the Folder Explorer
        if (currentActiveNoteId) {
            renderActiveNoteEditor(container);
        } else {
            renderFolderExplorer(container);
        }
    }
}

// DRIVES THE FILE EXPLORER
function renderFolderExplorer(container) {
    // 1. Build Breadcrumbs
    let breadcrumbs = `<span style="cursor:pointer; color:var(--purple-bright);" onclick="navigateToFolder(null)">ROOT</span>`;
    if (currentNoteFolderId) {
        let path = [];
        let curr = allNotes.find(n => n.id === currentNoteFolderId);
        while (curr) {
            path.unshift(curr);
            curr = allNotes.find(n => n.id === curr.parent_id);
        }
        path.forEach(f => {
            breadcrumbs += ` <span style="opacity:0.5;">/</span> <span style="cursor:pointer; color:var(--text);" onclick="navigateToFolder(${f.id})">${f.title}</span>`;
        });
    }

    // 2. Filter items to current folder
    const items = allNotes.filter(n => n.parent_id === currentNoteFolderId);
    
    let listHtml = items.length === 0 
        ? `<div style="padding:40px; text-align:center; color:var(--text-faint); font-size:12px; font-style:italic;">Folder is empty.</div>`
        : items.map(n => {
            const icon = n.is_folder 
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-dim);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--purple-bright);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>`;
            
            const starFill = n.is_favorite ? 'var(--purple-bright)' : 'none';
            const starBtn = n.is_folder ? '' : `<button onclick="event.stopPropagation(); toggleNoteFavorite(${n.id})" style="background:none; border:none; cursor:pointer; color:var(--purple-bright); margin-right:10px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="${starFill}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>`;

            return `
            <div class="list-item" style="cursor:pointer; padding: 12px 16px;" onclick="${n.is_folder ? `MapsToFolder(${n.id})` : `openNoteInTab(${n.id})`}">
                <div style="display:flex; align-items:center; flex:1; gap:12px;">
                    ${icon}
                    <span style="font-size:14px;">${n.title}</span>
                </div>
                <div style="display:flex; align-items:center;">
                    ${starBtn}
                    <button onclick="event.stopPropagation(); deleteNoteEntity(${n.id})" style="background:none; border:none; color:var(--tc-life); cursor:pointer; opacity:0.7; font-size:16px;">✕</button>
                </div>
            </div>`;
        }).join('');

    container.innerHTML = `
        <div class="card-header" style="justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:0;">
            <div class="card-title" style="font-size:12px;">${breadcrumbs}</div>
            <div style="display:flex; gap:10px;">
                <button onclick="createNewEntity(true)" class="tag-chip" style="cursor:pointer; background:transparent; border:1px solid var(--border-mid);">+ Folder</button>
                <button onclick="createNewEntity(false)" class="tag-chip" style="cursor:pointer; background:var(--purple-dim); border:none; color:white;">+ Note</button>
            </div>
        </div>
        <div class="list-container" style="flex:1; overflow-y:auto; padding-top:10px;">${listHtml}</div>
    `;
}

// DRIVES THE LIVE EDITOR
function renderActiveNoteEditor(container) {
    const note = allNotes.find(n => n.id === currentActiveNoteId);
    if (!note) { currentActiveNoteId = null; return renderNotesView(); }

    const starFill = note.is_favorite ? 'var(--purple-bright)' : 'none';

    container.innerHTML = `
        <div class="card-header" style="justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:0;">
            <div style="display:flex; align-items:center; gap:12px; width:100%;">
                <button onclick="closeActiveNote()" style="background:none; border:none; color:var(--text-dim); cursor:pointer;">&larr; Back</button>
                <input type="text" id="live-note-title" value="${note.title}" style="flex:1; background:transparent; border:none; color:var(--text); font-family:'Qaaxee', monospace; font-size:16px; outline:none;" placeholder="Note Title...">
                <button onclick="toggleNoteFavorite(${note.id})" style="background:none; border:none; cursor:pointer; color:var(--purple-bright);"><svg width="18" height="18" viewBox="0 0 24 24" fill="${starFill}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>
            </div>
        </div>
        
        <div id="live-note-body" contenteditable="true" style="flex:1; overflow-y:auto; padding: 20px; font-size: 14px; line-height: 1.6; outline:none; color:var(--text-dim);">
            ${note.content || '<div>start typing... (use #, ##, or ### for headings)</div>'}
        </div>
    `;

    // Attach Live Editor Listeners
    const titleEl = document.getElementById('live-note-title');
    const bodyEl = document.getElementById('live-note-body');
    let saveTimeout;

    const triggerSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => { saveNoteData(note.id, titleEl.value, bodyEl.innerHTML); }, 1000);
    };

    titleEl.addEventListener('input', triggerSave);
    bodyEl.addEventListener('input', triggerSave);

    // The Live Markdown Interceptor
    bodyEl.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            const node = sel.anchorNode;
            
            if (node && node.nodeType === 3) { // If it's a text node
                const text = node.textContent;
                let match = false;
                let newTag = '';
                let cleanText = '';
                
                if (text.startsWith('### ')) { match = true; newTag = 'h3'; cleanText = text.substring(4); }
                else if (text.startsWith('## ')) { match = true; newTag = 'h2'; cleanText = text.substring(3); }
                else if (text.startsWith('# ')) { match = true; newTag = 'h1'; cleanText = text.substring(2); }
                
                if (match) {
                    const el = document.createElement(newTag);
                    el.style.color = "var(--text)";
                    el.style.marginTop = "1rem";
                    el.style.marginBottom = "0.5rem";
                    el.textContent = cleanText;
                    
                    const parentBlock = node.parentNode;
                    
                    if (parentBlock.id === 'live-note-body') {
                        parentBlock.replaceChild(el, node);
                    } else {
                        parentBlock.parentNode.replaceChild(el, parentBlock);
                    }
                    
                    // Reset Cursor inside the new heading
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    
                    triggerSave();
                }
            }
        }
    });
}

// ── NOTES NAVIGATION & MUTATIONS ──

function navigateToFolder(folderId) {
    currentNoteFolderId = folderId;
    currentActiveNoteId = null;
    renderNotesView();
}

function openNoteInTab(noteId) {
    if (currentDashTab !== 'notes') {
        switchDashTab('notes');
    }
    currentActiveNoteId = noteId;
    renderNotesView();
}

function closeActiveNote() {
    currentActiveNoteId = null;
    renderNotesView();
}

async function createNewEntity(isFolder) {
    let title = await customPrompt(isFolder ? "Folder Name:" : "Note Title:", "");
    if (!title) return;
    
    const payload = {
        title: title,
        parent_id: currentNoteFolderId,
        is_folder: isFolder,
        content: isFolder ? null : '<div>...</div>'
    };
    
    const { data, error } = await sb.from('notes').insert([payload]).select();
    if (!error && data) {
        allNotes.push(data[0]);
        if (!isFolder) openNoteInTab(data[0].id);
        else renderNotesView();
    }
}

async function saveNoteData(id, title, content) {
    const note = allNotes.find(n => n.id === id);
    if (note) {
        note.title = title;
        note.content = content;
    }
    await sb.from('notes').update({ title: title, content: content, updated_at: new Date().toISOString() }).eq('id', id);
}

async function toggleNoteFavorite(id) {
    const note = allNotes.find(n => n.id === id);
    if (!note) return;
    note.is_favorite = !note.is_favorite;
    renderNotesView(); // Instant UI update
    await sb.from('notes').update({ is_favorite: note.is_favorite }).eq('id', id);
}

async function deleteNoteEntity(id) {
    allNotes = allNotes.filter(n => n.id !== id && n.parent_id !== id); // removes item and direct children locally
    renderNotesView();
    await sb.from('notes').delete().eq('id', id); // Supabase 'cascade' handles deep deletion
    toast('Item deleted.');
}

// VAULT (LINKS)
async function fetchVault() {
    if (typeof sb === 'undefined') return;
    
    const { data, error } = await sb.from('links').select('*').order('created_at', { ascending: false });
    if (error) return console.error("Links DB Error:", error);

    allLinks = await Promise.all(data.map(async (item) => {
        const existingLink = allLinks.find(l => l.url === item.url && l.meta);
        if (existingLink) {
            item.meta = existingLink.meta; 
            return item;
        }
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
        const top5 = allLinks.slice(0, 5);
        vaultEl.style.display = "flex"; 
        vaultEl.innerHTML = top5.map(buildLinkHtml).join('');
    } else {
        vaultEl.style.display = "block"; 

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

/* ── SECURE FILE VAULT ──────────────────────────────────────── */

async function fetchSecureFiles() {
    if (typeof sb === 'undefined') return;
    const { data, error } = await sb.from('vault_files').select('*').order('created_at', { ascending: false });
    
    if (error) {
        console.error("Vault DB Error:", error.message);
        allSecureFiles = []; 
    } else {
        allSecureFiles = data || [];
    }
    renderSecureVault();
}

function renderSecureVault() {
    const container = document.getElementById('secure-vault-content');
    if (!container) return;

    if (typeof authenticated === 'undefined' || !authenticated) {
        container.innerHTML = `
          <div class="secure-entry">
            <div class="vault-folder-icon">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <p>Secure storage for your sensitive files and notes.</p>
            <button class="pw-btn vault-enter-btn" onclick="openAuth()">Enter Vault</button>
          </div>
        `;
        return;
    }

    let filesHtml = '';
    
    if (allSecureFiles.length === 0) {
        filesHtml = `<div style="color:var(--text-faint); font-size:14px; text-align:center; font-style:italic; padding: 40px 0; font-family: 'Qaaxee', monospace;">vault is empty. click + to upload.</div>`;
    } else {
        filesHtml = allSecureFiles.map(f => {
            const urlObj = sb.storage.from('vault_files_bucket').getPublicUrl(f.file_path);
            const fileUrl = urlObj.data.publicUrl;
            const sizeMb = (f.file_size / (1024 * 1024)).toFixed(2);

            return `
            <div class="list-item" style="justify-content: space-between; padding: 12px 16px; margin-bottom: 10px;">
                <a href="${fileUrl}" target="_blank" style="color: var(--text); text-decoration: none; display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                    <svg class="vault-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; color:var(--purple-bright); flex-shrink:0;"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                    <div style="display: flex; flex-direction: column; min-width: 0;">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; font-size: 15px;">${f.filename}</span>
                        <span style="font-size: 11px; color: var(--text-faint); font-family: 'Qaaxee', monospace;">${sizeMb} MB • ${relativeDate(f.created_at)}</span>
                    </div>
                </a>
                
                <div style="display: flex; align-items: center; gap: 12px; margin-left: 12px;">
                    <button onclick="downloadSecureFile('${f.file_path}', '${f.filename}')" style="background:none; border:none; color:var(--cream); cursor:pointer; display:flex; align-items:center; opacity:0.7; transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" title="Download File">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                    <button onclick="deleteSecureFile(${f.id}, '${f.file_path}')" style="background:none; border:none; color:var(--tc-life); cursor:pointer; font-size:16px; opacity:0.7; transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" title="Delete File">✕</button>
                </div>
            </div>
            `;
        }).join('');
    }

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; flex: 1; position: relative; height: 100%; min-height: 150px;">
            <div style="overflow-y: auto; flex: 1; padding-right: 5px; padding-bottom: 45px;">
                ${filesHtml}
            </div>
            
            <input type="file" id="vault-file-input" style="display:none;" onchange="handleVaultSelect(event)" multiple>
            
            <button onclick="document.getElementById('vault-file-input').click()" 
                    style="position: absolute; bottom: 0; right: 0; background: var(--bg); border: 1px solid var(--border-mid); color: var(--purple-bright); width: 40px; height: 40px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;"
                    onmouseover="this.style.borderColor='var(--purple-bright)'; this.style.background='var(--purple-faint)';"
                    onmouseout="this.style.borderColor='var(--border-mid)'; this.style.background='var(--bg)';">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
        </div>
    `;
}

// ── UPLOAD HANDLER ──
async function handleVaultSelect(e) {
    const files = e.target.files;
    if (files.length > 0) uploadSecureFiles(files);
}

// ── UPLOAD ENGINE ──
async function uploadSecureFiles(files) {
    toast('uploading encrypted payload...');
    let hasError = false;
    
    for (let file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        let { error: uploadError } = await sb.storage.from('vault_files_bucket').upload(filePath, file);
        if (uploadError) {
            console.error("Storage Error:", uploadError.message);
            hasError = true;
            continue; 
        }

        let { error: dbError } = await sb.from('vault_files').insert([{
            filename: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type
        }]);
        
        if (dbError) {
            console.error("Database Error:", dbError.message);
            hasError = true;
        }
    }
    
    if (hasError) {
        toast('system error: check browser console.', true);
    } else {
        toast('payload secured.');
    }
    
    fetchSecureFiles(); 
}

// ── DELETE ENGINE ──
async function deleteSecureFile(id, filePath) {
    await sb.storage.from('vault_files_bucket').remove([filePath]);
    await sb.from('vault_files').delete().eq('id', id);
    fetchSecureFiles();
    toast('file erased from system.');
}

// ── DOWNLOAD ENGINE ──
async function downloadSecureFile(filePath, filename) {
    toast('fetching file...');
    
    const { data, error } = await sb.storage.from('vault_files_bucket').download(filePath);
    
    if (error) {
        console.error("Download Error:", error);
        toast('system error: download failed.', true);
        return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename; 
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast('download complete.');
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

window.changeMonth = function(offset) {
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    renderCalendar();
}

window.selectCalDate = function(dateStr) {
    selectedCalDate = dateStr;
    renderCalendar();
}

/* ── HELPER: NLP DATE PARSER ── */
function convertRelativeDateTag(taskStr) {
    let tagMatch = taskStr.match(/@(\w+)/);
    if (!tagMatch) return taskStr;

    let keyword = tagMatch[1].toLowerCase();
    let targetDate = new Date();

    if (['today', 'tod'].includes(keyword)) {
        targetDate = new Date(); 
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

        titleEl.innerText = title;
        inputEl.value = defaultValue;
        overlay.style.display = 'flex';
        
        setTimeout(() => overlay.classList.add('active'), 10);
        setTimeout(() => inputEl.focus(), 100);

        const cleanup = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.style.display = 'none', 200); 
            submitBtn.onclick = null;
            cancelBtn.onclick = null;
            inputEl.onkeydown = null;
        };

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

    let rawTask = taskObj.task.replace(/ !done_\S+/, '');
    let updatedTask = await customPrompt("edit_task", rawTask);
    
    if (updatedTask === null || updatedTask.trim() === "") return;

    let finalTask = convertRelativeDateTag(updatedTask.trim());

    if (taskObj.is_done) {
        let doneMatch = taskObj.task.match(/!done_\S+/);
        if (doneMatch) finalTask += ` ${doneMatch[0]}`;
    }

    taskObj.task = finalTask;
    renderTodos(); 

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

async function deleteLink(id) { 
    allLinks = allLinks.filter(l => l.id !== id);
    renderVault(); 
    await sb.from('links').delete().eq('id', id); 
    fetchVault(); 
    toast('Link deleted.');
}

/* ── DRAG AND DROP ENGINE ───────────────────────────────────── */
function initDragAndDrop() {
    const todoList = document.getElementById('todo-list');
    if (!todoList) return;

    todoList.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.list-item');
        if (!item) return;
        setTimeout(() => item.classList.add('dragging'), 0);
    });

    todoList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(todoList, e.clientY);
        const draggingItem = document.querySelector('.dragging');
        if (!draggingItem) return;
        
        if (afterElement == null) {
            todoList.appendChild(draggingItem);
        } else {
            todoList.insertBefore(draggingItem, afterElement);
        }
    });

    todoList.addEventListener('dragend', (e) => {
        const item = e.target.closest('.list-item');
        if (item) item.classList.remove('dragging');
        saveTaskOrder();
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.list-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function saveTaskOrder() {
    const items = document.querySelectorAll('#todo-list .list-item');
    items.forEach((item, index) => {
        const id = parseInt(item.getAttribute('data-id'));
        const taskObj = allTodos.find(t => t.id === id);
        if (taskObj) taskObj.order_index = index;
        sb.from('todos').update({ order_index: index }).eq('id', id).then();
    });
    allTodos.sort((a, b) => {
        const orderA = a.order_index ?? 0;
        const orderB = b.order_index ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.created_at) - new Date(a.created_at);
    });
}

/* ── COMMAND LISTENER & WIDGETS ── */
window.addEventListener('DOMContentLoaded', () => {
    setInterval(updateSpotify, 30000);
    setInterval(updateUptime, 1000);
    updateSpotify();
    updateUptime();
    initDragAndDrop();
    
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
                
                allLinks.unshift({ id: Date.now(), url: url, category: cat, meta: null });
                renderVault();
                
                const { error } = await sb.from('links').insert([{ url: url, category: cat, is_media: false }]);
                if (error) throw error;
                
                await fetchVault(); 
                toast('Link saved.');
              }
              // The command now safely drops the note in the ROOT directory
              else if (val.startsWith('/note ')) {
                const content = val.replace('/note ', '');
                const { error } = await sb.from('notes').insert([{ title: 'Quick Note', content: content, is_folder: false, parent_id: null }]);
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