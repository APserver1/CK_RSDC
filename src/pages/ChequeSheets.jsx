import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import newLogo from '../../images/logo 2026.png'
import { supabase } from '../lib/supabase'
import { fetchAndCacheLookup } from '../lib/offlineStore'
import { bundledIncomeCode } from '../data/incomeCodes'

// Transcription of the supplied specimen, never submitted to Supabase.
const specimen = {
  beneficiary: 'JOSE MANUEL ROMERO ANDINO', identity: '0501-1974-04544',
  position: 'CONDUCTOR DE AUTOMOVILES I', salary: 'L. 17,756.45', level: 'II', category: 'V',
  department: 'CORTES', city: 'SAN PEDRO SULA', residence: 'SAN PEDRO SULA',
  amount: '413.25', words: 'CUATROCIENTOS TRECE LEMPIRAS CON 25/100',
  date: '07 DE SEPTIEMBRE DEL 2026', receipt: '404-9-2026',
  purpose: 'Pago correspondiente en concepto de viáticos por desplazamiento a la ciudad de Tegucigalpa, con el objetivo de la devolucion del siguiente medicamento por encontrarse fuera de especificaciones y que en estos momentos se encuentra en cuarentene en nuestro almacen, segun el Oficio No- 1906-ANMI-2026, según lo mencionado en el Oficio No 975-JRISS/RSDC - 2026',
}
const administrator = 'Lic. Yessy Karina Rivera Ramirez'
const director = 'Dra. Evelyn Yamali Bueso Smith'

