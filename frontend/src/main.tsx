import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import AuthProvider from './state/AuthProvider'
import './index.css'
import './redesign.css'
import { applyThemePref, readThemePref } from './lib/theme'

applyThemePref(readThemePref()) // before the first paint, so a saved choice doesn't flash the other theme

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
