import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageOne, PageTwo, PageThree, PageFour } from './ChequeSheets'
import { chequesTable, supabase } from '../lib/supabase'
import { fetchAndCacheLookup, fetchCheques, fetchPersonnel, getCheque, getChequeSequences, getImmediateChequeSequences, getImmediateChequeSnapshot, saveChequeOffline } from '../lib/offlineStore'
import { bundledIncomeCode } from '../data/incomeCodes'
import './cheque-editor.css'

export default function ChequeEditor({ Layout }) {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const initialOfflineCheques = getImmediateChequeSnapshot()
  const initialSequences = getImmediateChequeSequences()
  const initialDate = new Date()
  const today = `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, '0')}-${String(initialDate.getDate()).padStart(2, '0')}`
  const [setup, setSetup] = useState({ number: editId ? '' : String(initialSequences.cheque + 1), comprobante: editId ? '' : String(initialSequences.comprobante + 1), type: 'Compra', date: today })
  const [started, setStarted] = useState(false)
  const [page, setPage] = useState(1)
  const [example, setExample] = useState(false)
  const [beneficiary, setBeneficiary] = useState('')
  const [identity, setIdentity] = useState('')
  const [chequeDescription, setChequeDescription] = useState('')
  const [position, setPosition] = useState('')
  const [salary, setSalary] = useState('')
  const [level, setLevel] = useState('')
  const [category, setCategory] = useState('')
  const [rateTable, setRateTable] = useState({})
  const [savedZoneRates, setSavedZoneRates] = useState({})
  const [department, setDepartment] = useState('')
  const [city, setCity] = useState('')
  const [residence, setResidence] = useState('')
  const [expenseRows, setExpenseRows] = useState([{ code: '', description: '', amount: '' }])
  const [travelDays, setTravelDays] = useState('')
  const [travelStart, setTravelStart] = useState('')
  const [travelEnd, setTravelEnd] = useState('')
  const [vehicleType, setVehicleType] = useState('Del Estado')
  const [plate, setPlate] = useState('')
  const [driver, setDriver] = useState('')
  const [history, setHistory] = useState([])
  const [savedPeople, setSavedPeople] = useState([])
  const [recentCheques, setRecentCheques] = useState(initialOfflineCheques.slice(0, 50))
  const [inheritTravel, setInheritTravel] = useState(false)
  const [inheritSourceId, setInheritSourceId] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [saveState, setSaveState] = useState('idle')
  const [lastSavedAt, setLastSavedAt] = useState(null)
  useEffect(() => {
    if (!editId) return
    getCheque(editId).then(({ data, error }) => {
      if (error || !data) return
      let stored = {}
      try { stored = data.concepto ? JSON.parse(data.concepto) : {} } catch { stored = {} }
      const loadedSetup = stored.setup || {}
      setSetup(current => ({ ...current, ...loadedSetup, number: loadedSetup.number || data.numero_cheque || '', date: loadedSetup.date || data.fecha_emision || current.date }))
      setBeneficiary(stored.beneficiary ?? data.beneficiario ?? '')
      setIdentity(stored.identity ?? '')
      setChequeDescription(stored.chequeDescription ?? '')
      setPosition(stored.position ?? '')
      setSalary(stored.salary ?? '')
      setLevel(stored.level ?? '')
      setCategory(stored.category || 'V')
      setSavedZoneRates(stored.viaticoRates || {})
      setDepartment(stored.department ?? '')
      setCity(stored.city ?? '')
      setResidence(stored.residence ?? '')
      setTravelDays(stored.travelDays ?? '')
      setTravelStart(stored.travelStart ?? '')
      setTravelEnd(stored.travelEnd ?? '')
      setVehicleType(stored.vehicleType || 'Del Estado')
      setPlate(stored.plate ?? '')
      setDriver(stored.driver ?? '')
      if (Array.isArray(stored.expenseRows) && stored.expenseRows.length) setExpenseRows(stored.expenseRows)
      if (Array.isArray(stored.itineraryRows) && stored.itineraryRows.length) setItineraryRows(stored.itineraryRows)
      setSavedId(data.id)
      setStarted(true)
    })
  }, [editId])
  useEffect(() => {
    fetchCheques().then(({ data }) => {
      const parsed = (data || []).map(item => {
        try {
          const value = item.concepto ? JSON.parse(item.concepto) : {}
          return { person: { beneficiary: value.beneficiary || item.beneficiario || '', identity: value.identity || '', position: value.position || '', salary: value.salary || '', level: value.level || '', category: value.category || '', department: value.department || '', city: value.city || '', residence: value.residence || '' }, itinerary: Array.isArray(value.itineraryRows) ? value.itineraryRows : [], driver: value.driver || '', plate: value.plate || '' }
        } catch { return { person: { beneficiary: item.beneficiario || '' }, itinerary: [], driver: '', plate: '' } }
      }).filter(item => item.person.beneficiary)
      setHistory(parsed)
    })
  }, [])
  useEffect(() => {
    fetchPersonnel().then(data => setSavedPeople(data || []))
  }, [])
  useEffect(() => {
    fetchCheques({ limit: 50 }).then(async ({ data }) => {
      const records = data || []
      setRecentCheques(records)
      if (!editId) {
        const sequences = await getChequeSequences()
        setSetup(current => ({ ...current, number: String(sequences.cheque + 1), comprobante: String(sequences.comprobante + 1) }))
      }
    })
  }, [editId])
  useEffect(() => {
    fetchAndCacheLookup('viatico-rates', async () => {
      if (!supabase) return null
      const { data, error } = await supabase.from('ck_viatico_rates').select('categoria, zona, valor').order('vigente_desde', { ascending: false })
      if (error) throw error
      return data || []
    }, []).then(data => {
      const latest = {}
      ;(data || []).forEach(row => { if (!latest[row.categoria]) latest[row.categoria] = {}; if (latest[row.categoria][String(row.zona)] === undefined) latest[row.categoria][String(row.zona)] = Number(row.valor) })
      setRateTable(latest)
    })
  }, [])
  const emptyItineraryRows = () => Array.from({ length: 6 }, (_, index) => ({ number: String(index + 1), destination: '', departure: '', returnDate: '', zone: '', days: '', assignment: '', total: '' }))
  const [itineraryRows, setItineraryRows] = useState(emptyItineraryRows)
  const continuationStage = itineraryRows.length > 30 ? 4 : itineraryRows.length > 20 ? 3 : itineraryRows.length > 11 ? 2 : itineraryRows.length > 6 ? 1 : 0
  const pageCount = setup.type === 'Viatico' ? 3 + (continuationStage ? 1 : 0) : 2
  const totalAmount = expenseRows.reduce((sum, row) => sum + (Number(String(row.amount ?? '').replace(/,/g, '')) || 0), 0)
  const zoneRates = Object.keys(savedZoneRates).length ? savedZoneRates : (rateTable[category] || {})
  const editorData = { setup, beneficiary, identity, chequeDescription, position, salary, level, category, department, city, residence, travelDays, travelStart, travelEnd, vehicleType, plate, driver, expenseRows, itineraryRows, viaticoRates: zoneRates }
  const peopleHistory = [...new Map([...history.map(item => item.person), ...savedPeople.map(person => ({ beneficiary: person.nombre, identity: person.identidad, position: person.puesto, salary: person.salario, level: person.nivel, category: person.categoria, department: person.departamento, city: person.ciudad, residence: person.residencia }))].filter(item => item?.beneficiary).map(person => [person.beneficiary.toUpperCase(), person])).values()]
  const destinationHistory = [...new Set(history.flatMap(item => item.itinerary.map(row => row.destination).filter(Boolean)))]
  const driverHistory = [...new Set(history.map(item => item.driver).filter(Boolean))]
  const plateHistory = [...new Set(history.map(item => item.plate).filter(Boolean))]
  const selectPerson = person => {
    setBeneficiary(person.beneficiary || '')
    setIdentity(person.identity || '')
    setPosition(person.position || '')
    setSalary(person.salary || '')
    setLevel(person.level || '')
    setCategory(person.category || 'V')
    setDepartment(person.department || '')
    setCity(person.city || '')
    setResidence(person.residence || '')
  }
  const start = event => {
    event.preventDefault()
    setPage(1)
    const source = recentCheques.find(item => item.id === inheritSourceId)
    if (setup.type === 'Viatico' && inheritTravel && source) {
      try {
        const stored = JSON.parse(source.concepto || '{}')
        setChequeDescription(stored.chequeDescription || '')
        setTravelStart(stored.travelStart || '')
        setTravelEnd(stored.travelEnd || '')
        setTravelDays(stored.travelDays || '')
        setVehicleType(stored.vehicleType || 'Del Estado')
        setPlate(stored.plate || '')
        setDriver(stored.driver || '')
        if (Array.isArray(stored.itineraryRows) && stored.itineraryRows.length) setItineraryRows(stored.itineraryRows.map(row => ({ ...row, assignment: '', total: '' })))
      } catch { /* El cheque fuente puede ser un registro antiguo sin datos del editor. */ }
    }
    if (setup.type === 'Viatico' && !(inheritTravel && source)) {
      setTravelDays('')
      setTravelStart('')
      setTravelEnd('')
      setVehicleType('Del Estado')
      setPlate('')
      setDriver('')
      setItineraryRows(emptyItineraryRows())
      setExpenseRows([{ code: '26210', description: bundledIncomeCode('26210')?.description || '', amount: '' }])
      fetchAndCacheLookup('income-code:26210', async () => {
        if (!supabase) return null
        const { data, error } = await supabase.from('income_codes').select('description').eq('code', '26210').maybeSingle()
        if (error) throw error
        return data
      }, bundledIncomeCode('26210')).then(data => {
        if (data?.description) setExpenseRows(current => current.map((row, index) => index === 0 && row.code === '26210' ? { ...row, description: data.description } : row))
      })
    } else if (setup.type === 'Viatico') setExpenseRows([{ code: '26210', description: bundledIncomeCode('26210')?.description || '', amount: '' }])
    else setExpenseRows([{ code: '', description: '', amount: '' }])
    setStarted(true)
  }
  const saveCheque = async ({ automatic = false } = {}) => {
    if (!started) return
    setSaveState('saving')
    const { data: { session } = {} } = supabase ? await supabase.auth.getSession() : { data: {} }
    const payload = {
      numero_cheque: setup.number,
      beneficiario: beneficiary.trim() || 'PENDIENTE',
      monto: totalAmount,
      moneda: 'HNL',
      fecha_emision: setup.date,
      estado: 'pendiente',
      ...(savedId ? {} : { created_by: session?.user?.id || null }),
      concepto: JSON.stringify({ version: 1, automatic, ...editorData })
    }
    const { data, error, offline } = await saveChequeOffline(payload, savedId)
    if (error) {
      setSaveState('error')
      return
    }
    setSavedId(data?.id || savedId)
    setLastSavedAt(new Date())
    setSaveState(offline ? 'offline' : 'saved')
  }
  useEffect(() => {
    if (!started) return undefined
    const timer = window.setTimeout(() => saveCheque({ automatic: true }), 15000)
    return () => window.clearTimeout(timer)
  }, [started, JSON.stringify(editorData)])

  const renderPage = pageNumber => <>
    {pageNumber === 1 && <PageOne number={setup.number} type={setup.type} date={setup.date} comprobante={setup.comprobante} example={example} beneficiary={beneficiary} identity={identity} chequeDescription={chequeDescription} beneficiaryHistory={peopleHistory} onBeneficiarySelect={selectPerson} expenseRows={expenseRows} onExpenseRowsChange={setExpenseRows} onBeneficiaryChange={setBeneficiary} onIdentityChange={setIdentity} onChequeDescriptionChange={setChequeDescription} />}
    {pageNumber === 2 && <PageTwo number={setup.number} type={setup.type} date={setup.date} comprobante={setup.comprobante} example={example} identity={identity} chequeDescription={chequeDescription} expenseRows={expenseRows} onIdentityChange={setIdentity} />}
    {pageNumber === 3 && <PageThree date={setup.date} comprobante={setup.comprobante} example={example} zoneRates={zoneRates} beneficiary={beneficiary} identity={identity} chequeDescription={chequeDescription} itineraryRows={itineraryRows} travelDays={travelDays} travelStart={travelStart} travelEnd={travelEnd} vehicleType={vehicleType} plate={plate} driver={driver} destinationHistory={destinationHistory} driverHistory={driverHistory} plateHistory={plateHistory} continuationStage={continuationStage} onItineraryRowsChange={setItineraryRows} onTravelDaysChange={setTravelDays} onTravelStartChange={setTravelStart} onTravelEndChange={setTravelEnd} onVehicleTypeChange={setVehicleType} onPlateChange={setPlate} onDriverChange={setDriver} expenseRows={expenseRows} onExpenseRowsChange={setExpenseRows} position={position} salary={salary} level={level} category={category} department={department} city={city} residence={residence} onBeneficiaryChange={setBeneficiary} onIdentityChange={setIdentity} onChequeDescriptionChange={setChequeDescription} onPositionChange={setPosition} onSalaryChange={setSalary} onLevelChange={setLevel} onCategoryChange={value => { setCategory(value); setSavedZoneRates({}) }} onDepartmentChange={setDepartment} onCityChange={setCity} onResidenceChange={setResidence} />}
    {pageNumber >= 4 && <PageFour pageNumber={pageNumber} example={example} zoneRates={zoneRates} destinationHistory={destinationHistory} date={setup.date} comprobante={setup.comprobante} identity={identity} salary={salary} level={level} continuationStage={continuationStage} itineraryRows={itineraryRows} onItineraryRowsChange={setItineraryRows} amount={itineraryRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0) + expenseRows.filter(row => row.code.trim() !== '26210').reduce((sum, row) => sum + (Number(row.amount) || 0), 0)} otherExpenses={expenseRows.filter(row => row.code.trim() !== '26210').reduce((sum, row) => sum + (Number(row.amount) || 0), 0)} />}
  </>

  return <Layout><div className="editor-page">
    <div className="editor-toolbar"><button className="back-button" onClick={() => navigate(-1)}>← Regresar</button>{started && <div><span className="editor-kicker">CHEQUE {setup.number}</span><strong>{setup.type === 'Viatico' ? 'Viático' : 'Compra'}</strong></div>}{started && <div className="save-area"><button className="print-button" type="button" onClick={() => window.print()}>Imprimir</button><button className="save-button" type="button" onClick={() => saveCheque()} disabled={saveState === 'saving'}>{saveState === 'saving' ? 'Guardando…' : 'Guardar'}</button>{saveState === 'saved' && <small>Guardado {lastSavedAt?.toLocaleTimeString('es-HN')}</small>}{saveState === 'offline' && <small className="save-offline">Guardado local · pendiente de sincronizar</small>}{saveState === 'error' && <small className="save-error">No se pudo guardar</small>}</div>}</div>
    {!started ? <div className="editor-setup-layout"><aside className="recent-cheques"><p className="eyebrow">HISTORIAL RECIENTE</p><h2>Últimos cheques</h2><div className="recent-cheques-list">{recentCheques.length ? recentCheques.map(item => <button key={item.id} type="button" onClick={() => inheritTravel ? setInheritSourceId(item.id) : item.id && navigate(`/editar-cheque/${item.id}`)} className={inheritSourceId === item.id ? "recent-cheque selected" : "recent-cheque"}><strong>#{item.numero_cheque || item.id}</strong><span>{item.beneficiario || "Beneficiario pendiente"}</span></button>) : <p className="muted">Aún no hay cheques creados.</p>}</div></aside><div className="editor-setup"><p className="eyebrow">NUEVO DOCUMENTO</p><h1>Crear nuevo cheque</h1><p>Ingresa los datos iniciales para preparar las hojas del cheque.</p><form onSubmit={start}><label>Número de cheque<input value={setup.number} onChange={e => setSetup({ ...setup, number: e.target.value })} placeholder="Ej. 9264" required autoFocus /></label><label>Código de comprobante<input value={setup.comprobante} onChange={e => setSetup({ ...setup, comprobante: e.target.value })} placeholder="Ej. 404" inputMode="numeric" required /></label><label>Fecha del cheque<input type="date" value={setup.date} onChange={e => setSetup({ ...setup, date: e.target.value })} required /></label><fieldset><legend>Tipo de cheque</legend><label className={`type-option ${setup.type === 'Compra' ? 'selected' : ''}`}><input type="radio" name="type" checked={setup.type === 'Compra'} onChange={() => setSetup({ ...setup, type: 'Compra' })} /><span><b>Compra</b><small>Comprobante y recibo · 2 páginas</small></span></label><label className={`type-option ${setup.type === 'Viatico' ? 'selected' : ''}`}><input type="radio" name="type" checked={setup.type === 'Viatico'} onChange={() => setSetup({ ...setup, type: 'Viatico' })} /><span><b>Viático</b><small>Incluye formato de viáticos · 3 páginas</small></span></label></fieldset>{setup.type === 'Viatico' && <label className="inherit-option"><input type="checkbox" checked={inheritTravel} onChange={event => { setInheritTravel(event.target.checked); if (!event.target.checked) setInheritSourceId(null) }} /> <span><b>Heredar Datos de Viático</b><small>Selecciona un cheque reciente en el panel izquierdo.</small></span></label>}<button className="primary-button">Comenzar a editar <span>→</span></button></form></div></div> : <>
      <label className="reference-toggle"><input type="checkbox" checked={example} onChange={e => setExample(e.target.checked)} /> Mostrar datos de referencia (solo vista previa)</label>
      <div className="paper-workspace"><div className="paper-scroll">{page === 1 && <PageOne number={setup.number} type={setup.type} date={setup.date} comprobante={setup.comprobante} example={example} beneficiary={beneficiary} identity={identity} chequeDescription={chequeDescription} beneficiaryHistory={peopleHistory} onBeneficiarySelect={selectPerson} expenseRows={expenseRows} onExpenseRowsChange={setExpenseRows} onBeneficiaryChange={setBeneficiary} onIdentityChange={setIdentity} onChequeDescriptionChange={setChequeDescription} />}{page === 2 && <PageTwo number={setup.number} type={setup.type} date={setup.date} comprobante={setup.comprobante} example={example} identity={identity} chequeDescription={chequeDescription} expenseRows={expenseRows} onIdentityChange={setIdentity} />}{page === 3 && <PageThree date={setup.date} comprobante={setup.comprobante} example={example} zoneRates={zoneRates} beneficiary={beneficiary} identity={identity} chequeDescription={chequeDescription} itineraryRows={itineraryRows} travelDays={travelDays} travelStart={travelStart} travelEnd={travelEnd} vehicleType={vehicleType} plate={plate} driver={driver} destinationHistory={destinationHistory} driverHistory={driverHistory} plateHistory={plateHistory} continuationStage={continuationStage} onItineraryRowsChange={setItineraryRows} onTravelDaysChange={setTravelDays} onTravelStartChange={setTravelStart} onTravelEndChange={setTravelEnd} onVehicleTypeChange={setVehicleType} onPlateChange={setPlate} onDriverChange={setDriver} expenseRows={expenseRows} onExpenseRowsChange={setExpenseRows} position={position} salary={salary} level={level} category={category} department={department} city={city} residence={residence} onBeneficiaryChange={setBeneficiary} onIdentityChange={setIdentity} onChequeDescriptionChange={setChequeDescription} onPositionChange={setPosition} onSalaryChange={setSalary} onLevelChange={setLevel} onCategoryChange={value => { setCategory(value); setSavedZoneRates({}) }} onDepartmentChange={setDepartment} onCityChange={setCity} onResidenceChange={setResidence} />}{page >= 4 && <PageFour pageNumber={page} example={example} zoneRates={zoneRates} destinationHistory={destinationHistory} date={setup.date} comprobante={setup.comprobante} identity={identity} salary={salary} level={level} continuationStage={continuationStage} itineraryRows={itineraryRows} onItineraryRowsChange={setItineraryRows} amount={itineraryRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0) + expenseRows.filter(row => row.code.trim() !== '26210').reduce((sum, row) => sum + (Number(row.amount) || 0), 0)} otherExpenses={expenseRows.filter(row => row.code.trim() !== '26210').reduce((sum, row) => sum + (Number(row.amount) || 0), 0)} />}</div></div>
      <div className="print-workspace">{Array.from({ length: pageCount }, (_, index) => <div className="paper-scroll" key={index + 1}>{renderPage(index + 1)}</div>)}</div>
      <div className="page-controls"><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button><div>{Array.from({ length: pageCount }, (_, i) => <button key={i} className={page === i + 1 ? 'active' : ''} onClick={() => setPage(i + 1)}>{i + 1}</button>)}</div><span>Página {page} de {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>→</button></div>
    </>}
  </div></Layout>
}
