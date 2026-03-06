// src/components/GraduationTimeline.tsx
import type { MateriaCatalogo, SimulatePathResponse } from '../types/academic';
import { SubjectCard } from './SubjectCard';

interface Props {
  data: SimulatePathResponse;
  catalogo: MateriaCatalogo[];
  onReset: () => void; // Función para volver al formulario
}

export function GraduationTimeline({ data, catalogo, onReset }: Props) {
  const { resumen, trayectoria } = data;

  const getSemestreAncla = (materiasSimuladas: typeof trayectoria[0]['materias']) => {
    const semestresOriginales = materiasSimuladas.map(materiaSim => {
      const materiaReal = catalogo.find(c => c.codigo === materiaSim.codigo);
      return materiaReal?.semestre || 99; // Si por alguna razón no la encuentra, evitamos que rompa el Math.min
    });
    
    // Math.min extrae el número más pequeño del array de semestres
    return Math.min(...semestresOriginales);
  };

  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-6 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER DE RESULTADOS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Ruta de Graduación</h2>
          <p className="text-sm text-slate-500 mt-1">
            Proyección basada en tu algoritmo de optimización.
          </p>
        </div>
        <button 
          onClick={onReset}
          className="text-sm font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-4 py-2 rounded-lg transition-colors"
        >
          ← Modificar Parámetros
        </button>
      </div>

      {/* ALERTA DE DEADLOCK O BLOQUEO */}
      {!resumen.graduacion_alcanzada && (
        <div className="w-full p-4 rounded-xl bg-orange-50 border border-orange-200 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚧</span>
            <h3 className="text-sm font-bold text-orange-900">Atención: No se alcanza la graduación</h3>
          </div>
          <p className="text-sm text-orange-800 leading-relaxed">
            {resumen.mensaje_diagnostico}
          </p>
        </div>
      )}

      {/* GRID DE SEMESTRES */}
      <div className="flex flex-col gap-8 mt-4">
        {trayectoria.map((semestre, index) => {
          // Calculamos el semestre ancla dinámicamente para este bloque
          const semestreAncla = getSemestreAncla(semestre.materias);
          
          return (
            <article key={semestre.semestre_simulado} className="flex flex-col gap-4">
              <header className="flex justify-between items-center bg-slate-800 text-white px-4 py-2 rounded-lg">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-base font-bold">
                    {/* AQUI ESTÁ LA MAGIA: Mostramos el semestre calculado */}
                    Semestre {semestreAncla !== 99 ? semestreAncla : semestre.semestre_simulado}
                  </h3>
                  <span className="text-xs text-slate-400 font-normal">
                    (Etapa de proyección {index + 1})
                  </span>
                </div>
                <span className="text-sm font-medium bg-slate-700 px-3 py-1 rounded-full">
                  {semestre.creditos_matriculados} cr.
                </span>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {semestre.materias.map((materia) => (
                  <SubjectCard key={materia.codigo} materia={materia} />
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}