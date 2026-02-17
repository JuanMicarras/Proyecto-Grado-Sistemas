import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'reactflow/dist/style.css';

// Asegúrate de que este puerto coincida con el de uvicorn (normalmente 8000)
const API_URL = "http://127.0.0.1:8000";

function App() {
  const [materias, setMaterias] = useState([]); // Inicializado como array vacío
  const [aprobadas, setAprobadas] = useState([]); 
  const [planSugerido, setPlanSugerido] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [esFlexible, setEsFlexible] = useState(false);
  const [errorBackend, setErrorBackend] = useState("");

  useEffect(() => {
    fetchMaterias();
  }, []);

  const fetchMaterias = async () => {
    try {
        // CAMBIO CLAVE: Usamos GET a /catalogo
        const res = await axios.get(`${API_URL}/catalogo`);
        
        console.log("Datos recibidos del backend:", res.data); // Para depuración

        // Verificación defensiva: Si es un array, lo usamos. Si no, array vacío.
        if (Array.isArray(res.data)) {
            setMaterias(res.data);
        } else {
            console.error("El formato recibido no es una lista:", res.data);
            setMaterias([]);
        }
    } catch (error) {
        console.error("Error conectando al backend:", error);
        setErrorBackend("No se pudo conectar con el servidor Python. Revisa que esté corriendo.");
    }
  };

  const toggleMateria = (codigo) => {
    if (aprobadas.includes(codigo)) {
      setAprobadas(aprobadas.filter(id => id !== codigo));
    } else {
      setAprobadas([...aprobadas, codigo]);
    }
  };

  const optimizarRuta = async () => {
    setCargando(true);
    setPlanSugerido(null); // Limpiar resultado anterior
    try {
      const payload = {
        materias_aprobadas: aprobadas,
        max_creditos: 17,
        es_avance_flexible: esFlexible
      };
      
      const res = await axios.post(`${API_URL}/optimizar`, payload);
      setPlanSugerido(res.data.plan);
    } catch (error) {
      alert("Error: " + (error.response?.data?.detail || "No se pudo generar el plan. Verifica que no hayas marcado todas las materias o que el servidor funcione."));
    }
    setCargando(false);
  };

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      
      {/* PANEL IZQUIERDO */}
      <div style={{ width: '35%', padding: '20px', borderRight: '1px solid #ccc', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{color: '#2c3e50'}}>1. Tu Historial</h2>
        
        {errorBackend && (
            <div style={{padding: '10px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '10px'}}>
                ⚠️ {errorBackend}
            </div>
        )}

        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f4c3', borderRadius: '5px' }}>
          <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}}>
            <input 
              type="checkbox" 
              checked={esFlexible} 
              onChange={(e) => setEsFlexible(e.target.checked)}
              style={{marginRight: '10px', transform: 'scale(1.2)'}} 
            /> 
            <b>Modo Avance Flexible</b>
            <span style={{fontSize: '0.8em', marginLeft: '5px', color: '#666'}}>(Ignorar bloqueos de nivel)</span>
          </label>
        </div>

        <p>Marca las materias aprobadas:</p>

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
            {/* AQUÍ ESTABA EL ERROR: Agregamos materias?.map para seguridad */}
            {materias && materias.length > 0 ? (
                materias.map((m) => (
                    <div key={m.codigo} 
                         onClick={() => toggleMateria(m.codigo)}
                         style={{ 
                            padding: '8px 12px', 
                            borderBottom: '1px solid #eee',
                            cursor: 'pointer',
                            backgroundColor: aprobadas.includes(m.codigo) ? '#e3f2fd' : 'white',
                            color: '#333',
                            display: 'flex',
                            alignItems: 'center'
                         }}>
                        <input 
                            type="checkbox" 
                            checked={aprobadas.includes(m.codigo)} 
                            readOnly
                            style={{marginRight: '10px'}}
                        />
                        <div style={{fontSize: '14px'}}>
                            <span style={{fontWeight: 'bold', color: '#1565c0'}}>{m.codigo}</span>
                            <br/>
                            {m.nombre} <span style={{color: '#888', fontSize: '0.9em'}}>(Sem {m.semestre_sugerido})</span>
                        </div>
                    </div>
                ))
            ) : (
                <div style={{padding: '20px', textAlign: 'center', color: '#999'}}>
                    {errorBackend ? "Error de conexión" : "Cargando materias..."}
                </div>
            )}
        </div>
        
        <button 
          onClick={optimizarRuta}
          disabled={cargando || materias.length === 0}
          style={{ 
            marginTop: '15px', padding: '15px', width: '100%', 
            backgroundColor: cargando ? '#b0bec5' : '#007bff', 
            color: 'white', border: 'none', 
            borderRadius: '5px', cursor: cargando ? 'wait' : 'pointer', 
            fontSize: '16px', fontWeight: 'bold' 
          }}
        >
          {cargando ? "CALCULANDO..." : "GENERAR RUTA ÓPTIMA 🚀"}
        </button>
      </div>

      {/* PANEL DERECHO */}
      <div style={{ width: '65%', padding: '30px', backgroundColor: '#f5f7fa', overflowY: 'auto' }}>
        <h2 style={{color: '#2c3e50', marginTop: 0}}>2. Plan Sugerido</h2>
        
        {!planSugerido ? (
          <div style={{textAlign: 'center', marginTop: '50px', color: '#78909c'}}>
            <p style={{fontSize: '1.2em'}}>Selecciona tus materias a la izquierda y presiona el botón azul.</p>
            <p>El sistema calculará la ruta más rápida para tu grado.</p>
          </div>
        ) : (
          <div>
            {planSugerido.map((semestre) => (
              <div key={semestre.semestre_relativo} style={{ 
                background: 'white', padding: '20px', marginBottom: '20px', 
                borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                borderLeft: '5px solid #4caf50'
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                    <h3 style={{ margin: 0, color: '#333' }}>Semestre Futuro {semestre.semestre_relativo}</h3>
                    <span style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '5px 10px', borderRadius: '15px', fontSize: '0.9em', fontWeight: 'bold' }}>
                        {semestre.creditos} Créditos
                    </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                  {semestre.materias.map((m) => (
                    <div key={m.codigo} style={{ 
                      border: '1px solid #e0e0e0', padding: '10px', borderRadius: '6px',
                      backgroundColor: '#ffffff', fontSize: '14px',
                      color: '#333',
                    }}>
                      <div style={{fontWeight: 'bold', color: '#1976d2', marginBottom: '4px'}}>{m.codigo}</div>
                      <div style={{marginBottom: '5px'}}>{m.nombre}</div>
                      <div style={{fontSize: '0.85em', color: '#757575'}}>Créditos: {m.creditos}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;