/**
 * IndexedDB adapter with versioned, ADDITIVE-ONLY migrations.
 *
 * Rules (see docs/DATA_MODEL.md):
 *  - The database version equals MIGRATIONS.length.
 *  - Never edit or remove a shipped migration; append a new one.
 *  - Migrations may create stores/indexes or transform records in place.
 *    They must never delete a store that holds user data.
 */

export const DB_NAME = 'hercules';

const DATED_STORES = ['hydrationLogs', 'bodyMetrics', 'workouts', 'foodLogs', 'recoveryLogs'];

/** @type {Array<(db: IDBDatabase, tx: IDBTransaction) => void>} */
export const MIGRATIONS = [
  // v1 — Foundation: create every store the roadmap needs.
  (db) => {
    const make = (name, indexes = []) => {
      if (db.objectStoreNames.contains(name)) return;
      const s = db.createObjectStore(name, { keyPath: 'id' });
      for (const [idx, keyPath] of indexes) s.createIndex(idx, keyPath);
      s.createIndex('byUpdatedAt', 'updatedAt');
    };
    make('meta');
    make('settings');
    make('profile');
    make('exercises');
    make('foods');
    make('schedules');
    for (const s of DATED_STORES) make(s, [['byDate', 'date']]);
  },

  // v2 — Phases 2–4 + Kratos: templates, coach state, coach messages.
  //       Switch the display-unit preference to US customary (oz/lb/in), as
  //       requested. Stored values are metric and are NOT modified.
  (db, tx) => {
    const make = (name, indexes = []) => {
      if (db.objectStoreNames.contains(name)) return;
      const s = db.createObjectStore(name, { keyPath: 'id' });
      for (const [idx, keyPath] of indexes) s.createIndex(idx, keyPath);
      s.createIndex('byUpdatedAt', 'updatedAt');
    };
    make('templates');
    make('coach');
    make('coachMessages', [['byDate', 'date']]);
    const settings = tx.objectStore('settings');
    const req = settings.get('settings');
    req.onsuccess = () => {
      const s = req.result;
      if (s && s.units !== 'imperial') {
        settings.put({ ...s, units: 'imperial', updatedAt: new Date().toISOString(), rev: s.rev + 1 });
      }
    };
  },
];

export const SCHEMA_VERSION = MIGRATIONS.length;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB is not available in this browser.'));
    const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      const tx = req.transaction;
      for (let v = e.oldVersion; v < SCHEMA_VERSION; v++) MIGRATIONS[v](db, tx);
      tx.objectStore('meta').put({ id: 'schema', version: SCHEMA_VERSION, migratedAt: new Date().toISOString() });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgraded the schema: close so the upgrade can proceed, then reload.
      db.onversionchange = () => { db.close(); location.reload(); };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Hercules is open in another tab with an older version. Close it and reload.'));
  });
  return dbPromise;
}

const promisify = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

async function run(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let result;
    Promise.resolve(fn(tx.objectStore(store))).then((r) => { result = r; }, reject);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export const get = (store, id) => run(store, 'readonly', (s) => promisify(s.get(id)));
export const getAll = (store) => run(store, 'readonly', (s) => promisify(s.getAll()));
export const count = (store) => run(store, 'readonly', (s) => promisify(s.count()));
export const put = (store, record) => run(store, 'readwrite', (s) => promisify(s.put(record)));

/** Write many records in ONE transaction: all succeed or none do. */
export const putMany = (store, records) => run(store, 'readwrite', (s) => Promise.all(records.map((r) => promisify(s.put(r)))));

export const getByDateRange = (store, from, to) =>
  run(store, 'readonly', (s) => promisify(s.index('byDate').getAll(IDBKeyRange.bound(from, to))));

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistence() {
  if (!navigator.storage?.persist) return null;
  return navigator.storage.persist();
}
export async function isPersisted() {
  if (!navigator.storage?.persisted) return null;
  return navigator.storage.persisted();
}
