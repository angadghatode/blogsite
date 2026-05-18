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
    renderNotesView(); 
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

// Global Bootstrapper & Command Bar
window.addEventListener('DOMContentLoaded', () => {
    setInterval(updateSpotify, 30000);
    setInterval(updateUptime, 1000);
    updateSpotify();
    updateUptime();
    
    // Ensure this exists in tasks.js
    if (typeof initDragAndDrop === 'function') initDragAndDrop();
    
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