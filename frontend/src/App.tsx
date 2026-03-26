// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { Home } from './components/Home';
import { GrafoInteractivo } from './components/GrafoInteractivo';
import { Resultados } from './components/Resultados';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/malla" element={<GrafoInteractivo />} /> 
      <Route path="/resultados" element={<Resultados />} />
    </Routes>
  );
}
