import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { registerSW } from 'virtual:pwa-register'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

registerSW({
  immediate: true,
  onRegistered(registration) {
    console.log('Service Worker registered:', registration)
  },
  onRegisterError(error) {
    console.error('Service Worker registration failed:', error)
  },
})
