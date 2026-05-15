/* ================================================================
   ANGAD.LOG — blog.js
   Handles blog posts, markdown parsing, and site UI
   ================================================================ */

/* ── STATE ── */
let posts            = [];
let currentPost      = null;
let editingPost      = null;
let activeTag        = null;
let draftTimer       = null;
let pendingEditPost  = null;

/* ── HELPERS ── */
function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}).toLowerCase(); }
function relativeDate(iso) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = diff/60000, hours = mins/60, days = hours/24;
  if (mins  < 60) return `${Math.floor(mins)}m ago`;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  if (days  < 30) return `${Math.floor(days)}d ago`;
  return fmtDate(iso);
}
function calcReadTime(body) { return Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 200)); }
function makeExcerpt(body) {
  const plain = body.replace(/##[^\n]*/g,'').replace(/\[\[callout\]\][\s\S]*?\[\[\/callout\]\]/g,'').replace(/\n/g,' ').trim();
  return plain.substring(0, 180) + (plain.length > 180 ? '...' : '');
}
const eyeSVG = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;opacity:.7"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>`;

/* ── SUPABASE FETCH (Legacy Method for Posts) ── */
async function sbFetch(path, opts = {}) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    headers: {
      'apikey':         SUPABASE_KEY,
      'Authorization':  'Bearer ' + SUPABASE_KEY,
      'Content-Type':   'application/json',
      'Prefer':         opts.prefer || ''
    },
    method: opts.method || 'GET',
    body:   opts.body
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  return res;
}

/* ── LOAD POSTS ── */
async function loadPosts() {
  if (!useSupabase) { renderTagFilter(); renderList(); renderSidebar(); return; }
  try {
    const res  = await sbFetch('posts?select=*&order=created_at.desc');
    const data = await res.json();
    posts = Array.isArray(data) ? data : [];
  } catch(e) { console.error('loadPosts:', e); }
  renderTagFilter();
  renderList();
  renderSidebar();
}

/* ── RENDERERS ── */
function renderTagFilter() {
  const tags = [...new Set(posts.map(p=>p.tag))].sort();
  const el   = document.getElementById('tagFilter');
  if (!tags.length) { el.innerHTML=''; return; }
  el.innerHTML = ['all',...tags].map(t=>`
    <span class="tag-chip ${(!activeTag&&t==='all')||activeTag===t?'active':''}"
          data-tag="${t}" onclick="setTag(${t==='all'?'null':`'${t}'`})">${t}</span>
  `).join('');
}

function setTag(tag) {
  activeTag = tag;
  renderTagFilter();
  renderList();
  renderSidebar();
  if (!document.getElementById('view-home').classList.contains('active') && !document.getElementById('view-post').classList.contains('active')) {
    showHome();
  }
}

function renderList() {
  const el       = document.getElementById('postList');
  const filtered = activeTag ? posts.filter(p=>p.tag===activeTag) : posts;
  if (!filtered.length) {
    el.innerHTML = authenticated
      ? `<div class="empty-state">[ : / ] no entries logged yet.<br><span class="empty-write-link" onclick="handleWriteClick()">write the first one →</span></div>`
      : `<div class="empty-state">[ : / ] no entries logged yet.</div>`;
    return;
  }
  el.innerHTML = filtered.map((p, i) => `
    <div class="post-card" data-idx="${i}">
      <div class="post-meta">
        <span class="post-tag" data-tag="${p.tag}">${p.tag}</span>
        <span class="post-date" title="${fmtDate(p.created_at)}">${relativeDate(p.created_at)}</span>
        <span class="post-views">${eyeSVG} ${dispViews(p)}</span>
        <span class="post-read-time">${calcReadTime(p.body)} MIN READ</span>
      </div>
      <div class="post-title">${p.title}</div>
      <div class="post-divider"></div>
      <div class="post-excerpt">${p.excerpt||makeExcerpt(p.body)}</div>
      <span class="read-more">READ FULL ENTRY →</span>
    </div>
  `).join('');
  el.querySelectorAll('.post-card').forEach((card, i) => { card.addEventListener('click', () => openPost(filtered[i])); });
}

