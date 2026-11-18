import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import './offline.css'

const desktop = '__TAURI_INTERNALS__' in window
const Router = desktop ? HashRouter : BrowserRouter
if (desktop) {
  // Los enlaces del editor usan el router; los enlaces externos conservan su destino.
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[href^="/"]')
    if (anchor) { event.preventDefault(); window.location.hash = anchor.getAttribute('href') }
  })
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Router><App /></Router></React.StrictMode>,
)

if (!desktop && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
