// ─────────────────────────────────────────────
// database.js — IndexedDB substituindo SQLite
// ─────────────────────────────────────────────

const DB_NAME = 'gymcontrol_db';
const DB_VERSION = 1;
let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('alunas')) {
        const store = db.createObjectStore('alunas', { keyPath: 'id', autoIncrement: true });
        store.createIndex('nome', 'nome', { unique: false });
        store.createIndex('data_matricula', 'data_matricula', { unique: false });
        store.createIndex('status_pagamento', 'status_pagamento', { unique: false });
      }
      if (!db.objectStoreNames.contains('usuarios')) {
        db.createObjectStore('usuarios', { keyPath: 'id', autoIncrement: true });
      }
    };

    req.onsuccess = async (e) => {
      _db = e.target.result;
      await _seedAdmin();
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

async function _seedAdmin() {
  return new Promise((resolve) => {
    const tx = _db.transaction('usuarios', 'readwrite');
    const store = tx.objectStore('usuarios');
    const req = store.getAll();
    req.onsuccess = () => {
      if (!req.result || req.result.length === 0) {
        store.put({ id: 1, username: 'admin', password: 'admin123' });
      }
      resolve();
    };
    req.onerror = () => resolve();
  });
}

function dbGetAll(storeName) {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(storeName, id) {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(Number(id));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbAdd(storeName, data) {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(storeName, data) {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(storeName, id) {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(Number(id));
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbImportAll(jsonData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['alunas'], 'readwrite');
    const store = tx.objectStore('alunas');
    store.clear();
    if (Array.isArray(jsonData.alunas)) {
      for (const aluna of jsonData.alunas) {
        store.put(aluna);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
