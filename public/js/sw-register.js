// RepFlow Multi-Tenant PWA Registration & Lifecycle Handler (v7.0.0)

let deferredInstallPrompt = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[PWA] ServiceWorker registered with scope:', registration.scope);
        
        // Force immediate check for new Service Worker version on server
        registration.update().catch(() => {});

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showPWAUpdateToast(registration);
              }
            });
          }
        });
      })
      .catch((err) => {
        console.error('[PWA] ServiceWorker registration failed:', err);
      });
  });

  window.addEventListener('focus', () => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) reg.update();
    });
  });

  // Handle incoming messages from ServiceWorker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FLUSH_OFFLINE_QUEUE') {
      console.log('[PWA] SW triggered offline queue sync');
      if (window.RepFlowApp && window.RepFlowApp.syncOfflineData) {
        window.RepFlowApp.syncOfflineData();
      }
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// -------------------------------------------------------------------
// PWA Installation & Prompt Management (beforeinstallprompt)
// -------------------------------------------------------------------
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('[PWA] Captured beforeinstallprompt event.');

  // Show Install App buttons and floating banners
  showInstallPWAUI();
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] RepFlow PWA successfully installed on device!');
  deferredInstallPrompt = null;
  hideInstallPWAUI();
  if (window.RepFlowApp && window.RepFlowApp.showToast) {
    window.RepFlowApp.showToast('📲 RepFlow PWA Installed on Device!', 'success');
  }
});

// Trigger PWA Installation
async function promptPWAInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log(`[PWA] User choice outcome: ${outcome}`);
    if (outcome === 'accepted') {
      deferredInstallPrompt = null;
      hideInstallPWAUI();
    }
  } else if (isIOSDevice()) {
    showIOSInstallInstructions();
  } else {
    alert('RepFlow PWA is already installed or ready in standalone mode!');
  }
}

function showInstallPWAUI() {
  const installBtnHeader = document.getElementById('pwaInstallBtnHeader');
  if (installBtnHeader) installBtnHeader.style.display = 'inline-flex';

  const installBanner = document.getElementById('pwaInstallBanner');
  if (installBanner && !localStorage.getItem('repflow_pwa_dismissed')) {
    installBanner.style.display = 'flex';
  }
}

function hideInstallPWAUI() {
  const installBtnHeader = document.getElementById('pwaInstallBtnHeader');
  if (installBtnHeader) installBtnHeader.style.display = 'none';

  const installBanner = document.getElementById('pwaInstallBanner');
  if (installBanner) installBanner.style.display = 'none';
}

function dismissPWABanner() {
  localStorage.setItem('repflow_pwa_dismissed', 'true');
  hideInstallPWAUI();
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalonePWA() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function showIOSInstallInstructions() {
  const modal = document.getElementById('iosPwaModal');
  if (modal) modal.style.display = 'flex';
}

function showPWAUpdateToast(registration) {
  const toast = document.createElement('div');
  toast.id = 'pwaUpdateToast';
  toast.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 10000;
    background: #0f2b48; color: #fff; border: 1px solid #00f5d4;
    padding: 14px 20px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    display: flex; align-items: center; gap: 12px; font-family: sans-serif; font-size: 0.9rem;
  `;
  toast.innerHTML = `
    <span>🚀 New version of RepFlow available!</span>
    <button onclick="updatePWAWorker()" style="background:#00b4d8; border:none; color:#fff; padding:6px 12px; border-radius:6px; font-weight:bold; cursor:pointer;">Update Now</button>
  `;
  document.body.appendChild(toast);
  window.pwaRegistrationObj = registration;
}

function updatePWAWorker() {
  if (window.pwaRegistrationObj && window.pwaRegistrationObj.waiting) {
    window.pwaRegistrationObj.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}

// Background Sync helper
async function registerBackgroundSync(tag = 'sync-dcr-queue') {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register(tag);
      console.log(`[BackgroundSync] Registered sync tag: ${tag}`);
    } catch (err) {
      console.warn('[BackgroundSync] Sync registration warning:', err);
    }
  }
}

// Auto-check standalone mode on startup
document.addEventListener('DOMContentLoaded', () => {
  if (isStandalonePWA()) {
    document.body.classList.add('pwa-standalone-mode');
    console.log('[PWA] Running in standalone application mode');
  }
});
