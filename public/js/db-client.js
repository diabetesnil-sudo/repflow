// IndexedDB Offline-First Storage Engine for RepFlow Phase 6 Multi-Tenant SaaS
const RepFlowDB = (() => {
  const DB_NAME = 'repflow-saas-db';
  const DB_VERSION = 6;
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
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
      });
    }
    return dbPromise;
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
    queueOfflineDCR,
    getOfflineDCRQueue,
    clearOfflineDCR,
    inwardSampleStock
  };
})();

window.RepFlowDB = RepFlowDB;
