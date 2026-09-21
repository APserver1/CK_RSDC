import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCheques, fetchPersonnel, savePersonOffline } from '../lib/offlineStore'
import './personnel.css'

const emptyPerson = { nombre: '', identidad: '', puesto: '', salario: '', nivel: '', categoria: '', departamento: '', ciudad: '', residencia: '' }

function readChequePerson(item) {
  let stored = {}
  try { stored = item.concepto ? JSON.parse(item.concepto) : {} } catch { stored = {} }
  const data = stored.datosPersonales || {}
  return {
    nombre: item.beneficiario || stored.beneficiary || '',
    identidad: data.identity || stored.identity || item.identidad || '',
    puesto: data.position || stored.position || '',
    salario: data.salary || stored.salary || '',
    nivel: data.level || stored.level || '',
    categoria: data.category || stored.category || '',
    departamento: data.department || stored.department || '',
    ciudad: data.city || stored.city || '',
    residencia: data.residence || stored.residence || ''
  }
}

function mergePeople(manual, cheques) {
  const merged = new Map()
  manual.forEach(person => {
    if (!person.nombre?.trim()) return
    merged.set(person.nombre.trim().toUpperCase(), { ...person, uso_count: Number(person.uso_count) || 0, source: 'manual' })
  })
  cheques.forEach(cheque => {
    const person = readChequePerson(cheque)
    const key = person.nombre.trim().toUpperCase()
    if (!key) return
    const current = merged.get(key)
    if (current) {
      merged.set(key, { ...current, ...Object.fromEntries(Object.entries(person).filter(([, value]) => value !== '')), uso_count: current.uso_count + 1 })
    } else merged.set(key, { ...person, uso_count: 1, source: 'history' })
  })
  return [...merged.values()].sort((a, b) => (b.uso_count - a.uso_count) || a.nombre.localeCompare(b.nombre))
}

export default function Personnel({ Layout }) {
  const [manual, setManual] = useState([])
  const [cheques, setCheques] = useState([])
  const [form, setForm] = useState(emptyPerson)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const people = useMemo(() => mergePeople(manual, cheques), [manual, cheques])

  const loadPeople = async () => {
    if (!supabase) { setError('Falta configurar Supabase.'); setLoading(false); return }
    setLoading(true)
    setError('')
    const [manualData, chequeResult] = await Promise.all([fetchPersonnel(), fetchCheques()])
    setManual(manualData || [])
    if (chequeResult.error && !chequeResult.data.length) setError('No se pudo leer el historial de beneficiarios ni hay una copia local.')
    else setCheques(chequeResult.data || [])
    setLoading(false)
  }

  useEffect(() => { loadPeople() }, [])

  const savePerson = async event => {
    event.preventDefault()
    if (!form.nombre.trim() || !supabase) return
    setSaving(true)
    setError('')
    setMessage('')
    const { data: { session } = {} } = await supabase.auth.getSession()
    const nombre = form.nombre.trim()
    const existing = manual.find(item => item.nombre?.trim().toUpperCase() === nombre.toUpperCase())
    const payload = { ...form, nombre, salario: form.salario === '' ? null : Number(form.salario), created_by: session?.user?.id || null }
    const { data, error: saveError, offline } = await savePersonOffline(payload, existing?.id)
    if (saveError) setError(saveError.code === '23505' ? 'Ya existe una persona con ese nombre.' : 'No se pudo guardar la persona.')
    else {
      setManual(current => [data, ...current.filter(item => item.id !== data.id)])
      setForm(emptyPerson)
      setShowForm(false)
      setMessage(offline ? 'Persona guardada localmente; se sincronizará al recuperar internet.' : 'Persona guardada correctamente.')
    }
    setSaving(false)
  }

  const updateField = (field, value) => setForm(current => ({ ...current, [field]: value }))

  return <Layout><section className="page personnel-page">
    <div className="page-heading"><div><p className="eyebrow">DIRECTORIO</p><h1>Personal</h1><p className="muted">Beneficiarios recurrentes y sus datos para crear cheques más rápido.</p></div><button className="primary-button small-button" type="button" onClick={() => { setShowForm(value => !value); setMessage('') }}><span>{showForm ? '×' : '+'}</span> {showForm ? 'Cerrar' : 'Agregar persona'}</button></div>
    {message && <div className="notice success-notice">{message}</div>}
    {showForm && <form className="personnel-form" onSubmit={savePerson}><div className="personnel-form-heading"><div><p className="eyebrow">NUEVO REGISTRO</p><h2>Agregar persona</h2></div><span>Los campos se usarán para completar el cheque.</span></div><div className="personnel-fields">
      <label>Nombre completo<input value={form.nombre} onChange={event => updateField('nombre', event.target.value)} required placeholder="Ej. María López" /></label>
      <label>Identidad<input value={form.identidad} onChange={event => updateField('identidad', event.target.value)} placeholder="0801-0000-00000" /></label>
      <label>Puesto<input value={form.puesto} onChange={event => updateField('puesto', event.target.value)} placeholder="Puesto" /></label>
      <label>Salario<input type="number" min="0" step="0.01" value={form.salario} onChange={event => updateField('salario', event.target.value)} placeholder="0.00" /></label>
      <label>Nivel<input value={form.nivel} onChange={event => updateField('nivel', event.target.value)} placeholder="Nivel" /></label>
      <label>Categoría<input value={form.categoria} onChange={event => updateField('categoria', event.target.value)} placeholder="Ej. V" /></label>
      <label>Departamento<input value={form.departamento} onChange={event => updateField('departamento', event.target.value)} placeholder="Departamento" /></label>
      <label>Ciudad<input value={form.ciudad} onChange={event => updateField('ciudad', event.target.value)} placeholder="Ciudad" /></label>
      <label>Residencia<input value={form.residencia} onChange={event => updateField('residencia', event.target.value)} placeholder="Residencia" /></label>
    </div><div className="personnel-form-actions"><button className="text-button" type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button small-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar persona'}</button></div></form>}
    {error && <div className="notice">{error}</div>}
    {loading ? <DataLoading /> : people.length === 0 ? <div className="content-card"><EmptyPeople /></div> : <div className="personnel-grid">{people.map(person => <article className="person-card" key={person.id || person.nombre}><div className="person-card-top"><div className="person-avatar">{person.nombre.slice(0, 2).toUpperCase()}</div><div><h2>{person.nombre}</h2><p>{person.puesto || 'Puesto no registrado'}</p></div><span className="usage-count">{person.uso_count} {person.uso_count === 1 ? 'uso' : 'usos'}</span></div><div className="person-data"><div><small>Identidad</small><strong>{person.identidad || '—'}</strong></div><div><small>Departamento</small><strong>{person.departamento || '—'}</strong></div><div><small>Ciudad</small><strong>{person.ciudad || '—'}</strong></div><div><small>Nivel / categoría</small><strong>{[person.nivel, person.categoria].filter(Boolean).join(' · ') || '—'}</strong></div><div><small>Residencia</small><strong>{person.residencia || '—'}</strong></div><div><small>Salario</small><strong>{person.salario ? Number(person.salario).toLocaleString('es-HN', { minimumFractionDigits: 2 }) : '—'}</strong></div></div></article>)}</div>}
  </section></Layout>
}

function EmptyPeople() { return <div className="empty"><div className="empty-icon">+</div><h3>Aún no hay personal registrado</h3><p>Agrega una persona o crea un cheque para que aparezca aquí.</p></div> }
function DataLoading() { return <div className="data-loading"><span className="spinner" />Cargando personal…</div> }
