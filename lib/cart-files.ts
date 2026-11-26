/**
 * Sepetteki fotoğraflar sipariş oluşturulana kadar yalnızca bu cihazda (IndexedDB) durur.
 * localStorage küçük olduğu için dosyalar burada, sepet satırlarında yalnızca kimlikleri tutulur.
 */

const DB_NAME = 'kartabaski';
const STORE = 'files';

export function newId(): string {
  // randomUUID yalnızca güvenli bağlamda var (yerel ağdan http ile açılınca yok).
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, job: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = job(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Dosyayı saklar, kimliğini döner. Safari için Blob yerine ham veri + tür yazılır. */
export async function saveFile(blob: Blob): Promise<string> {
  const id = newId();
  const data = await blob.arrayBuffer();
  await run('readwrite', (s) => s.put({ data, type: blob.type }, id));
  return id;
}

export async function loadFile(id: string): Promise<Blob | null> {
  const row = await run<{ data: ArrayBuffer; type: string } | undefined>('readonly', (s) => s.get(id));
  return row ? new Blob([row.data], { type: row.type }) : null;
}

export async function deleteFiles(ids: string[]): Promise<void> {
  await run('readwrite', (s) => { ids.forEach((id) => s.delete(id)); });
}