function Logos() {
  return <div className="sheet-logos"><img src={newLogo} alt="Secretaría de Salud · Región Sanitaria de Cortés" /></div>
}
function localDateParts(date) {
  const current = date ? new Date(`${date}T12:00:00`) : new Date()
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return {
    short: current.toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: '2-digit' }).replace('.', ''),
    monthYear: `${months[current.getMonth()]}-${String(current.getFullYear()).slice(-2)}`,
    long: current.toLocaleDateString('es-HN', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase().replace(/ DE (\d{4})$/, ' DEL $1'),
  }
}
function dataFor(example, type, date, comprobante) {
  if (example) return { ...specimen, purpose: type === 'Compra' ? 'Pago correspondiente por compra de bienes y/o servicios, según documentación de respaldo.' : specimen.purpose }
  const dates = localDateParts(date)
  const selected = date ? new Date(`${date}T12:00:00`) : new Date()
  return { beneficiary: '', identity: '', position: '', salary: '', level: '', category: '', department: '', city: '', residence: '', amount: '0.00', words: '', date: dates.long, shortDate: dates.short, monthYear: dates.monthYear, receipt: comprobante ? `${comprobante}-${selected.getMonth() + 1}-${selected.getFullYear()}` : '', travelReceipt: comprobante ? `${comprobante}-${selected.getFullYear()}` : '', purpose: '' }
}
const units = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
function numberWords(value) {
  const n = Math.floor(value)
  if (n < 30) return units[n]
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` Y ${units[n % 10]}` : '')
  if (n < 1000) return n === 100 ? 'CIEN' : (Math.floor(n / 100) === 1 ? 'CIENTO' : ['', '', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'][Math.floor(n / 100)]) + (n % 100 ? ` ${numberWords(n % 100)}` : '')
  if (n < 1000000) return (Math.floor(n / 1000) === 1 ? 'MIL' : `${numberWords(Math.floor(n / 1000))} MIL`) + (n % 1000 ? ` ${numberWords(n % 1000)}` : '')
  return String(n)
}
function amountInWords(value) {
  const amount = numeric(value)
  const integer = Math.floor(amount)
  const cents = Math.round((amount - integer) * 100).toString().padStart(2, '0')
  return `${numberWords(integer)} LEMPIRAS CON ${cents}/100`
}
function numeric(value) { return Number(String(value ?? '').replace(/,/g, '')) || 0 }
function formatAmount(value) { return numeric(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function Line({ children, className = '' }) { return <span className={`sheet-fill ${className}`}>{children || '\u00a0'}</span> }
function EditField({ value, fallback = '', onChange, className = '', ariaLabel, uppercase = false, style, list }) {
  const handleChange = event => {
    const input = event.currentTarget
    const selectionStart = input.selectionStart
    const selectionEnd = input.selectionEnd
    onChange(uppercase ? input.value.toUpperCase() : input.value)
    if (uppercase && selectionStart !== null && selectionEnd !== null) {
      requestAnimationFrame(() => {
        if (document.activeElement === input) input.setSelectionRange(selectionStart, selectionEnd)
      })
    }
  }
  return <input aria-label={ariaLabel} list={list} className={`sheet-edit ${className} ${(value || fallback) ? 'filled' : ''}`} style={style} value={value || fallback} onChange={handleChange} />
}
function PayeeField({ value, fallback, onChange, list }) {
  const shown = value || fallback || ''
  const measure = useRef(null)
  const [width, setWidth] = useState(24)
  const printFontSize = shown.length > 45 ? 8.6 : shown.length > 32 ? 9.5 : 10.6
  useLayoutEffect(() => {
    if (measure.current) setWidth(Math.max(24, measure.current.offsetWidth + 12))
  }, [shown])
  return <><span ref={measure} className="payee-measure">{shown || ' '}</span><span className="payee-print-value" style={{ fontSize: `${printFontSize}px` }}>{shown}</span><EditField ariaLabel="Beneficiario del cheque" list={list} className="payee-input" style={{ width: `${width}px` }} value={value} fallback={fallback} onChange={onChange} uppercase /></>
}

export function PageOne({ number, type, example, date, comprobante, beneficiary, identity, chequeDescription, beneficiaryHistory = [], onBeneficiaryChange, onBeneficiarySelect, onIdentityChange, onChequeDescriptionChange, expenseRows, onExpenseRowsChange }) {
  const d = dataFor(example, type, date, comprobante)
  const pageRef = useRef(null)
  const frameRef = useRef(null)
  const descriptionRef = useRef(null)
  const [editingAmountIndex, setEditingAmountIndex] = useState(null)
  const travel = type === 'Viatico'
  const referenceRows = travel ? [{ code: '26210', description: 'VIATICOS NACIONALES', amount: '281.25' }, { code: '25100', description: 'SERVICIO DE TRANSPORTE', amount: '132.00' }] : [{ code: '', description: 'COMPRA DE BIENES Y/O SERVICIOS', amount: d.amount }]
  const rows = example ? referenceRows : expenseRows
  const total = rows.reduce((sum, row) => sum + numeric(row.amount), 0)
  if (!example) {
    d.amount = formatAmount(total)
    d.words = amountInWords(total)
  }
  const description = example ? d.purpose : chequeDescription
  const resizeDescription = () => {
    const field = descriptionRef.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }
  useLayoutEffect(() => {
    resizeDescription()
  }, [description])
  useLayoutEffect(() => {
    const page = pageRef.current
    const frame = frameRef.current
    if (!page || !frame) return
    const positionSignatures = () => {
      const frameBottom = frame.getBoundingClientRect().bottom - page.getBoundingClientRect().top
      page.style.setProperty('--cheque-signature-shift', `${Math.max(0, Math.ceil(frameBottom - 864))}px`)
    }
    positionSignatures()
    const observer = new ResizeObserver(positionSignatures)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])
  const addRow = () => {
    const nextNumber = expenseRows.length + 1
    onExpenseRowsChange(current => [...current, { code: '', description: '', amount: '' }])
    requestAnimationFrame(() => document.querySelector(`[aria-label="Objeto de gasto ${nextNumber}"]`)?.focus())
  }
  const updateRow = async (index, field, value) => {
    const next = expenseRows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row)
    onExpenseRowsChange(next)
    if (field === 'code') {
      const caret = value.length
      requestAnimationFrame(() => {
        const input = document.querySelector(`[aria-label="Objeto de gasto ${index + 1}"]`)
        if (input) {
          input.focus()
          input.setSelectionRange(caret, caret)
        }
      })
    }
    if (field === 'code' && value.trim() && supabase) {
      const codeData = await fetchAndCacheLookup(`income-code:${value.trim()}`, async () => {
        const { data, error } = await supabase.from('income_codes').select('description').eq('code', value.trim()).maybeSingle()
        if (error) throw error
        return data
      }, bundledIncomeCode(value))
      if (codeData?.description) onExpenseRowsChange(current => current.map((row, rowIndex) => rowIndex === index && row.code === value ? { ...row, description: codeData.description } : row))
    }
  }
  const amountText = value => formatAmount(value)
  const payeeName = beneficiary || d.beneficiary || ''
  const payeeDotWidth = Math.max(18, Math.min(88, 88 - payeeName.length * 0.4))
  const handleBeneficiaryChange = value => {
    const normalized = value.toUpperCase()
    onBeneficiaryChange(normalized)
    const selected = beneficiaryHistory.find(person => person.beneficiary?.toUpperCase() === normalized)
    if (selected) onBeneficiarySelect?.(selected)
  }
  return <article ref={pageRef} className="bond-page specimen-one" aria-label="Hoja 1: cheque y comprobante">
    <div ref={frameRef} className="cheque-frame">
      <section className="bank-block">
        <h1>BANCO NACIONAL DE DESARROLLO AGRICOLA</h1><Logos /><b className="bank-number">CHEQUE {number}</b>
        <div className="bank-date"><b>POR ESTE CHEQUE:</b><b>SAN PEDRO SULA {d.date || '________________________'}</b></div>
        <div className="bank-payee" style={{ '--payee-dot-width': `${payeeDotWidth}px` }}><b>PAGUESE A:</b><span className="dot-leader" /><PayeeField value={beneficiary} fallback={d.beneficiary} list="beneficiary-history" onChange={handleBeneficiaryChange} /><span className="dot-leader" /><b>L. {d.amount}</b></div><datalist id="beneficiary-history">{beneficiaryHistory.map(person => <option key={person.beneficiary} value={person.beneficiary} />)}</datalist>
        <div className="bank-words"><b>LA SUMA DE:</b><span className="dot-leader" /><b>{d.words}</b><span className="dot-leader" /></div>
        <div className="bank-address">Sres. Region Departamental de Cortes</div>
        <div className="bank-funds">Fondos Recuperados</div><b className="bank-city">San Pedro Sula</b>
        <div className="bank-sign bank-admin"><Line />{administrator}<br /><b>Administracion</b><br />Region Departamental de Cortes</div>
        <div className="bank-sign bank-director"><Line />{director}<br /><b>Jefatura</b><br />Region Departamental De Cortes</div>
      </section>
      <section className="voucher-info"><h2>SECRETARIA DE SALUD PUBLICA<br />FONDOS RECUPERADOS</h2>
        <div className="voucher-identifiers"><b>CHEQUE No. {number}</b><b>COMPROBANTE {d.receipt || '____________'}</b></div>
        <p className="voucher-unit">Unidad Ejecutora: <b>Region Departamental de Cortes</b><span>Banco: <b>BANADESA</b></span></p>
        <b className="voucher-account">Cuenta No. :02-025-000058-9</b>
      </section>
      <table className="voucher-ledger" style={{ '--expense-rows-height': `${rows.length * 18}px` }}><colgroup><col style={{ width: '12%' }} /><col style={{ width: '70%' }} /><col style={{ width: '18%' }} /></colgroup>
        <thead><tr><th>OBJETO</th><th>DESCRIPCION</th><th>VALOR EN LEMPIRAS</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr className="expense-row" key={`${index}-${row.code}`}><td className="object-cell"><input className="expense-input object-input" aria-label={`Objeto de gasto ${index + 1}`} value={row.code} readOnly={example} onChange={event => updateRow(index, 'code', event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !example) { event.preventDefault(); addRow() } }} />{!example && <button className="row-add" type="button" aria-label="Añadir otra fila de gasto" onClick={addRow}>+</button>}</td><td><input className="expense-input description-input" aria-label={`Descripción de gasto ${index + 1}`} value={row.description} readOnly /></td><td className="amount-cell"><input className="expense-input amount-input" aria-label={`Valor de gasto ${index + 1}`} type="text" inputMode="decimal" value={editingAmountIndex === index ? String(row.amount ?? '').replace(/,/g, '') : row.amount === '' ? '' : formatAmount(row.amount)} readOnly={example} onFocus={() => !example && setEditingAmountIndex(index)} onChange={event => updateRow(index, 'amount', event.target.value.replace(/,/g, ''))} onBlur={() => { if (!example && String(row.amount ?? '').trim()) updateRow(index, 'amount', formatAmount(row.amount)); if (!example) setEditingAmountIndex(null) }} onKeyDown={event => { if (event.key === 'Enter' && !example) { event.preventDefault(); event.currentTarget.blur(); addRow() } }} /></td></tr>)}<tr className="expense-spacer"><td /><td><div className="voucher-description-layout"><textarea ref={descriptionRef} aria-label="Descripción del cheque" className="cheque-description-input" value={description} readOnly={example} onChange={event => onChequeDescriptionChange(event.target.value)} placeholder="Escribe la descripción del cheque..." /><div className="cheque-description-print">{description}</div><div className="voucher-approval"><Line />{director}<br />JEFATURA REGION DEPTAL. DE CORTES</div></div></td><td /></tr></tbody>
        <tfoot><tr><td /><td>TOTAL</td><td>{amountText(total)}</td></tr></tfoot>
      </table>
    </div>
    <div className="cheque-receiver"><Line /><b>RECEPTOR DE CHEQUE</b><p><b>{type === 'Compra' ? 'RTN' : 'IDENTIDAD'}: &nbsp; <EditField ariaLabel={`${type === 'Compra' ? 'RTN' : 'DNI'} del beneficiario en hoja 1`} className="dni-input" value={identity} fallback={d.identity} onChange={onIdentityChange} /></b></p></div>
    <div className="cheque-responsible"><Line /><b>RESPONSABLE<br />{administrator}<br />ADMINISTRACION</b></div>
  </article>
}

