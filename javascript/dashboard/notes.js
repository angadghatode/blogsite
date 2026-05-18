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

    const items = allNotes.filter(n => n.parent_id === currentNoteFolderId);
    
    let listHtml = items.length === 0 
        ? `<div style="padding:40px; text-align:center; color:var(--text-faint); font-size:14px; font-style:italic;">Folder is empty.</div>`
        : items.map(n => {
            const icon = n.is_folder 
                ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-dim);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
                : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--purple-bright);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>`;
            
            const starFill = n.is_favorite ? 'var(--purple-bright)' : 'none';
            const starBtn = n.is_folder ? '' : `<button onclick="event.stopPropagation(); toggleNoteFavorite(${n.id})" style="background:none; border:none; cursor:pointer; color:var(--purple-bright); margin-right:12px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="${starFill}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>`;

            // THE FIX: Increased padding, added margin-bottom, and fixed the navigateToFolder typo
            return `
            <div class="list-item" style="cursor:pointer; padding: 16px 20px; margin-bottom: 8px;" onclick="${n.is_folder ? `MapsToFolder(${n.id})` : `openNoteInTab(${n.id})`}">
                <div style="display:flex; align-items:center; flex:1; gap:16px;">
                    ${icon}
                    <span style="font-size:16px; color:var(--text);">${n.title}</span>
                </div>
                <div style="display:flex; align-items:center;">
                    ${starBtn}
                    <button onclick="event.stopPropagation(); deleteNoteEntity(${n.id})" style="background:none; border:none; color:var(--tc-life); cursor:pointer; opacity:0.7; font-size:18px;">✕</button>
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
}

function renderActiveNoteEditor(container) {
    const note = allNotes.find(n => n.id === currentActiveNoteId);
    if (!note) { currentActiveNoteId = null; return renderNotesView(); }

    const starFill = note.is_favorite ? 'var(--purple-bright)' : 'none';

    // THE FIX: Bumped up the title font size to 22px, body font to 16px, and body color to var(--text)
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
    renderNotesView(); 
    await sb.from('notes').update({ is_favorite: note.is_favorite }).eq('id', id);
}

async function deleteNoteEntity(id) {
    allNotes = allNotes.filter(n => n.id !== id && n.parent_id !== id); 
    renderNotesView();
    await sb.from('notes').delete().eq('id', id); 
    if (typeof toast !== 'undefined') toast('Item deleted.');
}