async function fetchNotes() {
    if (typeof sb === 'undefined') return;
    const { data, error } = await sb.from('notes').select('*').order('is_folder', { ascending: false }).order('updated_at', { ascending: false });
    if (error) return console.error("Notes Error:", error);
    allNotes = data || []; 
    renderNotesView();
}

// ── THE FIX: Bulletproof Click Routing ──
window.handleNoteClick = function(id, isFolder) {
    if (isFolder === true || String(isFolder) === 'true') {
        navigateToFolder(id);
    } else {
        openNoteInTab(id);
    }
};

window.navigateToFolder = function(folderId) {
    currentNoteFolderId = folderId === null ? null : String(folderId);
    currentActiveNoteId = null;
    renderNotesView();
};

window.openNoteInTab = function(noteId) {
    if (currentDashTab !== 'notes') {
        switchDashTab('notes');
    }
    currentActiveNoteId = String(noteId);
    renderNotesView();
};

function closeActiveNote() {
    currentActiveNoteId = null;
    renderNotesView();
}

// ── RENDER ENGINE ──
function renderNotesView() {
    const container = document.getElementById('dynamic-notes-container');
    if (!container) return;

    if (currentDashTab === 'overview') {
        const favorites = allNotes.filter(n => n.is_favorite && !n.is_folder);
        let listHtml = favorites.length === 0 
            ? `<div style="padding:20px; text-align:center; color:var(--text-faint); font-size:14px; font-style:italic;">No pinned notes. Star a note to see it here.</div>`
            : favorites.map(n => `
                <div class="list-item" style="cursor:pointer; margin-bottom: 8px; padding: 12px 16px;" onclick="openNoteInTab(${n.id})">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--purple-bright)" stroke="var(--purple-bright)" stroke-width="2" style="margin-right:12px; flex-shrink:0;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    <span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size: 15px;">${n.title}</span>
                </div>
              `).join('');

        container.innerHTML = `
            <div class="card-header"><div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg> PINNED NOTES</div></div>
            <div class="list-container" style="flex:1; overflow-y:auto;">${listHtml}</div>
        `;
    } 
    else if (currentDashTab === 'notes') {
        if (currentActiveNoteId) {
            renderActiveNoteEditor(container);
        } else {
            renderFolderExplorer(container);
        }
    }
}

