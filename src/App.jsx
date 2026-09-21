import React, { useEffect, useState, createContext, useContext } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase, chequesTable } from './lib/supabase'
import ChequeEditor from './pages/ChequeEditor'
import Personnel from './pages/Personnel'
import { deleteChequeOffline, fetchCheques, fetchPersonnel, getOfflineState, initializeOfflineSync, preloadIncomeCodes, syncPending } from './lib/offlineStore'

const Icon = ({ name, size = 20 }) => {
  const paths = { menu: 'M4 6h16M4 12h16M4 18h16', grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', file: 'M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h6', folder: 'M3 6h6l2 2h10v11H3z', plus: 'M12 5v14M5 12h14', settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.5V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6.3v-2.5h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9-.3 1.7 1.7 0 0 0 1-1.6v-.2H15v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.5h-.2a1.7 1.7 0 0 0-1.6 1Z', logout: 'M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-5' }
  const path = name === 'refresh' ? 'M20 11a8 8 0 0 0-14.7-3.9L4 9M4 5v4h4M4 13a8 8 0 0 0 14.7 3.9L20 15M20 19v-4h-4' : paths[name]
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
}

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  useEffect(() => initializeOfflineSync(), [])
  useEffect(() => { if (session && navigator.onLine) Promise.all([fetchCheques(), fetchPersonnel(), preloadIncomeCodes()]) }, [session])
  useEffect(() => {
    if (!supabase) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])
  const signOut = () => supabase?.auth.signOut()
  return <AuthContext.Provider value={{ session, signOut }}>{children}</AuthContext.Provider>
}