function renderSidebar() {
  const tags    = [...new Set(posts.map(p=>p.tag))].sort();
  const navEl   = document.getElementById('sidebarNav');
  const allActive = !activeTag ? 'active' : '';
  if(navEl) {
      navEl.innerHTML = `
        <button class="sidebar-nav-item ${allActive}" onclick="setTag(null)">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" style="flex-shrink:0">
            <rect x="0" y="0" width="12" height="2"/><rect x="0" y="4" width="9" height="2"/><rect x="0" y="8" width="11" height="2"/>
          </svg>
          All Entries
        </button>
        ${tags.map(t => {
          const active = activeTag === t ? 'active' : '';
          return `<button class="sidebar-nav-item ${active}" onclick="setTag('${t}')"><span class="sdot" data-t="${t}"></span>${t}</button>`;
        }).join('')}
      `;
  }

  const recentEl = document.getElementById('recentEntries');
  const recent   = posts.slice(0, 5);
  if(recentEl) {
      if (!recent.length) {
        recentEl.innerHTML = '<div style="color:var(--text-faint);font-size:11px;padding:0.25rem 0.35rem;">no entries yet</div>';
      } else {
          recentEl.innerHTML = recent.map((p, i) => `
            <div class="recent-item" onclick="openPost(posts[${i}])">
              <div class="recent-item-row"><span class="recent-dot" style="background:var(--tc-${p.tag}, var(--purple))"></span><span class="recent-title">${p.title}</span></div>
              <div class="recent-date">${relativeDate(p.created_at)}</div>
            </div>
          `).join('');
      }
  }
}

function renderBody(raw) {
  return raw.split(/\n\n+/).map(block => {
    if (block.startsWith('##')) return `<h2>${block.replace(/^##\s*/,'')}</h2>`;
    const c = block.match(/\[\[callout\]\]([\s\S]*?)\[\[\/callout\]\]/);
    if (c) return `<div class="callout">${c[1].trim()}</div>`;
    return `<p>${block.replace(/\n/g,'<br>')}</p>`;
  }).join('');
}

function dispViews(p) {
  let seed = 0;
  const idStr = String(p.id || p.title || "1");
  for (let i = 0; i < idStr.length; i++) { seed += idStr.charCodeAt(i); }
  const postDate = p.created_at ? new Date(p.created_at).getTime() : Date.now();
  const hoursElapsed = Math.max(0, (Date.now() - postDate) / (1000 * 60 * 60));
  const spikeCap = 1500 + (seed % 3500); 
  const spikeViews = spikeCap * (1 - Math.exp(-hoursElapsed / 6));
  const slowBurnFactor = 50 + (seed % 150);
  const slowBurnViews = slowBurnFactor * Math.log(hoursElapsed + 1);
  return Math.floor(spikeViews + slowBurnViews + (p.views || 0)).toLocaleString();
}

/* ── VIEW NAVIGATION ── */
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-write').style.display = 'none';
  const target = document.getElementById('view-' + id);
  if (target) target.classList.add('active');
}

function showHome() {
    document.body.classList.remove('dashboard-mode'); 
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('view-home').classList.add('active');
    document.getElementById('tabLog').classList.add('active');
}

