import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { BrowserRouter } from 'react-router-dom'
// 2. Instanciamos el cliente (el "cerebro" que maneja la caché y las peticiones)
const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 3. Envolvemos nuestra App. Ahora todos los componentes hijos pueden usar hooks de red */}
    <QueryClientProvider client={queryClient}>
      <BrowserRouter> 
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)