export function PageTwo({ number, type, example, date, comprobante, identity, chequeDescription, expenseRows, onIdentityChange }) {
  const d = dataFor(example, type, date, comprobante)
  if (!example) {
    const total = expenseRows.reduce((sum, row) => sum + numeric(row.amount), 0)
    d.amount = formatAmount(total)
    d.words = amountInWords(total)
  }
  return <article className="bond-page specimen-two" aria-label="Hoja 2: recibo"><Logos />
    <header className="receipt-institution">REGION DE SALUD DEPARTAMENTAL DE CORTES<br />SAN PEDRO SULA, CORTES<br />HONDURAS, CENTRO AMERICA<br /><span>Tel. 566-2024, 566-1882, 566-1910, 566-0835</span></header>
    <b className="receipt-value">RECIBO POR: &nbsp; L. &nbsp;&nbsp; {d.amount}</b>
    <div className="receipt-ack">RECIBI DE FONDOS RECUPERADO DE LA REGION DEPARTAMENTAL DE CORTES<br /><div>LA CANTIDAD DE: <b>{d.words || '___________________________________'}</b></div></div>
    <div className="receipt-for">VALOR QUE CORRESPONDE POR:</div>
    <div className="receipt-details">
      <p className="receipt-purpose">{example ? d.purpose : chequeDescription}</p>
      <div className="receipt-identifiers"><b>CHEQUE No. {number}</b><b>COMPROBANTE {d.receipt || '____________'}</b></div>
      <div className="receipt-place">SAN PEDRO SULA {d.date || '______________________________'}</div>
      <div className="receipt-sign"><Line />FIRMA DEL BENEFICIARIO<br /><span>{type === 'Compra' ? 'RTN' : 'DNI'}: <EditField ariaLabel={`${type === 'Compra' ? 'RTN' : 'DNI'} del beneficiario en hoja 2`} className="receipt-dni-input" value={identity} fallback={d.identity} onChange={onIdentityChange} /></span></div>
    </div>
  </article>
}

