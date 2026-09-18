import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import Admin from './Admin'

const page = window.location.pathname.startsWith('/admin') ? <Admin /> : <App />
createRoot(document.getElementById('root')!).render(<StrictMode>{page}</StrictMode>)
