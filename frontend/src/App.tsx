import { useState, useMemo } from 'react';
import type { SimulationPayload, MateriaCatalogo } from './types/academic';
import { api } from './api/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { GraduationTimeline } from './components/GraduationTimeline';


export default function App() {
  const [payload, setPayload] = useState({
    aprobadas: [] as string[],
    max_creditos: 17,
    perfil_estudiante: 'balanceado' as 'suave' | 'balanceado' | 'agresivo',
  });

  // 1. FETCH DINÁMICO: Obtenemos el catálogo real de Neo4j
  const { data: catalogoData, isLoading: isLoadingCatalogo, isError: isErrorCatalogo } = useQuery({
    queryKey: ['catalogo'],
    queryFn: api.getCatalogo,
    refetchOnWindowFocus: false, // Evita peticiones innecesarias si cambias de pestaña
  });

  // 2. TRANSFORMACIÓN DE DATOS (Agrupación por Semestre)
  // Convertimos un array plano [{nombre: 'Calc I', semestre: 1}, ...] en un diccionario o array anidado.
  const semestresAgrupados = useMemo(() => {
    if (!catalogoData?.catalogo) return [];
    
    // Agrupamos por semestre usando un objeto como diccionario
    const grupos = catalogoData.catalogo.reduce((acc, materia) => {
      const sem = materia.semestre || 0; // Fallback por si alguna materia no tiene semestre
      if (!acc[sem]) acc[sem] = [];
      acc[sem].push(materia);
      return acc;
    }, {} as Record<number, MateriaCatalogo[]>);

    // Convertimos el diccionario a un array ordenado por el número del semestre
    return Object.entries(grupos)
      .map(([sem, materias]) => ({
        semestre: Number(sem),
        materias: materias.sort((a, b) => a.nombre.localeCompare(b.nombre)) // Orden alfabético dentro del semestre
      }))
      .sort((a, b) => a.semestre - b.semestre);
  }, [catalogoData]);

  // 3. ESTADO DERIVADO (Calcula créditos basándose en el catálogo real)
  const creditosAcumulados = useMemo(() => {
    if (!catalogoData?.catalogo) return 0;
    
    return payload.aprobadas.reduce((total, codigoAprobado) => {
      const materia = catalogoData.catalogo.find(m => m.codigo === codigoAprobado);
      return total + (materia?.creditos || 0);
    }, 0);
  }, [payload.aprobadas, catalogoData]);

  const simulateMutation = useMutation({
    mutationFn: api.simulatePath,
    onSuccess: (data) => {
      console.log("¡Simulación exitosa!", data);
      // TODO: Aquí redireccionaremos o mostraremos los resultados
    },
    onError: (error) => {
      console.error("Falló la simulación:", error);
    }
  });

  const toggleMateria = (codigo: string) => {
    setPayload((prev) => {
      const yaAprobada = prev.aprobadas.includes(codigo);
      return {
        ...prev,
        aprobadas: yaAprobada
          ? prev.aprobadas.filter((c) => c !== codigo)
          : [...prev.aprobadas, codigo],
      };
    });
  };
  
  const toggleSemestreCompleto = (materiasDelSemestre: MateriaCatalogo[]) => {
    const codigosSemestre = materiasDelSemestre.map(m => m.codigo);
    
    // Verificamos si TODAS las materias de este grupo ya están en el array de aprobadas
    const estanTodasSeleccionadas = codigosSemestre.every(codigo => 
      payload.aprobadas.includes(codigo)
    );

    if (estanTodasSeleccionadas) {
      // Si ya están todas, las quitamos filtrando las que NO pertenecen a este semestre
      setPayload(prev => ({
        ...prev,
        aprobadas: prev.aprobadas.filter(c => !codigosSemestre.includes(c))
      }));
    } else {
      // Si falta alguna, usamos un Set (Conjunto) para unir los arrays sin dejar duplicados
      setPayload(prev => {
        const unionSinDuplicados = new Set([...prev.aprobadas, ...codigosSemestre]);
        return {
          ...prev,
          aprobadas: Array.from(unionSinDuplicados)
        };
      });
    }
  };

  const aprobarHastaSemestre = (semestreLimite: number) => {
    if (!catalogoData?.catalogo) return;

    // Filtramos las materias hasta el semestre elegido
    const materiasAAprobar = catalogoData.catalogo
      .filter((materia) => (materia.semestre || 0) <= semestreLimite)
      .map((m) => m.codigo);

    setPayload((prev) => ({
      ...prev,
      // Reemplazamos el array completo con las nuevas materias calculadas
      aprobadas: materiasAAprobar
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    simulateMutation.mutate({ ...payload, creditos_acumulados: creditosAcumulados });
  };
  // MENTORÍA TÉCNICA: RENDERIZADO CONDICIONAL DE VISTAS
  // Si tenemos datos de la mutación, reemplazamos la pantalla entera.
  if (simulateMutation.isSuccess && simulateMutation.data && catalogoData) {
    return (
      <main className="min-h-screen bg-slate-50 py-8">
        <GraduationTimeline 
          data={simulateMutation.data} 
          catalogo={catalogoData.catalogo}
          onReset={() => simulateMutation.reset()} // Esto limpia el estado y vuelve al formulario
        />
      </main>
    );
  }
  // MENTORÍA: MANEJO DE ESTADOS DE CARGA (Skeletons / Spinners)
  if (isLoadingCatalogo) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="font-medium animate-pulse">Cargando malla curricular desde la base de datos...</p>
        </div>
      </main>
    );
  }

  if (isErrorCatalogo) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-50 p-6 rounded-2xl border border-red-200 text-center">
          <h2 className="text-red-800 font-bold text-lg">Error de Conexión</h2>
          <p className="text-red-600 mt-2 text-sm">No pudimos obtener el catálogo de materias. Verifica que el backend esté corriendo.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 flex justify-center items-start">
      <section className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-6 mt-4 md:mt-10">
        
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 leading-tight">
              Planificador Académico
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Selecciona tus materias aprobadas.
            </p>
          </div>
          
          {/* INDICADOR VISUAL DE CRÉDITOS (Reemplaza al input) */}
          <div className="flex flex-col items-end bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Acumulados</span>
            <span className="text-2xl font-black text-blue-900 leading-none mt-1">
              {creditosAcumulados} <span className="text-sm font-medium text-blue-600">cr</span>
            </span>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          
          {/* NUEVA HERRAMIENTA: LLENADO RÁPIDO */}
          <div className="flex items-center justify-between bg-blue-50/50 p-3 rounded-xl border border-blue-100">
            <span className="text-xs md:text-sm font-bold text-blue-800 flex items-center gap-2">
              ⚡ Llenado rápido
            </span>
            <select
              className="text-xs md:text-sm px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              onChange={(e) => {
                const valor = Number(e.target.value);
                if (valor > 0) aprobarHastaSemestre(valor);
                // Reseteamos el select visualmente para que actúe como un botón de acción
                e.target.value = ""; 
              }}
              defaultValue=""
            >
              <option value="" disabled>Aprobar hasta semestre...</option>
              {semestresAgrupados.map((grupo) => (
                <option key={grupo.semestre} value={grupo.semestre}>
                  Todo hasta Semestre {grupo.semestre}
                </option>
              ))}
            </select>
          </div>
          
          {/* RENDERIZADO DINÁMICO DEL CATÁLOGO REAL */}
          <div className="flex flex-col gap-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {semestresAgrupados.map((grupo) => {
              // Calculamos aquí mismo si todas están seleccionadas para saber qué texto mostrar en el botón
              const codigosGrupo = grupo.materias.map(m => m.codigo);
              const todasSeleccionadas = codigosGrupo.every(c => payload.aprobadas.includes(c));

              return (
                <div key={grupo.semestre} className="flex flex-col gap-2">
                  
                  {/* NUEVO HEADER CON BOTÓN ACCESIBLE Y ELEGANTE */}
                  <div className="flex justify-between items-end border-b pb-1 sticky top-0 bg-white z-10 pt-1">
                    <h3 className="text-sm font-bold text-slate-700">
                      Semestre {grupo.semestre}
                    </h3>
                    <button
                      type="button"
                      onClick={() => toggleSemestreCompleto(grupo.materias)}
                      className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded transition-colors ${
                        todasSeleccionadas 
                          ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-700' 
                          : 'text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      {todasSeleccionadas ? 'Limpiar semestre' : 'Seleccionar todas'}
                    </button>
                  </div>
                
                <div className="flex flex-wrap gap-2 mt-1">
                  {grupo.materias.map((materia) => {
                    const isSelected = payload.aprobadas.includes(materia.codigo);
                    return (
                      <button
                        key={materia.codigo}
                        type="button"
                        onClick={() => toggleMateria(materia.codigo)}
                        className={`
                          text-left px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 border
                          ${isSelected 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}
                        `}
                      >
                        <div className="flex justify-between items-center gap-3">
                          <span className="block font-bold">{materia.codigo}</span>
                          {/* Pequeño badge indicando los créditos en la misma píldora */}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {materia.creditos}
                          </span>
                        </div>
                        <span className={`block text-xs font-normal mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {materia.nombre}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              );
              })}
          </div>

          <hr className="border-slate-100" />

          {/* PARÁMETROS DE SIMULACIÓN (Ahora solo 2 columnas) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="max_creditos" className="text-sm font-semibold text-slate-700">Límite por Semestre</label>
              <input
                id="max_creditos"
                type="number"
                value={payload.max_creditos}
                onChange={(e) => setPayload({ ...payload, max_creditos: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="perfil" className="text-sm font-semibold text-slate-700">Perfil de Ritmo</label>
              <select
                id="perfil"
                value={payload.perfil_estudiante}
                onChange={(e) => setPayload({ ...payload, perfil_estudiante: e.target.value as any })}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none transition-all"
              >
                <option value="suave">Suave (Relajado)</option>
                <option value="balanceado">Balanceado (Recomendado)</option>
                <option value="agresivo">Agresivo (Rápido)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={simulateMutation.isPending} // Desactiva el botón si está cargando
            className={`
              w-full text-white font-bold py-4 rounded-xl shadow-sm transition-colors text-lg flex justify-center items-center gap-2
              ${simulateMutation.isPending ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}
            `}
          >
            {simulateMutation.isPending ? (
              <>
                {/* SVG de un spinner de carga girando */}
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando en el servidor...
              </>
            ) : (
              'Generar Ruta Óptima'
            )}
          </button>
          
          {/* MENSAJE DE ERROR VISUAL SI PYTHON FALLA */}
          {simulateMutation.isError && (
            <div className="p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-lg border border-red-200 text-center">
              Hubo un problema de conexión con el servidor. Revisa si tu backend en Python está encendido.
            </div>
          )}

        </form>
      </section>
    </main>
  );
}