function currency(value) { return formatAmount(value) }
function ItineraryTable({ example, rows, totalRows = rows, destinationHistory = [], zoneRates = {}, onRowsChange, days, onDaysChange, offset = 0 }) {
  const addRow = index => onRowsChange(current => {
    const inserted = [...current.slice(0, index + 1), { number: '', destination: '', departure: '', returnDate: '', zone: '', days: '', assignment: '', total: '' }, ...current.slice(index + 1)]
    return inserted.map((row, rowIndex) => ({ ...row, number: String(rowIndex + 1) }))
  })
  const addBefore = index => onRowsChange(current => {
    const inserted = [...current.slice(0, index), { number: '', destination: '', departure: '', returnDate: '', zone: '', days: '', assignment: '', total: '' }, ...current.slice(index)]
    return inserted.map((row, rowIndex) => ({ ...row, number: String(rowIndex + 1) }))
  })
  const removeRow = index => onRowsChange(current => current.length <= 1 ? current : current.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, number: String(rowIndex + 1) })))
  const update = (index, field, value) => {
    const actualIndex = index + offset
    const nextRows = totalRows.map((row, rowIndex) => {
      if (rowIndex !== actualIndex) return row
      const next = { ...row, [field]: value }
      if (field === 'zone') next.assignment = zoneRates[value] ? String(zoneRates[value]) : ''
      next.total = numeric(next.assignment) * numeric(next.days)
      return next
    })
    onRowsChange(nextRows)
    if (field === 'days') onDaysChange(nextRows.reduce((sum, row) => sum + (Number(row.days) || 0), 0).toString())
  }
  const shownRows = example ? [{ number: '1', destination: 'Tegucigalpa', departure: '8-sep-26', returnDate: '8-sep-26', zone: '1', days: '0.25', assignment: '1125', total: '281.25' }, ...Array.from({ length: 8 }, () => ({}))] : rows
  return <><datalist id="destination-history">{destinationHistory.map(destination => <option key={destination} value={destination} />)}</datalist><table className="itinerary-table"><colgroup>{[3,26,11,11,11,8,15,15].map((w,i)=><col key={i} style={{width:`${w}%`}} />)}</colgroup><thead><tr>{['N','DESTINO','SALE','REGRESA','ZONA','DÍAS','ASIGNACIÓN','TOTAL'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>
    {shownRows.map((row, index) => <tr key={index} onKeyDown={event => { if (!example && event.ctrlKey && (event.key.toLowerCase() === 'x' || event.key.toLowerCase() === 'z')) { event.preventDefault(); event.key.toLowerCase() === 'x' ? removeRow(index + offset) : addBefore(index + offset) } }}><td className="itinerary-number-cell">{!example && totalRows.length > 1 && <button className="row-remove itinerary-row-remove" type="button" aria-label={`Eliminar fila de itinerario ${index + offset + 1}`} onClick={() => removeRow(index + offset)}>-</button>}{example ? row.number || '' : <input className="itinerary-input" value={row.number || String(index + offset + 1)} onChange={event => update(index, 'number', event.target.value)} onKeyDown={event => event.key === 'Enter' && addRow(index + offset)} />}</td><td>{example ? row.destination || '' : <input className="itinerary-input" list="destination-history" value={row.destination || ''} onChange={event => update(index, 'destination', event.target.value)} onKeyDown={event => event.key === 'Enter' && addRow(index)} />}</td><td className="blue-value date-cell">{example ? row.departure || '' : <DatePickerField ariaLabel={`Fecha de salida ${index + offset + 1}`} value={row.departure || ''} onChange={value => update(index, 'departure', value)} fallback="" />}</td><td className="blue-value date-cell">{example ? row.returnDate || '' : <DatePickerField ariaLabel={`Fecha de regreso ${index + offset + 1}`} value={row.returnDate || ''} onChange={value => update(index, 'returnDate', value)} fallback="" />}</td><td className="blue-value">{example ? row.zone || '' : <input className="itinerary-input" inputMode="numeric" value={row.zone || ''} onChange={event => update(index, 'zone', event.target.value)} onKeyDown={event => event.key === 'Enter' && addRow(index)} />}</td><td>{example ? row.days || '' : <input className="itinerary-input" inputMode="decimal" value={row.days || ''} onChange={event => update(index, 'days', event.target.value)} onKeyDown={event => event.key === 'Enter' && addRow(index)} />}</td><td>{example ? `L.       ${currency(row.assignment)}` : <input className="itinerary-input money-input" value={`L. ${currency(row.assignment)}`} onChange={event => update(index, 'assignment', event.target.value.replace(/[^0-9.]/g, ''))} />}</td><td className="itinerary-total-cell">{example ? `L.       ${currency(row.total)}` : <input className="itinerary-input money-input" value={`L. ${currency(row.total)}`} readOnly />}{!example && <button className="row-add itinerary-row-add" type="button" aria-label={`Añadir fila de itinerario antes de ${index + offset + 1}`} onClick={() => addBefore(index + offset)}>+</button>}</td></tr>)}
    </tbody><tfoot><tr><td>SUB</td><td>{example ? '1' : ''}</td><td>{example ? '1' : ''}</td><td>{example ? '1' : ''}</td><td>{example ? '1' : ''}</td><td>{example ? '0.25' : days || ''}</td><td></td><td>{example ? 'L.       281.25' : `L.       ${currency(totalRows.reduce((sum, row) => sum + numeric(row.total), 0))}`}</td></tr></tfoot></table></>
}

function TravelLowerBlocks({ example, d, identity, salary, level, structure, otherExpenses }) {
  const v = (text, fallback = '') => example ? text : fallback
  return <>
    <div className="trip-totals"><b>(+) OTROS GASTOS</b><strong>L. <span>{example ? '132.00' : currency(otherExpenses)}</span></strong><b>TOTAL A PAGAR</b><strong className="total-highlight">L. <span>{d.amount}</span></strong></div>
    <div className="trip-authorized"><Line /><i>VIAJE AUTORIZADO POR</i><br />{administrator}<br /><b>ADMINISTRADORA REGION DEPTAL. DE CORTES</b></div>
    <div className="trip-approved"><Line /><i>VIAJE APROBADO POR:</i><br />{director} JEFATURA<br />REGION DEPTAL. DE CORTES</div>
    <div className="trip-bottom-rule" />
    <section className="budget-structure"><b className="side-label">ESTRUCTURA</b><table><tbody>{structure.map(([key,value],index)=><tr key={key}><th>{key}</th><td className={[1,3,4,5,6].includes(index)?'blue-value':''}>{value || '\u00a0'}</td></tr>)}</tbody></table></section>
    <section className="trip-receipt"><h3>RECIBO</h3><p>Recibí de la <b>TESORERÍA GENERAL DE LA REPÚBLICA</b> la cantidad que se indica en el itinerario del viaje como adelanto para cumplir esta orden de viaje.</p><div className="trip-receipt-sign"><Line />FIRMA</div><table><tbody>{[['FECHA',v('7-sep-26', d.shortDate)],['IDENTIDAD',identity || d.identity],['SUELDO',v('L. 17,756.45', salary || d.salary)],['NIVEL',v('II', level || d.level)]].map(([key,value])=><tr key={key}><th>{key}</th><td>{value || '\u00a0'}</td></tr>)}</tbody></table></section>
    <footer className="travel-letterhead"><p>Dirección de Correo Electrónico:(riss.region5@gmail.com)</p><div><span>Region Sanitaria de Cortes Oficial <b>f</b></span><span>@regionsanitariadecortes <b>♪</b></span><span>Region Salud Cortes <b>◎</b></span><span>Region Sanitaria de Cortes TV <b>▶</b></span><span>www.salud.gob.hn</span></div></footer>
  </>
}

const shortMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function sheetDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  return `${date.getDate()}-${shortMonths[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`
}
function DatePickerField({ value, onChange, fallback, ariaLabel }) {
  const inputRef = useRef(null)
  const openCalendar = () => inputRef.current?.showPicker?.()
  return <span className="date-picker-field" onClick={openCalendar}><span>{sheetDate(value) || fallback}</span><input ref={inputRef} aria-label={ariaLabel} type="date" value={value} onChange={event => onChange(event.target.value)} /></span>
}

