import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import { MobileApp } from './pages/mobile/MobileApp'
import './index.css'
import { ThemeProvider } from "./context/ThemeContext"

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="rl-theme-v3">
      <BrowserRouter>
        <Routes>
          <Route path="/mobile/*" element={<MobileApp />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
