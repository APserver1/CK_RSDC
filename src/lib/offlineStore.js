import { chequesTable, supabase } from './supabase'

const DB_NAME = 'ck-rsdc-offline'
const DB_VERSION = 1
const CHEQUES_SNAPSHOT = 'ck-rsdc-cheques-snapshot'
const SEQUENCES_SNAPSHOT = 'ck-rsdc-sequences'
const STORES = { cheques: 'cheques', personnel: 'personnel', lookups: 'lookups', queue: 'queue' }
let syncing = false

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORES.cheques)) db.createObjectStore(STORES.cheques, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.personnel)) db.createObjectStore(STORES.personnel, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.lookups)) db.createObjectStore(STORES.lookups, { keyPath: 'key' })
      if (!db.objectStoreNames.contains(STORES.queue)) db.createObjectStore(STORES.queue, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function storeRequest(storeName, mode, action) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = action(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
  })
}

const getAll = store => storeRequest(store, 'readonly', objectStore => objectStore.getAll())
const getOne = (store, key) => storeRequest(store, 'readonly', objectStore => objectStore.get(key))
const putOne = (store, value) => storeRequest(store, 'readwrite', objectStore => objectStore.put(value))
const deleteOne = (store, key) => storeRequest(store, 'readwrite', objectStore => objectStore.delete(key))

function localId() {
  return `local-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

function notify() {
  window.dispatchEvent(new CustomEvent('offline-data-changed'))
}

async function pendingCount() {
  return (await getAll(STORES.queue)).length
}

async function emitSyncState() {
  window.dispatchEvent(new CustomEvent('offline-sync-state', { detail: { online: navigator.onLine, pending: await pendingCount(), syncing } }))
}

function sortCheques(items) {
  return items.sort((a, b) => String(b.created_at || b.fecha_emision || '').localeCompare(String(a.created_at || a.fecha_emision || '')))
}

function readLocalSnapshot(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function writeLocalSnapshot(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* IndexedDB sigue siendo la copia principal. */ }
}

export function getImmediateChequeSnapshot() {
  return sortCheques(readLocalSnapshot(CHEQUES_SNAPSHOT, []))
}

export function getImmediateChequeSequences() {
  return readLocalSnapshot(SEQUENCES_SNAPSHOT, { cheque: 0, comprobante: 0 })
}

function updateSequences(records) {
  const previous = readLocalSnapshot(SEQUENCES_SNAPSHOT, { cheque: 0, comprobante: 0 })
  const next = records.reduce((result, item) => {
    result.cheque = Math.max(result.cheque, Number(String(item.numero_cheque || '').replace(/\D/g, '')) || 0)
    try {
      const stored = item.concepto ? JSON.parse(item.concepto) : {}
      result.comprobante = Math.max(result.comprobante, Number(item.comprobante || stored?.setup?.comprobante) || 0)
    } catch { result.comprobante = Math.max(result.comprobante, Number(item.comprobante) || 0) }
    return result
  }, { ...previous })
  writeLocalSnapshot(SEQUENCES_SNAPSHOT, next)
  return next
}

async function persistChequeSnapshot() {
  const records = sortCheques(await getAll(STORES.cheques))
  writeLocalSnapshot(CHEQUES_SNAPSHOT, records)
  updateSequences(records)
}

async function cacheRemoteCheques(remote) {
  const cached = await getAll(STORES.cheques)
  const pendingIds = new Set(cached.filter(item => item._sync_status === 'pending').map(item => item.id))
  await Promise.all(remote.filter(item => !pendingIds.has(item.id)).map(item => putOne(STORES.cheques, { ...item, _sync_status: 'synced' })))
  await persistChequeSnapshot()
}

export async function getCachedCheques() {
  const indexed = await getAll(STORES.cheques)
  const snapshot = readLocalSnapshot(CHEQUES_SNAPSHOT, [])
  const merged = new Map(snapshot.map(item => [item.id, item]))
  indexed.forEach(item => merged.set(item.id, item))
  const records = sortCheques([...merged.values()])
  updateSequences(records)
  return records
}

export async function getChequeSequences() {
  const records = await getCachedCheques()
  return updateSequences(records)
}

function filterCheques(records, { limit, month, year = 2026 } = {}) {
  let filtered = records
  if (month) filtered = filtered.filter(item => {
    const date = String(item.fecha_emision || '')
    return date.startsWith(`${year}-${String(month).padStart(2, '0')}-`)
  })
  return limit ? filtered.slice(0, limit) : filtered
}

async function fetchRemoteCheques({ month, year = 2026 } = {}) {
  let remoteError = null
  if (navigator.onLine && supabase) {
    let query = supabase.from(chequesTable).select('*').order('created_at', { ascending: false })
    if (month) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`
      const end = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
      query = query.gte('fecha_emision', start).lt('fecha_emision', end)
    }
    const result = await query
    if (!result.error) await cacheRemoteCheques(result.data || [])
    else remoteError = result.error
  }
  return remoteError
}

