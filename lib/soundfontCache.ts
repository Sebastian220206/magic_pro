import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'soundfont-cache'
const DB_VERSION = 1
const STORE_NAME = 'fonts'

export interface CachedFont {
  id: string
  data: ArrayBuffer
  version: string
  fileSize: number
  cachedAt: number
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('cachedAt', 'cachedAt')
        }
      },
    })
  }
  return dbPromise
}

export async function getCachedFont(fontId: string): Promise<CachedFont | undefined> {
  try {
    const db = await getDb()
    return await db.get(STORE_NAME, fontId)
  } catch {
    return undefined
  }
}

export async function setCachedFont(fontId: string, data: ArrayBuffer, version: string, fileSize: number): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, { id: fontId, data, version, fileSize, cachedAt: Date.now() })
}

export async function removeCachedFont(fontId: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete(STORE_NAME, fontId)
  } catch {
    // ignore
  }
}

export async function getCacheSize(): Promise<number> {
  try {
    const db = await getDb()
    const all = await db.getAll(STORE_NAME)
    return all.reduce((sum, f) => sum + f.fileSize, 0)
  } catch {
    return 0
  }
}

export async function pruneCache(maxBytes: number): Promise<void> {
  try {
    const db = await getDb()
    const index = db.transaction(STORE_NAME, 'readwrite').store.index('cachedAt')
    let cursor = await index.openCursor()
    const toDelete: string[] = []
    let total = 0
    while (cursor) {
      total += cursor.value.fileSize
      if (total > maxBytes) {
        toDelete.push(cursor.value.id)
      }
      cursor = await cursor.continue()
    }
    const tx = db.transaction(STORE_NAME, 'readwrite')
    for (const id of toDelete) {
      tx.store.delete(id)
    }
    await tx.done
  } catch {
    // ignore
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear(STORE_NAME)
  } catch {
    // ignore
  }
}
