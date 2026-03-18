import { openDB } from 'idb';
const DB_NAME = 'opd_loggerx_db';
const DB_VER = 1;

export async function getDb(){
  return openDB(DB_NAME, DB_VER, {
    upgrade(db){
      if(!db.objectStoreNames.contains('visits')){
        const store = db.createObjectStore('visits', { keyPath: 'id' });
        store.createIndex('byDate', 'visitDate');
      }
      if(!db.objectStoreNames.contains('settings')){
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    }
  });
}

export function uid(){
  return crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36)+Math.random().toString(36).slice(2));
}

export async function getSetting(key, fallback=null){
  const db = await getDb();
  const row = await db.get('settings', key);
  return row?.value ?? fallback;
}
export async function setSetting(key, value){
  const db = await getDb();
  await db.put('settings', { key, value });
}

export async function upsertVisit(visit){
  const db = await getDb();
  await db.put('visits', visit);
}
export async function deleteVisit(id){
  const db = await getDb();
  await db.delete('visits', id);
}

export async function listVisitsByDate(date){
  const db = await getDb();
  const idx = db.transaction('visits').store.index('byDate');
  const rows = await idx.getAll(date);
  rows.sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  return rows;
}

export async function listAllDates(){
  const db = await getDb();
  const all = await db.getAll('visits');
  const set = new Set(all.map(v=>v.visitDate));
  return Array.from(set).sort().reverse();
}

export async function clearDay(date){
  const db = await getDb();
  const tx = db.transaction('visits','readwrite');
  const idx = tx.store.index('byDate');
  let cursor = await idx.openCursor(date);
  while(cursor){
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function exportBackup(){
  const db = await getDb();
  return {
    version:'1.2.0',
    exportedAt: new Date().toISOString(),
    visits: await db.getAll('visits'),
    settings: await db.getAll('settings')
  };
}

export async function importBackup(obj){
  const db = await getDb();
  const tx = db.transaction(['visits','settings'],'readwrite');
  await tx.objectStore('visits').clear();
  await tx.objectStore('settings').clear();
  for(const v of (obj.visits||[])) await tx.objectStore('visits').put(v);
  for(const s of (obj.settings||[])) await tx.objectStore('settings').put(s);
  await tx.done;
}