export async function fetchCheques({ limit, month, year = 2026, forceNetwork = false } = {}) {
  const cached = await getCachedCheques()
  if (cached.length && !forceNetwork) {
    if (navigator.onLine && supabase) fetchRemoteCheques({ month, year }).catch(() => {})
    return { data: filterCheques(cached, { limit, month, year }), error: null, offline: !navigator.onLine }
  }
  const remoteError = await fetchRemoteCheques({ month, year })
  const records = await getCachedCheques()
  return { data: filterCheques(records, { limit, month, year }), error: remoteError, offline: !navigator.onLine || Boolean(remoteError) }
}

export async function getCheque(id) {
  const cached = await getOne(STORES.cheques, id)
  if (cached) return { data: cached }
  const alias = await getOne(STORES.lookups, `cheque-alias:${id}`)
  if (alias?.data) return getCheque(alias.data)
  if (!navigator.onLine || !supabase || String(id).startsWith('local-')) return { data: null, error: new Error('Cheque no disponible localmente') }
  const result = await supabase.from(chequesTable).select('*').eq('id', id).single()
  if (result.data) await putOne(STORES.cheques, { ...result.data, _sync_status: 'synced' })
  return result
}

async function queueOperation(operation) {
  await putOne(STORES.queue, { ...operation, queued_at: new Date().toISOString() })
  await emitSyncState()
  notify()
}

export async function saveChequeOffline(payload, id) {
  const originalId = id
  const alias = id ? await getOne(STORES.lookups, `cheque-alias:${id}`) : null
  if (alias?.data) id = alias.data
  const isLocal = !id || (String(id).startsWith('local-') && !alias?.data)
  if (navigator.onLine && supabase) {
    const result = isLocal
      ? await supabase.from(chequesTable).insert(payload).select('*').single()
      : await supabase.from(chequesTable).update(payload).eq('id', id).select('*').single()
    if (!result.error && result.data) {
      if (id && id !== result.data.id) await deleteOne(STORES.cheques, id)
      if (originalId && originalId !== result.data.id) await putOne(STORES.lookups, { key: `cheque-alias:${originalId}`, data: result.data.id })
      await putOne(STORES.cheques, { ...result.data, _sync_status: 'synced' })
      await persistChequeSnapshot()
      notify()
      return { data: result.data, offline: false }
    }
  }
  const recordId = id || localId()
  const previous = await getOne(STORES.cheques, recordId)
  const record = { ...previous, ...payload, id: recordId, created_at: previous?.created_at || new Date().toISOString(), updated_at: new Date().toISOString(), _sync_status: 'pending' }
  await putOne(STORES.cheques, record)
  await persistChequeSnapshot()
  await queueOperation({ key: `cheque:${recordId}`, entity: 'cheque', action: 'save', local_id: recordId, payload })
  return { data: record, offline: true }
}

export async function deleteChequeOffline(id) {
  const record = await getOne(STORES.cheques, id)
  await deleteOne(STORES.cheques, id)
  await persistChequeSnapshot()
  if (String(id).startsWith('local-')) await deleteOne(STORES.queue, `cheque:${id}`)
  else if (navigator.onLine && supabase) {
    const { error } = await supabase.from(chequesTable).delete().eq('id', id)
    if (error) await queueOperation({ key: `cheque:${id}`, entity: 'cheque', action: 'delete', remote_id: id })
  } else await queueOperation({ key: `cheque:${id}`, entity: 'cheque', action: 'delete', remote_id: id, payload: record })
  notify()
}

export async function fetchPersonnel({ forceNetwork = false } = {}) {
  const cached = await getAll(STORES.personnel)
  if (cached.length && !forceNetwork) {
    if (navigator.onLine && supabase) supabase.from('ck_personal').select('*').order('uso_count', { ascending: false }).order('nombre').then(result => {
      if (!result.error) Promise.all((result.data || []).map(item => putOne(STORES.personnel, { ...item, _sync_status: 'synced' })))
    })
    return cached
  }
  if (navigator.onLine && supabase) {
    const result = await supabase.from('ck_personal').select('*').order('uso_count', { ascending: false }).order('nombre')
    if (!result.error) await Promise.all((result.data || []).map(item => putOne(STORES.personnel, { ...item, _sync_status: 'synced' })))
  }
  return getAll(STORES.personnel)
}