function Protected({ children }) {
  const { session } = useAuth(); const location = useLocation()
  if (session === undefined) return <div className="loading"><span className="spinner" />Cargando tu espacio…</div>
  return session ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

function Layout({ children }) {
  const { session, signOut } = useAuth(); const navigate = useNavigate(); const [open, setOpen] = useState(false)
  const email = session?.user?.email || ''; const initials = email.slice(0, 2).toUpperCase()
  const links = [{ to: '/', label: 'Dashboard', icon: 'grid' }, { to: '/carpetas', label: 'Carpetas', icon: 'folder' }, { to: '/personal', label: 'Personal', icon: 'file' }, { to: '/terminos', label: 'Términos y condiciones', icon: 'file' }, { to: '/ajustes', label: 'Ajustes', icon: 'settings' }]
  return <div className="app-shell">
    <header className="topbar"><button className="icon-button" onClick={() => setOpen(true)} aria-label="Abrir menú"><Icon name="menu" /></button><button className="brand brand-button" onClick={() => navigate(session ? '/' : '/login')}>CHEQUES <span>RSDC</span></button><div className="user-chip"><div className="avatar">{initials}</div><span>{email}</span><button className="logout-link" onClick={() => { signOut(); navigate('/login') }}>Salir</button></div></header>
    <div className={`overlay ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />
    <aside className={`drawer ${open ? 'open' : ''}`}><div className="drawer-head"><button className="brand brand-button" onClick={() => { navigate(session ? '/' : '/login'); setOpen(false) }}>CHEQUES <span>RSDC</span></button><button className="close-button" onClick={() => setOpen(false)}>×</button></div><p className="eyebrow">NAVEGACIÓN PRINCIPAL</p><nav>{links.map(link => <button key={link.to} onClick={() => { navigate(link.to); setOpen(false) }}><Icon name={link.icon} />{link.label}</button>)}</nav><div className="drawer-foot"><div className="avatar">{initials}</div><div><strong>{email || 'Usuario'}</strong><small>Cuenta activa</small></div></div></aside>
    <main>{children}</main>
  </div>
}

function useOfflineState() {
  const [state, setState] = useState({ online: navigator.onLine, pending: 0, syncing: false })
  useEffect(() => {
    const refresh = event => event?.detail ? setState(event.detail) : getOfflineState().then(setState)
    window.addEventListener('offline-sync-state', refresh)
    window.addEventListener('offline-data-changed', refresh)
    refresh()
    return () => { window.removeEventListener('offline-sync-state', refresh); window.removeEventListener('offline-data-changed', refresh) }
  }, [])
  return state
}

const dashboardCache = { data: null }
const monthCache = new Map()
function Dashboard() { const navigate = useNavigate()
  const connection = useOfflineState()
  const { session } = useAuth(); const [cheques, setCheques] = useState(dashboardCache.data || []); const [loading, setLoading] = useState(dashboardCache.data === null); const [error, setError] = useState(''); const [menu, setMenu] = useState(null); const [confirmDelete, setConfirmDelete] = useState(null); const [deleting, setDeleting] = useState(false)
  const loadCheques = async (forceNetwork = false) => { setLoading(true); setError(''); const { data, error: err } = await fetchCheques({ limit: 5, forceNetwork }); if (err && !data.length) setError('No hay datos locales disponibles todavía.'); dashboardCache.data = data || []; setCheques(data || []); setLoading(false) }
  useEffect(() => { loadCheques() }, [])
  useEffect(() => { const refresh = () => loadCheques(); window.addEventListener('offline-data-changed', refresh); return () => window.removeEventListener('offline-data-changed', refresh) }, [])
  useEffect(() => {
    const status = document.querySelector('.status-pill')
    if (!status || status.querySelector('.refresh-button')) return undefined
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'refresh-button'
    Object.assign(button.style, { width: '34px', height: '34px', padding: '0', border: '1px solid #c79a57', borderRadius: '50%', background: '#fffaf1', color: '#a97938', display: 'grid', placeItems: 'center', fontSize: '22px', lineHeight: '1' })
    button.setAttribute('aria-label', 'Recargar datos')
    button.title = 'Recargar datos'
    button.innerHTML = '<span aria-hidden="true">↻</span>'
    const refresh = async () => { await syncPending(); await loadCheques(true) }
    button.addEventListener('click', refresh)
    status.parentElement.insertBefore(button, status)
    return () => { button.removeEventListener('click', refresh); button.remove() }
  }, [])
  useEffect(() => {
    const button = document.querySelector('.refresh-button')
    if (button) { button.disabled = loading; button.classList.toggle('is-loading', loading) }
  }, [loading])
  useEffect(() => {
    const status = document.querySelector('.status-pill')
    if (!status) return
    status.classList.toggle('offline', !connection.online)
    status.innerHTML = `<i></i> ${connection.online ? (connection.syncing ? 'Sincronizando…' : 'Conectado') : 'Sin conexión'}${connection.pending ? ` · ${connection.pending} pendiente${connection.pending === 1 ? '' : 's'}` : ''}`
  }, [connection])
  useEffect(() => {
    document.querySelectorAll('.content-card tbody tr').forEach((row, index) => {
      const pending = cheques[index]?._sync_status === 'pending'
      row.classList.toggle('local-record', pending)
      const tag = row.querySelector('.tag')
      if (tag) tag.textContent = pending ? 'Pendiente' : 'Guardado'
    })
  }, [cheques])
  const removeCheque = async () => { if (!confirmDelete) return; setDeleting(true); await deleteChequeOffline(confirmDelete.id); setCheques(current => current.filter(item => item.id !== confirmDelete.id)); setConfirmDelete(null); setDeleting(false) }
  const name = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Usuario'
  return <Layout><section className="page"><div className="welcome"><div><p className="eyebrow">RESUMEN GENERAL · {new Date().toLocaleDateString('es-HN', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</p><h1>Hola, {name.split(' ')[0]} <span>✦</span></h1><p className="muted">Aquí tienes una vista clara de la operación de tus cheques.</p></div><div className="welcome-actions"><div className="status-pill"><i /> Sistema operativo</div><button className="primary-button small-button" onClick={() => window.location.href = '/nuevo-cheque'}><Icon name="plus" size={16} /> Nuevo cheque</button></div></div><div className="metrics single-metric"><Metric label="Cheques registrados" value={cheques.length || '—'} note="En tu espacio" /></div><section className="content-card"><div className="card-heading"><div><p className="eyebrow">ACTIVIDAD RECIENTE</p><h2>Últimos cheques</h2></div><button className="text-button" onClick={() => window.location.href = '/carpetas'}>Ver todos <span>→</span></button></div>{error && <div className="notice">{error} Revisa las variables de entorno y las políticas RLS de Supabase.</div>}{!error && cheques.length === 0 ? <EmptyState /> : <div className="table-wrap"><table><thead><tr><th>Referencia</th><th>Fecha</th><th>Beneficiario</th><th>Monto</th><th>Estado</th></tr></thead><tbody>{cheques.map((item, index) => <tr key={item.id || index} className="clickable-check" onClick={() => item.id && navigate(`/editar-cheque/${item.id}`)} onContextMenu={event => { event.preventDefault(); setMenu({ item, x: event.clientX, y: event.clientY }) }}><td><strong>#{item.numero_cheque || item.id || '—'}</strong></td><td>{item.fecha_emision ? new Date(item.fecha_emision).toLocaleDateString('es-HN') : '—'}</td><td>{item.beneficiario || '—'}</td><td>{item.monto ? `${Number(item.monto).toLocaleString('es-HN', { minimumFractionDigits: 2 })} ${item.moneda || 'HNL'}` : '—'}</td><td><span className="tag">{item.estado || 'Registrado'}</span></td></tr>)}</tbody></table></div>}</section><ChequeMenu item={menu?.item} position={menu} onOpen={() => navigate(`/editar-cheque/${menu.item.id}`)} onDelete={() => setConfirmDelete(menu.item)} onClose={() => setMenu(null)} /><DeleteDialog item={confirmDelete} busy={deleting} onConfirm={removeCheque} onCancel={() => setConfirmDelete(null)} /></section></Layout>
}
function Metric({ label, value, note }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div> }
function EmptyState() { return <div className="empty"><div className="empty-icon"><Icon name="file" size={27} /></div><h3>Aún no hay actividad</h3><p>Cuando se registren cheques en tu base de datos, aparecerán aquí.</p></div> }
function DataLoading() { return <div className="data-loading"><span className="spinner" />Actualizando información…</div> }

function ChequeMenu({ item, position, onOpen, onDelete, onClose }) {
  if (!position) return null
  return <div className="cheque-context-menu" style={{ left: position.x, top: position.y }} onClick={event => event.stopPropagation()}><button onClick={() => { onOpen(); onClose() }}>Abrir</button><button className="danger-action" onClick={() => { onDelete(); onClose() }}>Eliminar</button></div>
}
function DeleteDialog({ item, busy, onConfirm, onCancel }) {
  if (!item) return null
  return <div className="confirm-overlay" onClick={onCancel}><div className="confirm-dialog" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><p className="eyebrow">ELIMINAR CHEQUE</p><h2>¿Está seguro?</h2><p>Se eliminará el cheque <strong>#{item.numero_cheque || item.id}</strong>. Esta acción no se puede deshacer.</p><div className="confirm-actions"><button className="cancel-button" onClick={onCancel}>Cancelar</button><button className="delete-button" onClick={onConfirm} disabled={busy}>{busy ? 'Eliminando…' : 'Confirmar'}</button></div></div></div>
}

const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
function Folders() { return <Layout><section className="page"><div className="page-heading"><div><p className="eyebrow">EXPLORADOR</p><h1>Carpetas</h1><p className="muted">Organiza tus cheques por año y mes.</p></div><button className="primary-button small-button" onClick={() => window.location.href = '/nuevo-cheque'}><Icon name="plus" size={16} /> Nuevo cheque</button></div><div className="year-card"><div className="folder-icon"><Icon name="folder" size={26} /></div><div><p className="eyebrow">AÑO ACTIVO</p><h2>2026</h2><p className="muted">12 carpetas mensuales</p></div></div><div className="month-grid">{months.map((month, index) => <button className="month-card" key={month} onClick={() => window.location.href = `/carpetas/2026/${index + 1}`}><div className="folder-icon small"><Icon name="folder" size={21} /></div><div><strong>{month}</strong><small>Ver cheques</small></div><span>→</span></button>)}</div></section></Layout> }
function MonthFolder() { const navigate = useNavigate(); const { month } = useParams(); const monthNumber = Number(month); const monthName = months[monthNumber - 1] || 'Mes'; const cached = monthCache.get(monthNumber); const [cheques, setCheques] = useState(cached || []); const [loading, setLoading] = useState(!cached); const [error, setError] = useState(''); const [menu, setMenu] = useState(null); const [confirmDelete, setConfirmDelete] = useState(null); const [deleting, setDeleting] = useState(false)
  const loadMonth = async () => { if (!monthNumber) return; setLoading(true); const { data, error: err } = await fetchCheques({ month: monthNumber, year: 2026 }); if (err && !data.length) setError('No hay datos locales disponibles para esta carpeta.'); else setError(''); monthCache.set(monthNumber, data || []); setCheques(data || []); setLoading(false) }
  useEffect(() => { loadMonth(); const refresh = () => loadMonth(); window.addEventListener('offline-data-changed', refresh); return () => window.removeEventListener('offline-data-changed', refresh) }, [monthNumber])
  useEffect(() => { document.querySelectorAll('.folder-list .check-row').forEach((row, index) => { const pending = cheques[index]?._sync_status === 'pending'; row.classList.toggle('local-record', pending); const tag = row.querySelector('.tag'); if (tag) tag.textContent = pending ? 'Pendiente' : 'Guardado' }) }, [cheques])
  const removeCheque = async () => { if (!confirmDelete) return; setDeleting(true); await deleteChequeOffline(confirmDelete.id); setCheques(current => current.filter(item => item.id !== confirmDelete.id)); setConfirmDelete(null); setDeleting(false) }
  return <Layout><section className="page"><button className="back-button" onClick={() => window.location.href = '/carpetas'}>← Carpetas</button><div className="page-heading"><div><p className="eyebrow">2026 / {monthName.toUpperCase()}</p><h1>{monthName}</h1><p className="muted">Cheques emitidos durante este mes.</p></div><button className="primary-button small-button" onClick={() => window.location.href = '/nuevo-cheque'}><Icon name="plus" size={16} /> Nuevo cheque</button></div><section className="content-card folder-list">{error && <div className="notice">{error}</div>}{!error && cheques.length === 0 ? <EmptyState /> : <div className="simple-list">{cheques.map((item, index) => <div className="check-row clickable-check" key={item.id || index} onClick={() => item.id && navigate(`/editar-cheque/${item.id}`)} onContextMenu={event => { event.preventDefault(); setMenu({ item, x: event.clientX, y: event.clientY }) }}><div className="folder-icon small"><Icon name="file" size={20} /></div><div><strong>#{item.numero_cheque || item.id}</strong><span>{item.beneficiario}</span></div><div className="row-date">{item.fecha_emision ? new Date(`${item.fecha_emision}T12:00:00`).toLocaleDateString('es-HN') : '—'}</div><span className="tag">{item.estado || 'Registrado'}</span></div>)}</div>}<ChequeMenu item={menu?.item} position={menu} onOpen={() => navigate(`/editar-cheque/${menu.item.id}`)} onDelete={() => setConfirmDelete(menu.item)} onClose={() => setMenu(null)} /><DeleteDialog item={confirmDelete} busy={deleting} onConfirm={removeCheque} onCancel={() => setConfirmDelete(null)} /></section></section></Layout> }
function NewCheque() { return <Layout><section className="page narrow"><button className="back-button" onClick={() => window.history.back()}>← Regresar</button><p className="eyebrow">REGISTRO</p><h1>Nuevo cheque</h1><p className="lead">Aquí podrás registrar un nuevo cheque. El editor se completará en la siguiente etapa.</p><div className="editor-placeholder"><div className="empty-icon"><Icon name="file" size={27} /></div><h3>Editor de cheques</h3><p>La estructura del editor está lista para incorporar los campos y flujo que definas.</p></div></section></Layout> }

function Login() { const { session } = useAuth(); const [mode, setMode] = useState('login'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const navigate = useNavigate()
  if (session) return <Navigate to="/" replace />
  const submit = async e => { e.preventDefault(); setBusy(true); setMessage(''); if (!supabase) { setMessage('Falta configurar Supabase. Copia .env.example a .env.local y agrega tu clave anon.'); setBusy(false); return } const result = mode === 'login' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } }); if (result.error) setMessage(result.error.message); else { setMessage(mode === 'login' ? 'Acceso correcto.' : 'Revisa tu correo para confirmar tu cuenta.'); if (mode === 'login') navigate('/') } setBusy(false) }
  return <div className="auth-page"><div className="auth-art"><div className="art-mark">✦</div><div><div className="brand light">CHEQUES <span>RSDC</span></div><h1>Claridad para cada<br /><em>movimiento.</em></h1><p>Una forma más simple de cuidar y controlar la operación de tus cheques.</p></div><div className="art-footer">CONTROL · CONFIANZA · CLARIDAD</div></div><div className="auth-panel"><div className="auth-form"><p className="eyebrow">BIENVENIDO A RSDC</p><h2>{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h2><p className="muted">{mode === 'login' ? 'Ingresa tus datos para continuar.' : 'Empieza a organizar tu operación.'}</p><form onSubmit={submit}>{mode === 'register' && <label>Nombre completo<input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" required /></label>}<label>Correo electrónico<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@empresa.com" required /></label><label>Contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength="6" required /></label>{message && <div className="form-message">{message}</div>}<button className="primary-button" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Entrar al dashboard' : 'Crear cuenta'} <span>→</span></button></form><p className="switch">{mode === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes una cuenta?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage('') }}>{mode === 'login' ? 'Regístrate' : 'Inicia sesión'}</button></p><p className="legal">Al continuar aceptas nuestros <a href="/terminos">Términos y condiciones</a>.</p></div></div></div>
}

function Terms() { return <Layout><section className="page narrow"><p className="eyebrow">LEGAL</p><h1>Términos y condiciones</h1><p className="lead">Última actualización: 10 de septiembre de 2026</p><div className="legal-copy"><h2>1. Uso de la plataforma</h2><p>CHEQUES RSDC es una herramienta interna para consultar y organizar información relacionada con cheques. El acceso está limitado a usuarios autorizados por la empresa.</p><h2>2. Información y seguridad</h2><p>Cada usuario es responsable de mantener sus credenciales seguras. La información se almacena en Supabase y su acceso depende de las políticas de seguridad configuradas por la organización.</p><h2>3. Responsabilidad</h2><p>La plataforma facilita la gestión operativa, pero los usuarios deben verificar la exactitud de cada registro antes de tomar decisiones financieras.</p></div></section></Layout> }
function Settings() { const { session } = useAuth(); return <Layout><section className="page narrow"><p className="eyebrow">PREFERENCIAS</p><h1>Ajustes</h1><p className="lead">Administra la información de tu cuenta.</p><div className="settings-card"><div className="settings-avatar">{session?.user?.email?.slice(0, 2).toUpperCase()}</div><div><p className="eyebrow">CUENTA</p><h2>{session?.user?.user_metadata?.full_name || 'Usuario RSDC'}</h2><p className="muted">{session?.user?.email}</p></div></div><div className="settings-row"><div><strong>Notificaciones</strong><p className="muted">Recibir novedades de la operación por correo.</p></div><div className="toggle on"><i /></div></div></section></Layout> }

export default function App() { return <AuthProvider><Routes><Route path="/login" element={<Login />} /><Route path="/terminos" element={<Terms />} /><Route path="/ajustes" element={<Protected><Settings /></Protected>} /><Route path="/carpetas" element={<Protected><Folders /></Protected>} /><Route path="/personal" element={<Protected><Personnel Layout={Layout} /></Protected>} /><Route path="/carpetas/:year/:month" element={<Protected><MonthFolder /></Protected>} /><Route path="/nuevo-cheque" element={<Protected><ChequeEditor Layout={Layout} /></Protected>} /><Route path="/editar-cheque/:id" element={<Protected><ChequeEditor Layout={Layout} /></Protected>} /><Route path="/" element={<Protected><Dashboard /></Protected>} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></AuthProvider> }
