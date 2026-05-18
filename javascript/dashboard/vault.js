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

async function deleteLink(id) { 
    allLinks = allLinks.filter(l => l.id !== id);
    renderVault(); 
    await sb.from('links').delete().eq('id', id); 
    fetchVault(); 
    if (typeof toast !== 'undefined') toast('Link deleted.');
}

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

async function handleVaultSelect(e) {
    const files = e.target.files;
    if (files.length > 0) uploadSecureFiles(files);
}

async function uploadSecureFiles(files) {
    if (typeof toast !== 'undefined') toast('uploading encrypted payload...');
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
    
    if (typeof toast !== 'undefined') {
        if (hasError) toast('system error: check browser console.', true);
        else toast('payload secured.');
    }
    fetchSecureFiles(); 
}

async function deleteSecureFile(id, filePath) {
    await sb.storage.from('vault_files_bucket').remove([filePath]);
    await sb.from('vault_files').delete().eq('id', id);
    fetchSecureFiles();
    if (typeof toast !== 'undefined') toast('file erased from system.');
}

async function downloadSecureFile(filePath, filename) {
    if (typeof toast !== 'undefined') toast('fetching file...');
    const { data, error } = await sb.storage.from('vault_files_bucket').download(filePath);
    
    if (error) {
        console.error("Download Error:", error);
        if (typeof toast !== 'undefined') toast('system error: download failed.', true);
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
    
    if (typeof toast !== 'undefined') toast('download complete.');
}