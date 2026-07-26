/**
 * iHYPE DB — lib/db.js
 * IndexedDB-backed offline store with localStorage fallback.
 *
 * Stores:
 *   users      — cached user profiles
 *   events     — cached event records
 *   tickets    — user's ticket wallet (offline-readable)
 *   tracks     — free-use library cache
 *   feed_cache — listen / events feed snapshots
 *   kv         — generic key-value (prefs, flags, etc.)
 *
 * Usage:
 *   await db.tickets.getAll()
 *   await db.tickets.put(ticket)
 *   await db.kv.set('last_city', 'Los Angeles')
 *   await db.kv.get('last_city')
 *   await db.clear()  // full wipe (used by Settings → Reset)
 */

(function () {
  'use strict';

  const DB_NAME    = 'ihype_db';
  const DB_VERSION = 1;
  const STORES     = ['users','events','tickets','tracks','feed_cache','kv'];

  /* ── open / upgrade ──────────────────────────────────────────────── */
  let _db = null;

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  /* ── IDB transaction helpers ─────────────────────────────────────── */
  async function tx(storeName, mode, fn) {
    try {
      const db   = await openDB();
      const t    = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);
      return await new Promise((resolve, reject) => {
        const req    = fn(store);
        if (req && typeof req.onsuccess !== 'undefined') {
          req.onsuccess = e => resolve(e.target.result);
          req.onerror   = e => reject(e.target.error);
        } else {
          t.oncomplete = () => resolve(req);
          t.onerror    = e => reject(e.target.error);
        }
      });
    } catch (e) {
      // Fallback: IndexedDB unavailable — use localStorage
      return lsFallback(storeName, mode, fn);
    }
  }

  async function getAll(storeName) {
    try {
      const db    = await openDB();
      const t     = db.transaction(storeName, 'readonly');
      const store = t.objectStore(storeName);
      return await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
      });
    } catch {
      try { return Object.values(JSON.parse(localStorage.getItem('idb_' + storeName) || '{}')); } catch { return []; }
    }
  }

  async function getOne(storeName, id) {
    try {
      const db    = await openDB();
      const t     = db.transaction(storeName, 'readonly');
      const store = t.objectStore(storeName);
      return await new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = e => resolve(e.target.result || null);
        req.onerror   = e => reject(e.target.error);
      });
    } catch {
      try {
        const all = JSON.parse(localStorage.getItem('idb_' + storeName) || '{}');
        return all[id] || null;
      } catch { return null; }
    }
  }

  async function putOne(storeName, record) {
    if (!record || !record.id) throw new Error('putOne: record must have an id');
    try {
      const db    = await openDB();
      const t     = db.transaction(storeName, 'readwrite');
      const store = t.objectStore(storeName);
      return await new Promise((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
      });
    } catch {
      try {
        const all = JSON.parse(localStorage.getItem('idb_' + storeName) || '{}');
        all[record.id] = record;
        localStorage.setItem('idb_' + storeName, JSON.stringify(all));
        return record.id;
      } catch {}
    }
  }

  async function deleteOne(storeName, id) {
    try {
      const db    = await openDB();
      const t     = db.transaction(storeName, 'readwrite');
      const store = t.objectStore(storeName);
      return await new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror   = e => reject(e.target.error);
      });
    } catch {
      try {
        const all = JSON.parse(localStorage.getItem('idb_' + storeName) || '{}');
        delete all[id];
        localStorage.setItem('idb_' + storeName, JSON.stringify(all));
      } catch {}
    }
  }

  /* ── localStorage fallback ───────────────────────────────────────── */
  function lsFallback(storeName) {
    try { return Object.values(JSON.parse(localStorage.getItem('idb_' + storeName) || '{}')); }
    catch { return []; }
  }

  /* ── store API factory ───────────────────────────────────────────── */
  function makeStore(name) {
    return {
      getAll:    ()       => getAll(name),
      get:       (id)     => getOne(name, id),
      put:       (record) => putOne(name, record),
      delete:    (id)     => deleteOne(name, id),
      /** Upsert many records */
      putMany:   async (records) => { for (const r of records) await putOne(name, r); },
      /** Replace entire store */
      replaceAll: async (records) => {
        // Clear then put all
        const db    = await openDB().catch(() => null);
        if (db) {
          const t    = db.transaction(name, 'readwrite');
          const store = t.objectStore(name);
          await new Promise((res,rej) => { const r = store.clear(); r.onsuccess=res; r.onerror=rej; });
        } else {
          localStorage.setItem('idb_' + name, '{}');
        }
        for (const r of records) await putOne(name, r);
      },
    };
  }

  /* ── kv store (no keyPath — wrap with synthetic id) ─────────────── */
  const kv = {
    async get(key) {
      const rec = await getOne('kv', key);
      return rec ? rec.value : null;
    },
    async set(key, value) {
      return putOne('kv', { id: key, value, updated: Date.now() });
    },
    async delete(key) {
      return deleteOne('kv', key);
    },
  };

  /* ── feed cache helpers ──────────────────────────────────────────── */
  const feedCache = {
    async set(key, data, ttlMs = 5 * 60 * 1000) {
      return putOne('feed_cache', { id: key, data, expires: Date.now() + ttlMs });
    },
    async get(key) {
      const rec = await getOne('feed_cache', key);
      if (!rec || Date.now() > rec.expires) return null;
      return rec.data;
    },
    async invalidate(key) {
      return deleteOne('feed_cache', key);
    },
  };

  /* ── full clear (Settings → Reset app data) ──────────────────────── */
  async function clearAll() {
    try {
      const db = await openDB();
      for (const name of STORES) {
        const t    = db.transaction(name, 'readwrite');
        const s    = t.objectStore(name);
        await new Promise((res, rej) => { const r = s.clear(); r.onsuccess = res; r.onerror = rej; });
      }
    } catch {}
    // Also clear relevant localStorage keys
    const keep = []; // preserve nothing on full reset
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('ihype_') || key.startsWith('idb_')) {
        localStorage.removeItem(key);
      }
    }
  }

  /* ── snapshot: dump everything to a plain object (for debug) ──────── */
  async function snapshot() {
    const out = {};
    for (const name of STORES) {
      out[name] = await getAll(name);
    }
    return out;
  }

  /* ── public DB object ────────────────────────────────────────────── */
  window.IHYPE_DB = {
    users:      makeStore('users'),
    events:     makeStore('events'),
    tickets:    makeStore('tickets'),
    tracks:     makeStore('tracks'),
    feedCache,
    kv,
    clear:      clearAll,
    snapshot,
    /** Seed the DB with IHYPE_DATA mock records (call once on first load) */
    async seedFromMockData() {
      const D = window.IHYPE_DATA;
      if (!D) return;
      if (D.artists) await makeStore('users').putMany(
        D.artists.map(a => ({ id: a.id || a.name, ...a }))
      );
      if (D.events)  await makeStore('events').putMany(
        D.events.map(e => ({ id: e.id || e.title, ...e }))
      );
      if (D.tracks)  await makeStore('tracks').putMany(
        D.tracks.map(t => ({ id: t.id || t.title, ...t }))
      );
      await kv.set('db_seeded', true);
    },
  };

  console.info('[iHYPE DB] IndexedDB store ready:', DB_NAME, 'v' + DB_VERSION);
})();