export function PageFour({ example, date, comprobante, identity, salary, level, amount, otherExpenses, continuationStage, itineraryRows, destinationHistory = [], zoneRates = {}, onItineraryRowsChange }) {
  const d = dataFor(example, 'Viatico', date, comprobante)
  if (!example) d.amount = currency(amount)
  const v = (text, fallback = '') => example ? text : fallback
  const structure = [['MES/AÑO', v('sep-26', d.monthYear)], ['CÓDIGO', '60'], ['UNIDAD EJECUTORA', '33'], ['PROGRAMA Y SUBPROGRAMA', '19'], ['SUBPROGRAMA', '0'], ['ACTIVIDAD U OBRA', '0'], ['FUENTE', '12'], ['OBJETO', '26210']]
  return <article className={`bond-page specimen-three continuation-page continuation-stage-${continuationStage}`} aria-label="Continuación de la hoja de viáticos">
    {itineraryRows.length > 33 && <ItineraryTable example={false} rows={itineraryRows.slice(33)} totalRows={itineraryRows} destinationHistory={destinationHistory} zoneRates={zoneRates} offset={33} onRowsChange={onItineraryRowsChange} days="" onDaysChange={() => {}} />}
    <TravelLowerBlocks example={example} d={d} identity={identity} salary={salary} level={level} structure={structure} otherExpenses={otherExpenses} />
  </article>
}

