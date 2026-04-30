import { useNavigate, Navigate } from 'react-router-dom';
import { useAcademicStore } from '../store/academicStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function Resultados() {
  const navigate = useNavigate();
  const { simulationResult, setSimulationResult, payload } = useAcademicStore();

  // MENTORÍA TÉCNICA: Rescatamos el catálogo de la caché de TanStack Query.
  // Como ya se descargó en la pantalla principal, esto carga al instante.
  const { data: catalogoData } = useQuery({
    queryKey: ['catalogo'],
    queryFn: api.getCatalogo,
    refetchOnWindowFocus: false,
  });

  // PROTECCIÓN DE RUTA
  if (!simulationResult) {
    return <Navigate to="/" replace />;
  }

  const { resumen, trayectoria } = simulationResult;

  const handleReiniciar = () => {
    setSimulationResult(null);
    navigate('/');
  };

  // Función de Enriquecimiento: Busca el semestre original más bajo del bloque
  const getSemestreAncla = (materiasSimuladas: any[]) => {
    if (!catalogoData?.catalogo) return 99;

    const semestresOriginales = materiasSimuladas.map((materiaSim) => {
      const materiaReal = catalogoData.catalogo.find(
        (c: any) => c.codigo === materiaSim.codigo,
      );

      return materiaReal?.semestre || 99;
    });

    return Math.min(...semestresOriginales);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans py-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-8">
        {/* HEADER LIMPIO Y VERTICAL */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Ruta de Graduación
            </h1>
            <p className="text-slate-500 mt-2 font-medium">
              Proyección optimizada en{' '}
              <span className="text-blue-600 font-bold">
                {trayectoria.length} bloques académicos
              </span>
              .
            </p>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={handleReiniciar}
              className="flex-1 md:flex-none text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 font-bold text-sm px-4 py-2.5 rounded-xl transition-colors text-center"
            >
              ← Modificar
            </button>

            <button
              onClick={() => window.print()}
              className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              🖨️ Guardar PDF
            </button>
          </div>
        </header>

        {/* ALERTA DE DEADLOCK */}
        {!resumen.graduacion_alcanzada && (
          <div className="p-5 rounded-2xl bg-orange-50 border border-orange-200 flex items-start gap-4 shadow-sm">
            <span className="text-3xl">🚧</span>

            <div>
              <h3 className="text-base font-bold text-orange-900">
                Atención: No se alcanza la graduación
              </h3>

              <p className="text-sm text-orange-800 mt-1 leading-relaxed">
                {resumen.mensaje_diagnostico ||
                  'El motor de inferencia determinó que faltan créditos o prerrequisitos para completar la malla en esta proyección.'}
              </p>
            </div>
          </div>
        )}

        {/* LÍNEA DE TIEMPO VERTICAL */}
        <div className="flex flex-col gap-10">
          {trayectoria.map((semestre, index) => {
            // Calculamos el semestre ancla dinámicamente para este bloque
            const semestreAncla = getSemestreAncla(semestre.materias);
            const tituloSemestre =
              semestreAncla !== 99
                ? semestreAncla
                : semestre.semestre_simulado;

            return (
              <section
                key={semestre.semestre_simulado}
                className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                {/* ENCABEZADO RESTAURADO: Semestre X (Etapa de proyección Y) */}
                <div className="flex justify-between items-center bg-slate-800 text-white px-5 py-3 rounded-xl shadow-sm">
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-lg font-bold">
                      Semestre {tituloSemestre}
                    </h2>

                    <span className="text-xs text-slate-400 font-normal hidden sm:inline-block">
                      (Etapa de proyección {index + 1})
                    </span>
                  </div>

                  <span className="text-sm font-bold bg-slate-700 px-3 py-1 rounded-lg text-blue-200">
                    {semestre.creditos_matriculados} créditos
                  </span>
                </div>

                {/* Grid de Tarjetas de Materias */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {semestre.materias.map((materia) => {
                    const isCritica = materia.es_critica;
                    const isFlexible = materia.requiere_avance_flexible;
                    const isPrioritaria =
                      payload.materias_prioritarias.includes(materia.codigo);

                    return (
                      <article
                        key={materia.codigo}
                        className={`flex flex-col p-5 rounded-xl border transition-all shadow-sm bg-white
                          ${
                            isCritica
                              ? 'border-red-300 ring-1 ring-red-100'
                              : isFlexible
                                ? 'border-amber-400 bg-amber-50/30'
                                : 'border-slate-200 hover:border-blue-300'
                          }
                        `}
                      >
                        <div className="flex justify-between items-start gap-2 mb-3">
                          <span
                            className={`font-mono text-xs font-bold tracking-widest 
                            ${
                              isCritica
                                ? 'text-red-500'
                                : isFlexible
                                  ? 'text-amber-600'
                                  : isPrioritaria
                                    ? 'text-purple-500'
                                    : 'text-slate-400'
                            }`}
                          >
                            {materia.codigo}
                          </span>

                          <div className="flex gap-1.5 flex-wrap justify-end">
                            {isFlexible && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 shrink-0 shadow-sm">
                                ⚡ Adelanto
                              </span>
                            )}

                            {isPrioritaria && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-100 shrink-0">
                                🎯 Prioritaria
                              </span>
                            )}

                            {isCritica && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-600 border border-red-100 shrink-0">
                                ⚠️ Crítica
                              </span>
                            )}
                          </div>
                        </div>

                        <h3
                          className={`text-base font-bold leading-tight mb-4 
                          ${
                            isCritica
                              ? 'text-slate-800'
                              : isFlexible
                                ? 'text-amber-900'
                                : isPrioritaria
                                  ? 'text-purple-950'
                                  : 'text-slate-700'
                          }`}
                        >
                          {materia.nombre}
                        </h3>

                        <div className="mt-auto pt-3 border-t border-slate-100 flex justify-end items-center">
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold 
                            ${
                              isCritica
                                ? 'bg-red-50 text-red-700'
                                : isFlexible
                                  ? 'bg-amber-100 text-amber-700'
                                  : isPrioritaria
                                    ? 'bg-purple-50 text-purple-700'
                                    : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {materia.creditos} cr
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* META: Graduación Alcanzada */}
          {resumen.graduacion_alcanzada && (
            <div className="mt-4 p-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl text-white text-center shadow-lg transform transition-transform hover:scale-[1.01]">
              <span className="text-5xl block mb-4">🎓</span>

              <h2 className="text-2xl font-black tracking-tight mb-2">
                ¡Objetivo Completado!
              </h2>

              <p className="text-green-100 font-medium text-sm md:text-base">
                Has completado exitosamente la malla curricular en esta
                proyección.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}