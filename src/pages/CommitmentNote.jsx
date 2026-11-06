import React from 'react'
import logo from '../../images/logo 2026.png'

const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function dateText(value) {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  return `${day} de ${months[month - 1]} de ${year}`
}
function Fill({ children }) { return <span className="commitment-fill">{children || '\u00a0'}</span> }

export default function CommitmentNote({ beneficiary, identity, itineraryRows, travelStart, travelEnd, city, date }) {
  const destinations = [...new Set(itineraryRows.map(row => row.destination.trim()).filter(Boolean))].join(', ')
  const departures = itineraryRows.map(row => row.departure).filter(Boolean).sort()
  const returns = itineraryRows.map(row => row.returnDate).filter(Boolean).sort()
  return <article className="bond-page commitment-page" aria-label="Nota de compromiso">
    <div className="sheet-logos"><img src={logo} alt="Secretaría de Salud · Región Sanitaria de Cortés" /></div>
    <h2>NOTA DE COMPROMISO</h2>
    <section className="commitment-body">
      <p>Por este medio yo; <Fill>{beneficiary}</Fill></p>
      <p>Con número de DNI: <Fill>{identity}</Fill></p>
      <p>Me comprometo a realizar la gira programada a: <Fill>{destinations}</Fill></p>
      <p>Del <Fill>{dateText(travelStart || departures[0])}</Fill> al <Fill>{dateText(travelEnd || returns.at(-1))}</Fill>;</p>
      <p>Y realizaré la correspondiente liquidación en tiempo y forma, según el artículo número 21, que dice así; <b>“Finalizada la misión, el viajero tendrá un plazo máximo de cinco días hábiles para presentar a la gerencia administrativa la liquidación de viáticos recibidos una vez que haya retornado a su domicilio habitual. Las facturas deben ser originales, sin enmiendas ni tachaduras. A ningún viajero se le podrá autorizar nuevos viáticos si tuviere pendiente la liquidación del viaje anterior.”</b></p>
      <p>De no realizar la gira programada deberá realizar la respectiva devolución de los viáticos conforme al artículo número 22 del Reglamento de Viáticos, mediante reintegro a la cuenta institucional correspondiente. El incumplimiento a esta obligación dará lugar a las acciones administrativas que correspondan.</p>
      <p>En constancia a lo anterior, firmo la presente en la ciudad de <Fill>{city}</Fill> a los <Fill>{dateText(date)}</Fill>.</p>
    </section>
    <div className="commitment-signature"><span />Firma Beneficiario</div>
    <footer className="travel-letterhead"><p>Dirección de Correo Electrónico:(riss.region5@gmail.com)</p><div><span>Region Sanitaria de Cortes Oficial <b>f</b></span><span>@regionsanitariadecortes <b>♪</b></span><span>Region Salud Cortes <b>◎</b></span><span>Region Sanitaria de Cortes TV <b>▶</b></span><span>www.salud.gob.hn</span></div></footer>
  </article>
}
