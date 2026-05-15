/* ================================================================
   ANGAD.LOG — auth.js
   Handles login state and Supabase initialization
   ================================================================ */

let authenticated = false;

// We assume `sb` is defined in index.html before this script runs.
const useSupabase = !!(typeof sb !== 'undefined'); 

window.addEventListener('DOMContentLoaded', () => {
    checkPersistence();
});

function checkPersistence() {
    const isAuth = localStorage.getItem('angad_auth');
    if (isAuth === 'true') {
        authenticated = true; 
        document.body.classList.add('is-admin'); 
    }
}

function openAuth() {
    const overlay = document.getElementById('authOverlay');
    const input = document.getElementById('pwInput');
    const errorEl = document.getElementById('pwError');

    if (overlay) {
        overlay.style.display = 'flex';
        overlay.classList.add('active');
    }
    if (errorEl) errorEl.style.display = 'none';
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
    }
}

function closeAuth() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.remove('active');
    }
}

function checkPassword() {
  const input = document.getElementById('pwInput').value;
  const errorEl = document.getElementById('pwError');

  if (!ADMIN_PASSWORD || ADMIN_PASSWORD === '') {
    errorEl.textContent = 'system error: password missing';
    errorEl.style.display = 'block';
    return;
  }

  if (input === ADMIN_PASSWORD) {
    authenticated = true;
    localStorage.setItem('angad_auth', 'true');
    document.body.classList.add('is-admin');
    errorEl.style.display = 'none';
    document.getElementById('pwInput').value = '';
    closeAuth();
    toast('access granted.');
    
    // Global variable defined in blog.js
    if (typeof pendingEditPost !== 'undefined' && pendingEditPost !== null) {
        openWrite(pendingEditPost);
        pendingEditPost = null;
    }
  } else {
    errorEl.textContent = 'incorrect password';
    errorEl.style.display = 'block';
    document.getElementById('pwInput').value = '';
  }
}