function renderFolderExplorer(container) {
    let breadcrumbs = `<span class="breadcrumb-link" data-id="null" style="cursor:pointer; color:var(--purple-bright); padding: 4px;" onclick="navigateToFolder(null)">ROOT</span>`;
    
    if (currentNoteFolderId) {
        let path = [];
        let curr = allNotes.find(n => String(n.id) === currentNoteFolderId);
        let loopGuard = 0; 
        
        while (curr && loopGuard < 50) {
            path.unshift(curr);
            curr = curr.parent_id ? allNotes.find(n => String(n.id) === String(curr.parent_id)) : null;
            loopGuard++;
        }
        
        path.forEach(f => {
            breadcrumbs += ` <span style="opacity:0.5;">/</span> <span class="breadcrumb-link" data-id="${f.id}" style="cursor:pointer; color:var(--text); padding: 4px;" onclick="navigateToFolder(${f.id})">${f.title}</span>`;
        });
    }

    const items = allNotes.filter(n => {
        if (currentNoteFolderId === null) return n.parent_id === null;
        return String(n.parent_id) === currentNoteFolderId;
    });
    
    let listHtml = items.length === 0 
        ? `<div style="padding:40px; text-align:center; color:var(--text-faint); font-size:14px; font-style:italic;">Folder is empty.</div>`
        : items.map(n => {
            const icon = n.is_folder 
                ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-dim); pointer-events:none;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
                : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--purple-bright); pointer-events:none;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>`;
            
            const starFill = n.is_favorite ? 'var(--purple-bright)' : 'none';
            const starBtn = n.is_folder ? '' : `<button onclick="event.stopPropagation(); toggleNoteFavorite(${n.id})" style="background:none; border:none; cursor:pointer; color:var(--purple-bright); margin-right:12px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="${starFill}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>`;

            return `
            <div class="list-item note-list-item" id="note-row-${n.id}" data-id="${n.id}" data-isfolder="${n.is_folder}" style="padding: 16px 20px; margin-bottom: 8px; transition: all 0.2s ease; display: flex; align-items: center;">
                
                <div class="drag-handle" 
                     onmouseenter="document.getElementById('note-row-${n.id}').setAttribute('draggable', 'true')" 
                     onmouseleave="document.getElementById('note-row-${n.id}').removeAttribute('draggable')"
                     style="cursor:grab; color:var(--text-faint); margin-right: 16px; display: flex; align-items: center;" title="Drag to move">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                </div>

                <div style="display:flex; align-items:center; flex:1; gap:16px; cursor:pointer;" onclick="handleNoteClick(${n.id}, ${n.is_folder})">
                    ${icon}
                    <span style="font-size:16px; color:var(--text); pointer-events:none;">${n.title}</span>
                </div>
                
                <div style="display:flex; align-items:center;">
                    ${starBtn}
                    <button onclick="event.stopPropagation(); deleteNoteEntity(${n.id})" style="background:none; border:none; color:var(--tc-life); cursor:pointer; opacity:0.7; font-size:18px; z-index:10;">✕</button>
                </div>
                
            </div>`;
        }).join('');

    container.innerHTML = `
        <div class="card-header" style="justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:16px; margin-bottom:0;">
            <div class="card-title" style="font-size:14px;">${breadcrumbs}</div>
            <div style="display:flex; gap:12px;">
                <button onclick="createNewEntity(true)" class="tag-chip" style="cursor:pointer; background:transparent; border:1px solid var(--border-mid); font-size:13px; padding: 4px 10px;">+ Folder</button>
                <button onclick="createNewEntity(false)" class="tag-chip" style="cursor:pointer; background:var(--purple-dim); border:none; color:white; font-size:13px; padding: 4px 10px;">+ Note</button>
            </div>
        </div>
        <div class="list-container" style="flex:1; overflow-y:auto; padding-top:16px;">${listHtml}</div>
    `;

    initNoteDragAndDrop();
}

// ── DATA MUTATIONS ──
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
    const note = allNotes.find(n => String(n.id) === String(id));
    if (note) {
        note.title = title;
        note.content = content;
    }
    await sb.from('notes').update({ title: title, content: content, updated_at: new Date().toISOString() }).eq('id', id);
}

async function toggleNoteFavorite(id) {
    const note = allNotes.find(n => String(n.id) === String(id));
    if (!note) return;
    note.is_favorite = !note.is_favorite;
    renderNotesView(); 
    await sb.from('notes').update({ is_favorite: note.is_favorite }).eq('id', id);
}

async function deleteNoteEntity(id) {
    const targetId = String(id);
    allNotes = allNotes.filter(n => String(n.id) !== targetId && String(n.parent_id) !== targetId); 
    renderNotesView();
    await sb.from('notes').delete().eq('id', id); 
    if (typeof toast !== 'undefined') toast('Item deleted.');
}

// ── EDITOR ENGINE ──
function renderActiveNoteEditor(container) {
    const note = allNotes.find(n => String(n.id) === currentActiveNoteId);
    if (!note) { currentActiveNoteId = null; return renderNotesView(); }

    const starFill = note.is_favorite ? 'var(--purple-bright)' : 'none';

    container.innerHTML = `
        <div class="card-header" style="justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:16px; margin-bottom:0;">
            <div style="display:flex; align-items:center; gap:16px; width:100%;">
                <button onclick="closeActiveNote()" style="background:none; border:none; color:var(--text-dim); cursor:pointer; font-size: 14px;">&larr; Back</button>
                <input type="text" id="live-note-title" value="${note.title}" style="flex:1; background:transparent; border:none; color:var(--text); font-family:'Qaaxee', monospace; font-size:22px; outline:none;" placeholder="Note Title...">
                <button onclick="toggleNoteFavorite(${note.id})" style="background:none; border:none; cursor:pointer; color:var(--purple-bright);"><svg width="20" height="20" viewBox="0 0 24 24" fill="${starFill}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>
            </div>
        </div>
        <div id="live-note-body" contenteditable="true" style="flex:1; overflow-y:auto; padding: 24px; font-size: 16px; line-height: 1.8; outline:none; color:var(--text);">
            ${note.content || '<div>start typing... (use #, ##, or ### for headings)</div>'}
        </div>
    `;

    const titleEl = document.getElementById('live-note-title');
    const bodyEl = document.getElementById('live-note-body');
    let saveTimeout;

    const triggerSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => { saveNoteData(note.id, titleEl.value, bodyEl.innerHTML); }, 1000);
    };

    titleEl.addEventListener('input', triggerSave);
    bodyEl.addEventListener('input', triggerSave);

    bodyEl.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            const node = sel.anchorNode;
            
            if (node && node.nodeType === 3) { 
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

// ── DRAG ENGINE ──
function initNoteDragAndDrop() {
    const items = document.querySelectorAll('.note-list-item');
    
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.getAttribute('data-id'));
            e.stopPropagation();
            setTimeout(() => item.classList.add('dragging-note'), 0);
        });

        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging-note');
            item.removeAttribute('draggable'); 
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        if (item.getAttribute('data-isfolder') === 'true') {
            item.addEventListener('dragover', (e) => {
                e.preventDefault(); 
                item.classList.add('drag-over');
            });
            
            item.addEventListener('dragleave', (e) => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                item.classList.remove('drag-over');
                
                const draggedId = e.dataTransfer.getData('text/plain');
                const targetFolderId = item.getAttribute('data-id');
                
                moveNoteEntity(draggedId, targetFolderId);
            });
        }
    });

    document.querySelectorAll('.breadcrumb-link').forEach(bc => {
        bc.addEventListener('dragover', (e) => {
            e.preventDefault();
            bc.classList.add('drag-over');
        });
        bc.addEventListener('dragleave', (e) => {
            bc.classList.remove('drag-over');
        });
        bc.addEventListener('drop', (e) => {
            e.preventDefault();
            bc.classList.remove('drag-over');
            
            const draggedId = e.dataTransfer.getData('text/plain');
            const targetFolderId = bc.getAttribute('data-id') === 'null' ? null : bc.getAttribute('data-id');
            
            moveNoteEntity(draggedId, targetFolderId);
        });
    });
}

async function moveNoteEntity(draggedId, targetFolderId) {
    if (String(draggedId) === String(targetFolderId)) return; 

    // THE FIX: Safe-loop string coercion for circular drop prevention
    let curr = targetFolderId ? allNotes.find(n => String(n.id) === String(targetFolderId)) : null;
    let loopGuard = 0;
    while (curr && loopGuard < 50) {
        if (String(curr.id) === String(draggedId)) {
            if (typeof toast !== 'undefined') toast('System error: Cannot drop folder into itself.', true);
            return;
        }
        curr = curr.parent_id ? allNotes.find(n => String(n.id) === String(curr.parent_id)) : null;
        loopGuard++;
    }

    const item = allNotes.find(n => String(n.id) === String(draggedId));
    if (item) item.parent_id = targetFolderId;
    renderNotesView(); 

    await sb.from('notes').update({ parent_id: targetFolderId }).eq('id', draggedId);
    if (typeof toast !== 'undefined') toast('Item moved.');
}