export async function savePersonOffline(payload, id) {
  const recordId = id || localId()
  if (navigator.onLine && supabase) {
    const result = id && !String(id).startsWith('local-')
      ? await supabase.from('ck_personal').update(payload).eq('id', id).select().single()
      : await supabase.from('ck_personal').insert(payload).select().single()
    if (!result.error && result.data) {
      if (recordId !== result.data.id) await deleteOne(STORES.personnel, recordId)
      await putOne(STORES.personnel, { ...result.data, _sync_status: 'synced' })
      notify()
      return { data: result.data, offline: false }
    }
  }
  const record = { ...payload, id: recordId, created_at: new Date().toISOString(), _sync_status: 'pending' }
  await putOne(STORES.personnel, record)
  await queueOperation({ key: `person:${recordId}`, entity: 'person', action: 'save', local_id: recordId, payload })
  return { data: record, offline: true }
}

export async function cacheLookup(key, data) {
  await putOne(STORES.lookups, { key, data, updated_at: new Date().toISOString() })
  return data
}

export async function getCachedLookup(key, fallback = null) {
  return (await getOne(STORES.lookups, key))?.data ?? fallback
}

export async function fetchAndCacheLookup(key, fetcher, fallback = null) {
  if (navigator.onLine) {
    try {
      const data = await fetcher()
      if (data != null) return cacheLookup(key, data)
    } catch { /* Se usa la copia local. */ }
  }
  return getCachedLookup(key, fallback)
}

export async function preloadIncomeCodes() {
  if (!navigator.onLine || !supabase) return
  const { data, error } = await supabase.from('income_codes').select('code, description')
  if (error) return
  await Promise.all((data || []).map(item => cacheLookup(`income-code:${String(item.code).trim()}`, { description: item.description })))
}

export async function syncPending() {
  if (syncing || !navigator.onLine || !supabase) return
  syncing = true
  await emitSyncState()
  const queue = await getAll(STORES.queue)
  for (const item of queue.sort((a, b) => String(a.queued_at).localeCompare(String(b.queued_at)))) {
    try {
      if (item.entity === 'cheque' && item.action === 'save') {
        const local = await getOne(STORES.cheques, item.local_id)
        if (!local) { await deleteOne(STORES.queue, item.key); continue }
        const payload = item.payload
        const result = String(item.local_id).startsWith('local-')
          ? await supabase.from(chequesTable).insert(payload).select('*').single()
          : await supabase.from(chequesTable).update(payload).eq('id', item.local_id).select('*').single()
        if (result.error) continue
        await deleteOne(STORES.cheques, item.local_id)
        await putOne(STORES.cheques, { ...result.data, _sync_status: 'synced' })
        await persistChequeSnapshot()
        if (item.local_id !== result.data.id) await putOne(STORES.lookups, { key: `cheque-alias:${item.local_id}`, data: result.data.id })
        await deleteOne(STORES.queue, item.key)
      } else if (item.entity === 'cheque' && item.action === 'delete') {
        const { error } = await supabase.from(chequesTable).delete().eq('id', item.remote_id)
        if (!error) await deleteOne(STORES.queue, item.key)
      } else if (item.entity === 'person' && item.action === 'save') {
        const result = String(item.local_id).startsWith('local-')
          ? await supabase.from('ck_personal').insert(item.payload).select().single()
          : await supabase.from('ck_personal').update(item.payload).eq('id', item.local_id).select().single()
        if (result.error) continue
        await deleteOne(STORES.personnel, item.local_id)
        await putOne(STORES.personnel, { ...result.data, _sync_status: 'synced' })
        await deleteOne(STORES.queue, item.key)
      }
    } catch { /* La operación queda pendiente para el próximo intento. */ }
  }
  syncing = false
  await emitSyncState()
  notify()
}

export async function getOfflineState() {
  return { online: navigator.onLine, pending: await pendingCount(), syncing }
}

export function initializeOfflineSync() {
  const onOnline = () => { emitSyncState(); syncPending() }
  const onOffline = () => emitSyncState()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  emitSyncState()
  if (navigator.onLine) syncPending()
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}