export function PageThree({ example, date, comprobante, beneficiary, identity, chequeDescription, position, salary, level, category, showBaseSalary = false, rateTables = [], rateTableCode = 'legacy', onRateTableChange, department, city, residence, itineraryRows, travelDays, travelStart, travelEnd, vehicleType, plate, driver, destinationHistory = [], driverHistory = [], plateHistory = [], zoneRates = {}, expenseRows, continuationStage, onItineraryRowsChange, onTravelDaysChange, onTravelStartChange, onTravelEndChange, onVehicleTypeChange, onPlateChange, onDriverChange, onExpenseRowsChange, onBeneficiaryChange, onIdentityChange, onChequeDescriptionChange, onPositionChange, onSalaryChange, onLevelChange, onCategoryChange, onDepartmentChange, onCityChange, onResidenceChange }) {
  const d = dataFor(example, 'Viatico', date, comprobante)
  const pageRef = useRef(null)
  const purposeRef = useRef(null)
  const v = (text, fallback = '') => example ? text : fallback
  const itineraryTotal = itineraryRows.reduce((sum, row) => sum + numeric(row.total), 0)
  const otherExpenses = expenseRows.filter(row => row.code.trim() !== '26210').reduce((sum, row) => sum + numeric(row.amount), 0)
  if (!example) d.amount = currency(itineraryTotal + otherExpenses)
  useEffect(() => {
    if (example || !onExpenseRowsChange) return
    onExpenseRowsChange(current => {
      let changed = false
      const next = current.map(row => row.code.trim() === '26210' && numeric(row.amount) !== itineraryTotal ? { ...row, amount: itineraryTotal.toFixed(2) } : row)
      next.forEach((row, index) => { if (row !== current[index]) changed = true })
      return changed ? next : current
    })
  }, [example, itineraryTotal, onExpenseRowsChange])
  useEffect(() => {
    if (example || !onItineraryRowsChange) return
    onItineraryRowsChange(current => {
      let changed = false
      const next = current.map(row => {
        const assignment = zoneRates[String(row.zone)] ? String(zoneRates[String(row.zone)]) : ''
        const total = numeric(assignment) * numeric(row.days)
        if (row.assignment === assignment && numeric(row.total) === total) return row
        changed = true
        return { ...row, assignment, total }
      })
      return changed ? next : current
    })
  }, [example, JSON.stringify(zoneRates), onItineraryRowsChange])
  useLayoutEffect(() => {
    const purpose = purposeRef.current
    const page = pageRef.current
    if (!purpose || !page) return
    const updateHeight = () => {
      const extraHeight = Math.max(0, Math.ceil(purpose.getBoundingClientRect().height - 63))
      page.style.setProperty('--purpose-shift', `${extraHeight}px`)
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(purpose)
    return () => observer.disconnect()
  }, [])
  const structure = [['MES/AÑO', v('sep-26', d.monthYear)], ['CÓDIGO', '60'], ['UNIDAD EJECUTORA', '33'], ['PROGRAMA Y SUBPROGRAMA', '19'], ['SUBPROGRAMA', '0'], ['ACTIVIDAD U OBRA', '0'], ['FUENTE', '12'], ['OBJETO', '26210']]
  const itineraryShift = Math.max(0, itineraryRows.length - 6) * 16
  return <article ref={pageRef} className={`bond-page specimen-three overflow-stage-${continuationStage}`} style={{ '--itinerary-shift': `${itineraryShift}px` }} aria-label="Hoja 3: formulario de viáticos"><Logos /><label className="rate-table-picker"><span>Tabla de viáticos</span><select aria-label="Tabla de tarifas de viáticos" value={rateTableCode} onChange={event => onRateTableChange?.(event.target.value)}>{rateTables.map(table => <option key={table.codigo} value={table.codigo}>{table.nombre}</option>)}</select></label>
    <div className="travel-institution"><b>INSTITUCIÓN</b><Line>SECRETARIA DE SALUD</Line><b>UNIDAD EJECUTORA</b><Line className="blue-value">33</Line><b>GERENCIA ADMINISTRATIVA</b><span>14</span><b>NOMBRE DE LA UNIDAD</b><span>DEPARTAMENTAL DE CORTES</span></div>
    <div className="travel-identifiers"><b>VIATICO #</b><span>{v('404-2026', d.travelReceipt)}</span><b>FECHA:</b><span>{v('7-sep-26', d.shortDate)}</span></div>
    <section className="travel-personal"><b className="side-label">PERSONALES</b>
      <div className="person-fields"><b>BENEFICIARIO:</b><EditField ariaLabel="Beneficiario en hoja 3" className="person-edit" value={beneficiary} fallback={d.beneficiary} onChange={onBeneficiaryChange} uppercase /><b>IDENTIDAD:</b><EditField ariaLabel="DNI del beneficiario en hoja 3" className="person-edit" value={identity} fallback={d.identity} onChange={onIdentityChange} /><b>PUESTO:</b><EditField ariaLabel="Puesto del beneficiario" className="person-edit" value={position} fallback={d.position} onChange={onPositionChange} /><b>SUELDO:</b><EditField ariaLabel="Sueldo del beneficiario" className="person-edit" value={salary} fallback={d.salary} onChange={onSalaryChange} /><b>NIVEL:</b><div className="person-category"><EditField ariaLabel="Nivel del beneficiario" value={level} fallback={d.level} onChange={onLevelChange} /><b>CATEGORÍA:</b>{showBaseSalary ? <span className="base-salary-category">B/SUELDO</span> : example ? <span className="green-value" style={{ fontWeight: 700, position: "relative", top: "-1px" }}>V</span> : <select aria-label="Categoría del beneficiario" className="category-select green-value" style={{ width: category ? `${Math.max(16, category.length * 8)}px` : "16px", padding: 0, border: 0, outline: 0, background: "transparent", appearance: "none", WebkitAppearance: "none", font: "inherit", fontWeight: 700, color: "var(--green)", position: "relative", top: "-1px", textAlign: "center" }} value={category} onChange={event => onCategoryChange(event.target.value)}><option value="">—</option>{['I', 'II', 'III', 'IV', 'V'].map(option => <option key={option} value={option}>{option}</option>)}</select>}</div></div>
      <div className="person-address"><b>DEPTO:</b><EditField ariaLabel="Departamento del beneficiario" className="person-address-edit" value={department} fallback={d.department} onChange={onDepartmentChange} /><b>CIUDAD:</b><EditField ariaLabel="Ciudad del beneficiario" className="person-address-edit" value={city} fallback={d.city} onChange={onCityChange} /><b>RESIDENCIA:</b><EditField ariaLabel="Residencia del beneficiario" className="person-address-edit" value={residence} fallback={d.residence} onChange={onResidenceChange} /></div>
    </section>
    <p className="travel-instructions">Se le autoriza viajar <b><i>por la vía que indique el documento</i></b> y a incurrir en los gastos que sean necesarios dentro de los límites de su asignación y de acuerdo al reglamento en vigencia. Deberá rendir una cuenta detallada al terminar su misión a la Dirección general de Presupuesto de todos los gastos en el formulario e incluyendo los comprobantes de gasto.</p>
    <section className="travel-journey"><b className="side-label">DATOS DEL VIAJE</b>
      <div ref={purposeRef} className="journey-purpose"><b>PROPÓSITO DEL VIAJE:</b><p>{example ? d.purpose : chequeDescription}</p></div>
      <div className="journey-dates"><b>EMPEZANDO EL:</b><DatePickerField ariaLabel="Fecha de inicio del viaje" value={travelStart} fallback={v('8-sep-26')} onChange={onTravelStartChange} /><b>TERMINANDO EL:</b><DatePickerField ariaLabel="Fecha de finalización del viaje" value={travelEnd} fallback={v('8-sep-26')} onChange={onTravelEndChange} /><b>VÍA:</b><strong>TERRESTRE</strong><b>DÍAS:</b><strong className="green-value">{example ? '0.25' : <input className="journey-days-input" inputMode="decimal" value={travelDays} onChange={event => { const value = event.target.value; onTravelDaysChange(value); onItineraryRowsChange(itineraryRows.map((row, rowIndex) => rowIndex === 0 ? { ...row, days: value, total: numeric(row.assignment) * numeric(value) } : row)) }} onBlur={() => onTravelDaysChange(itineraryRows.map((row, index) => index === 0 ? { ...row, days: travelDays } : row).reduce((sum, row) => sum + numeric(row.days), 0).toString())} />}</strong><b>PERIODO:</b><strong>CORTO</strong></div>
      <div className="journey-vehicle"><b>¿EN QUE VEHÍCULO VIAJA?</b><select className="vehicle-type-input" aria-label="Tipo de vehículo" value={example ? 'Del Estado' : vehicleType} onChange={event => onVehicleTypeChange(event.target.value)}><option>Del Estado</option><option>Personal</option></select><i>INDIQUE EL NÚMERO DE PLACA</i>{example ? <Line>{v('GHA2109')}</Line> : <input className="vehicle-input" list="plate-history" aria-label="Número de placa" value={plate} onChange={event => onPlateChange(event.target.value.toUpperCase())} />}<i>INDIQUE EL NOMBRE DEL CONDUCTOR</i>{example ? <Line>{v('JOSE ROMERO')}</Line> : <input className="vehicle-input" list="driver-history" aria-label="Nombre del conductor" value={driver} onChange={event => onDriverChange(event.target.value.toUpperCase())} />}</div><datalist id="plate-history">{plateHistory.map(item => <option key={item} value={item} />)}</datalist><datalist id="driver-history">{driverHistory.map(item => <option key={item} value={item} />)}</datalist>
      <div className="journey-rates"><div>CATEGORÍA {category || '—'}</div><b>ZONA 1</b><b>ZONA 2</b><b>ZONA 3</b><span>ASIGNACIÓN QUE CORRESPONDE</span><strong>{zoneRates['1'] ? `L. ${currency(zoneRates['1'])}` : '—'}</strong><strong>{zoneRates['2'] ? `L. ${currency(zoneRates['2'])}` : '—'}</strong><strong>{zoneRates['3'] ? `L. ${currency(zoneRates['3'])}` : '—'}</strong></div>
    </section>
    <ItineraryTable example={example} rows={itineraryRows.slice(0, 33)} totalRows={itineraryRows} destinationHistory={destinationHistory} zoneRates={zoneRates} onRowsChange={onItineraryRowsChange} days={travelDays} onDaysChange={onTravelDaysChange} />
    <TravelLowerBlocks example={example} d={d} identity={identity} salary={salary} level={level} structure={structure} otherExpenses={otherExpenses} />
  </article>
}
