/* ================================================================
   ANGAD.LOG — auth.js
   Handles login state, security overlays, and system access
   ================================================================ */

let authenticated = false;

// Assume `sb` (Supabase) is defined in index.html before this script runs.
const useSupabase = !!(typeof sb !== 'undefined'); 

window.addEventListener('DOMContentLoaded', () => {
    checkPersistence();
});

/* ── STATE MANAGEMENT ── */
function checkPersistence() {
    const isAuth = localStorage.getItem('angad_auth');
    if (isAuth === 'true') {
        authenticated = true; 
        document.body.classList.add('is-admin'); 
    }
}

/* ── OVERLAY CONTROLS ── */
function handleCatClick() {
    if (authenticated) {
        openSignOut();
    } else {
        openAuth();
    }
}

function openAuth() {
    const overlay = document.getElementById('authOverlay');
    const input = document.getElementById('pwInput');
    const errorEl = document.getElementById('pwError');

    if (overlay) overlay.classList.add('open');
    if (errorEl) errorEl.style.display = 'none';
    
    if (input) {
        input.value = '';
        // Slight delay ensures the modal is rendered before focusing the input
        setTimeout(() => input.focus(), 100);
    }
}

function closeAuth() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.classList.remove('open');
}

function openSignOut() {
    const overlay = document.getElementById('signOutOverlay');
    if (overlay) overlay.classList.add('open');
}

function closeSignOut() {
    const overlay = document.getElementById('signOutOverlay');
    if (overlay) overlay.classList.remove('open');
}

/* ── AUTHENTICATION LOGIC ── */
function checkPassword() {
    const input = document.getElementById('pwInput');
    const errorEl = document.getElementById('pwError');

    // Failsafe if ADMIN_PASSWORD isn't configured in HTML
    if (!ADMIN_PASSWORD || ADMIN_PASSWORD === '') {
        errorEl.textContent = 'system error: password missing';
        errorEl.style.display = 'block';
        return;
    }

    if (input.value === ADMIN_PASSWORD) {
        // 1. Grant Access
        authenticated = true;
        localStorage.setItem('angad_auth', 'true');
        document.body.classList.add('is-admin');
        
        // 2. Clean up UI
        errorEl.style.display = 'none';
        input.value = '';
        closeAuth();
        toast('access granted.');
        
        // 3. Handle pending actions (e.g. clicked edit before logging in)
        if (typeof renderSecureVault === 'function') renderSecureVault();
    } else {
        // Reject Access
        errorEl.textContent = 'incorrect password';
        errorEl.style.display = 'block';
        input.value = '';
        input.focus();
    }
}

function signOut() {
    // 1. Wipe the auth state
    authenticated = false;
    localStorage.removeItem('angad_auth');
    
    // 2. Revoke admin CSS privileges
    document.body.classList.remove('is-admin');
    
    // 3. Close the modal silently
    closeSignOut();
    
    // 4. Force the UI back to the public log view to hide dashboard
    if (typeof showHome === "function") {
        showHome();
    }
}