async function openPost(p) {
  if (!p) return;
  currentPost = p;

  if (!sessionStorage.getItem('viewed_' + p.id)) {
    p.views = (p.views || 0) + 1;
    if (useSupabase && p.id) {
      try { await sbFetch(`posts?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify({ views: p.views }) }); } catch(e) {}
    }
    sessionStorage.setItem('viewed_' + p.id, 'true');
  }

  const adminHtml = authenticated ? `
    <div class="admin-actions" id="postAdminActions">
      <span class="admin-action" onclick="editCurrentPost()">✎ edit</span>
      <span class="admin-action admin-action-delete" id="deleteBtn" onclick="initiateDelete()">✕ delete</span>
      <span class="admin-action admin-action-confirm" id="deleteConfirmBtn" style="display:none" onclick="confirmDelete()">confirm delete</span>
      <span class="admin-action" id="deleteCancelBtn" style="display:none" onclick="cancelDelete()">cancel</span>
    </div>` : '';

  document.getElementById('postContent').innerHTML = `
    <div class="single-post-header">
      <div class="post-meta">
        <span class="post-tag" data-tag="${p.tag}">${p.tag}</span>
        <span class="post-date" title="${fmtDate(p.created_at)}">${relativeDate(p.created_at)}</span>
        <span class="post-read-time">${calcReadTime(p.body)} MIN READ</span>
      </div>
      <div class="single-post-title">${p.title}</div>
      <div class="post-divider-single"></div>
      <div class="eye-counter">
        ${eyeSVG}<span>${dispViews(p)} views</span>
      </div>
      ${adminHtml}
    </div>
    <div class="post-body">${renderBody(p.body)}</div>
  `;

  document.getElementById('tabLog').classList.add('active');
  showView('post');
  document.getElementById('mainContent').scrollTo(0, 0);
}

/* ── POST ACTIONS (Write, Edit, Delete) ── */
function initiateDelete() {
  document.getElementById('deleteBtn').style.display = 'none';
  document.getElementById('deleteConfirmBtn').style.display = 'inline-block';
  document.getElementById('deleteCancelBtn').style.display = 'inline-block';
}
function cancelDelete() {
  document.getElementById('deleteBtn').style.display = 'inline-block';
  document.getElementById('deleteConfirmBtn').style.display = 'none';
  document.getElementById('deleteCancelBtn').style.display = 'none';
}
async function confirmDelete() {
  if (!currentPost || !authenticated) return;
  const p = currentPost;
  const btn = document.getElementById('deleteConfirmBtn');
  if (btn) { btn.textContent = 'deleting...'; btn.style.pointerEvents = 'none'; }

  if (useSupabase && p.id) {
    try { await sbFetch(`posts?id=eq.${p.id}`, { method: 'DELETE' }); } 
    catch(e) { toast(`delete failed — ${e.message}`, true); cancelDelete(); return; }
  } else { posts = posts.filter(x => x !== p); }

  await loadPosts();
  showHome();
  toast('entry deleted.');
}

function editCurrentPost() { if (currentPost && authenticated) openWrite(currentPost); }

function handleWriteClick() {
  if (authenticated) { openWrite(null); } 
  else { pendingEditPost = null; openAuth(); }
}

function openWrite(post = null) {
  editingPost = post;
  document.getElementById('writeModeLabel').textContent  = post ? 'edit entry' : 'new entry';
  document.getElementById('submitBtn').textContent       = post ? '// update entry' : '// post entry';
  document.getElementById('submitBtn').disabled          = false;

  if (post) {
    document.getElementById('newTitle').value = post.title;
    document.getElementById('newTag').value   = post.tag;
    document.getElementById('newBody').value  = post.body;
  } else { restoreDraft(); }
  updateWordCount();
  updatePreview();
  document.getElementById('view-write').style.display = 'flex';
}

function closeWrite() {
  editingPost = null;
  document.getElementById('view-write').style.display = 'none';
  if (currentPost) showView('post'); else showHome();
}

function updateWordCount() {
  const words = document.getElementById('newBody').value.trim().split(/\s+/).filter(w=>w).length;
  document.getElementById('bodyCount').textContent = words ? `${words} words` : '0 words';
}

function saveDraft() {
  if (editingPost) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try {
      localStorage.setItem('angadlog_draft', JSON.stringify({
        title: document.getElementById('newTitle').value,
        tag:   document.getElementById('newTag').value,
        body:  document.getElementById('newBody').value,
        t:     Date.now()
      }));
    } catch {}
  }, 800);
}

function restoreDraft() {
  try {
    const d = JSON.parse(localStorage.getItem('angadlog_draft')||'{}');
    if (!d.title && !d.body) return;
    document.getElementById('newTitle').value = d.title || '';
    document.getElementById('newTag').value   = d.tag   || 'life';
    document.getElementById('newBody').value  = d.body  || '';
  } catch {}
}

function clearDraft() { try { localStorage.removeItem('angadlog_draft'); } catch {} }

// Bind Draft Listeners
document.getElementById('newBody')?.addEventListener('input',  () => { updateWordCount(); updatePreview(); saveDraft(); });
document.getElementById('newTitle')?.addEventListener('input', () => { updatePreview(); saveDraft(); });
document.getElementById('newTag')?.addEventListener('change',  () => { updatePreview(); saveDraft(); });

async function submitPost() {
  const title = document.getElementById('newTitle').value.trim();
  const tag   = document.getElementById('newTag').value;
  const body  = document.getElementById('newBody').value.trim();
  if (!title || !body) { toast('title and body are required.', true); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = editingPost ? '// updating...' : '// posting...';

  try {
    if (editingPost) {
      const payload = { title, tag, body, excerpt: makeExcerpt(body) };
      if (useSupabase && editingPost.id) {
        await sbFetch(`posts?id=eq.${editingPost.id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(payload) });
      } else { Object.assign(editingPost, payload); }
      if (currentPost && currentPost === editingPost) Object.assign(currentPost, payload);
      await loadPosts();
      const updated = posts.find(p => String(p.id) === String(editingPost.id)) || editingPost;
      editingPost = null;
      openPost(updated);
      toast('entry updated.');
    } else {
      const num = String(posts.length + 1).padStart(3, '0');
      const payload = { title: `entry ${num} — ${title.toLowerCase()}`, tag, body, excerpt: makeExcerpt(body) };
      if (useSupabase) { await sbFetch('posts', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(payload) }); } 
      else { posts.unshift({ ...payload, id: null, created_at: new Date().toISOString() }); }
      clearDraft();
      document.getElementById('newTitle').value = '';
      document.getElementById('newBody').value  = '';
      updateWordCount();
      await loadPosts();
      editingPost = null;
      showHome();
      toast('entry posted.');
    }
  } catch(e) {
    btn.disabled = false;
    btn.textContent = editingPost ? '// update entry' : '// post entry';
    toast(`failed — ${e.message}`, true);
  }
}

