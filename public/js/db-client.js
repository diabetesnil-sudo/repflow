// IndexedDB Offline-First Storage Engine for RepFlow Phase 8 Multi-Tenant SaaS
const RepFlowDB = (() => {
  const DB_NAME = 'repflow-saas-db';
  const DB_VERSION = 7;
  let dbPromise = null;

  function initDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          console.log('[IndexedDB] Upgrading schema to RepFlow SaaS Version', DB_VERSION);

          if (!db.objectStoreNames.contains('offline_dcrs')) {
            db.createObjectStore('offline_dcrs', { keyPath: 'local_id', autoIncrement: true });
          }
          if (!db.objectStoreNames.contains('sample_bag')) {
            db.createObjectStore('sample_bag', { keyPath: 'id', autoIncrement: true });
          }
          if (!db.objectStoreNames.contains('master_doctors')) {
            db.createObjectStore('master_doctors', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('master_chemists')) {
            db.createObjectStore('master_chemists', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('master_distributors')) {
            db.createObjectStore('master_distributors', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('gift_distributions')) {
            db.createObjectStore('gift_distributions', { keyPath: 'id', autoIncrement: true });
          }
          // Multi-Tenant SaaS Persistence Stores
          if (!db.objectStoreNames.contains('tenants')) {
            const tenantStore = db.createObjectStore('tenants', { keyPath: 'id' });
            tenantStore.createIndex('slug', 'slug', { unique: false });
          }
          if (!db.objectStoreNames.contains('users')) {
            const userStore = db.createObjectStore('users', { keyPath: 'id' });
            userStore.createIndex('tenant_id', 'tenant_id', { unique: false });
            userStore.createIndex('role', 'role', { unique: false });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
      });
    }
    return dbPromise;
  }

  // Tenant Caching Methods
  async function saveTenantsToCache(tenants) {
    if (!Array.isArray(tenants)) return;
    try {
      localStorage.setItem('repflow_cached_tenants', JSON.stringify(tenants));
    } catch (e) {
      console.warn('[Cache] localStorage write failed for tenants:', e);
    }
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('tenants', 'readwrite');
        const store = tx.objectStore('tenants');
        tenants.forEach(t => store.put(t));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[IndexedDB] saveTenantsToCache error:', err);
    }
  }

  async function getCachedTenants() {
    try {
      const db = await initDB();
      const records = await new Promise((resolve, reject) => {
        const tx = db.transaction('tenants', 'readonly');
        const store = tx.objectStore('tenants');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      if (records && records.length > 0) return records;
    } catch (err) {
      console.warn('[IndexedDB] getCachedTenants failed, checking localStorage fallback:', err);
    }
    try {
      const local = localStorage.getItem('repflow_cached_tenants');
      if (local) return JSON.parse(local);
    } catch (e) {}
    return [];
  }

  // Users / Hierarchy Caching Methods
  async function saveUsersToCache(tenantId, users) {
    if (!Array.isArray(users)) return;
    const tid = String(tenantId ?? 0);
    try {
      localStorage.setItem(`repflow_cached_users_${tid}`, JSON.stringify(users));
    } catch (e) {
      console.warn('[Cache] localStorage write failed for users:', e);
    }
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('users', 'readwrite');
        const store = tx.objectStore('users');
        users.forEach(u => store.put(u));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[IndexedDB] saveUsersToCache error:', err);
    }
  }

  async function getCachedUsers(tenantId) {
    const tid = String(tenantId ?? 0);
    try {
      const db = await initDB();
      const records = await new Promise((resolve, reject) => {
        const tx = db.transaction('users', 'readonly');
        const store = tx.objectStore('users');
        const req = store.getAll();
        req.onsuccess = () => {
          const all = req.result || [];
          const filtered = all.filter(u => String(u.tenant_id) === tid || (tid === '0' && (u.role === 'SUPER_ADMIN' || !u.tenant_id)));
          resolve(filtered.length > 0 ? filtered : all);
        };
        req.onerror = () => reject(req.error);
      });
      if (records && records.length > 0) return records;
    } catch (err) {
      console.warn('[IndexedDB] getCachedUsers failed, checking localStorage fallback:', err);
    }
    try {
      const local = localStorage.getItem(`repflow_cached_users_${tid}`);
      if (local) return JSON.parse(local);
    } catch (e) {}
    return [];
  }

  async function queueOfflineDCR(dcrPayload) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_dcrs', 'readwrite');
      const store = tx.objectStore('offline_dcrs');
      const record = { ...dcrPayload, queued_at: new Date().toISOString() };
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getOfflineDCRQueue() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_dcrs', 'readonly');
      const store = tx.objectStore('offline_dcrs');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function clearOfflineDCR(localId) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_dcrs', 'readwrite');
      const store = tx.objectStore('offline_dcrs');
      const req = store.delete(localId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function inwardSampleStock(productName, inwardQty) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sample_bag', 'readwrite');
      const store = tx.objectStore('sample_bag');
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        const existing = items.find(i => i.product_name === productName);
        if (existing) {
          existing.current_qty += inwardQty;
          existing.allocated_qty += inwardQty;
          store.put(existing);
        } else {
          store.add({ product_name: productName, current_qty: inwardQty, allocated_qty: inwardQty, low_stock_threshold: 5 });
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  return {
    initDB,
    saveTenantsToCache,
    getCachedTenants,
    saveUsersToCache,
    getCachedUsers,
    queueOfflineDCR,
    getOfflineDCRQueue,
    clearOfflineDCR,
    inwardSampleStock
  };
})();

window.RepFlowDB = RepFlowDB;
