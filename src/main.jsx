import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './kwikbridge-lms-v2.jsx'
import { ErrorBoundary } from './components/system/ErrorBoundary'
import { initObservability, log } from './lib/observability'

// Initialize observability before rendering
initObservability().catch((e) => {
  console.error('[Bootstrap] Failed to init observability:', e)
})

// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  log.error('Unhandled promise rejection', event.reason, {
    promise: String(event.promise).slice(0, 200),
  })
})

// Capture uncaught errors that bypass React boundaries
window.addEventListener('error', (event) => {
  // Filter out errors that React already caught
  if (event.error?.message?.includes('ResizeObserver')) return
  log.error('Uncaught error', event.error, {
    filename: event.filename,
    lineno: event.lineno,
  })
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fallback="page-level" pageName="KwikBridge LMS">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