/* ── UI HELPERS ── */
function updatePreview() {
  const title = document.getElementById('newTitle').value.trim();
  const body  = document.getElementById('newBody').value.trim();
  const tag   = document.getElementById('newTag').value;
  const el    = document.getElementById('writePreviewContent');

  if (!title && !body) {
    el.innerHTML = '<span class="preview-empty">start writing to see a live preview...</span>';
    return;
  }
  el.innerHTML = `
    <div style="margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
      <div class="post-meta" style="margin-bottom:0.5rem"><span class="post-tag">${tag}</span><span class="post-date">just now</span></div>
      <div class="preview-title">${title || 'title...'}</div>
    </div>
    <div class="post-body">${body ? renderBody(body) : 'body will appear here...'}</div>
  `;
}

let mobilePreviewVisible = false;
function toggleMobilePreview() {
  mobilePreviewVisible = !mobilePreviewVisible;
  document.getElementById('writePreviewWrap').classList.toggle('show-mobile', mobilePreviewVisible);
  document.getElementById('previewToggleBtn').classList.toggle('active', mobilePreviewVisible);
}

function openAbout()  { document.getElementById('aboutOverlay').classList.add('open'); }
function closeAbout() { document.getElementById('aboutOverlay').classList.remove('open'); }
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

let toastTimer;
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3200);
}

// Global Keyboard Shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('aboutOverlay')?.classList.contains('open'))  { closeAbout(); return; }
    if (document.getElementById('authOverlay')?.classList.contains('open'))   { closeAuth();  return; }
    if (document.getElementById('view-write')?.style.display === 'flex')      { closeWrite(); return; }
    if (document.getElementById('sidebar')?.classList.contains('open'))       { toggleSidebar(); return; }
  }
  if ((e.metaKey||e.ctrlKey) && e.key === 'k') {
    if (document.getElementById('view-write')?.style.display !== 'flex') { e.preventDefault(); handleWriteClick(); }
  }
});

// Initialize posts on load
loadPosts();