import type { MateriaCatalogo } from "../../types/academic";

interface Props {
  semestresAgrupados: { semestre: number; materias: MateriaCatalogo[] }[];
  aprobadas: string[];
  topologia: { reqMap: Record<string, string[]>; depMap: Record<string, string[]> };
  onToggleSemestreCompleto: (materias: MateriaCatalogo[]) => void;
  onToggleInteligente: (codigo: string) => void;
}

export function SemesterGrid({
  semestresAgrupados,
  aprobadas,
  topologia,
  onToggleSemestreCompleto,
  onToggleInteligente,
}: Props) {
  return (
    <div className="flex flex-col gap-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
      {semestresAgrupados.map((grupo) => {
        const codigosGrupo = grupo.materias.map((m) => m.codigo);
        const todasSeleccionadas = codigosGrupo.every((c) => aprobadas.includes(c));

        return (
          <div key={grupo.semestre} className="flex flex-col gap-2">
            <div className="flex justify-between items-end border-b pb-1 sticky top-0 bg-white z-10 pt-1">
              <h3 className="text-sm font-bold text-slate-700">Semestre {grupo.semestre}</h3>
              <button
                type="button"
                onClick={() => onToggleSemestreCompleto(grupo.materias)}
                className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded transition-colors ${
                  todasSeleccionadas
                    ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    : "text-blue-600 hover:bg-blue-50"
                }`}
              >
                {todasSeleccionadas ? "Limpiar semestre" : "Seleccionar todas"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-1">
              {grupo.materias.map((materia) => {
                const isSelected = aprobadas.includes(materia.codigo);
                const prerrequisitos = topologia.reqMap[materia.codigo] || [];
                const isLocked = !isSelected && prerrequisitos.some((req) => !aprobadas.includes(req));

                return (
                  <button
                    key={materia.codigo}
                    type="button"
                    onClick={() => onToggleInteligente(materia.codigo)}
                    className={`
                      text-left px-3 py-2 rounded-lg text-sm font-medium transition-all border w-full sm:w-auto flex-grow
                      ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600 shadow-md active:scale-95"
                          : isLocked
                            ? "bg-slate-50/50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60 grayscale"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-200 shadow-sm active:scale-95"
                      }
                    `}
                  >
                    <div className="flex justify-between items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        {isLocked && <span className="text-[10px]">🔒</span>}
                        <span className="block font-bold">{materia.codigo}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isSelected
                            ? "bg-blue-500 text-white"
                            : isLocked
                              ? "bg-slate-200 text-slate-400"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        {materia.creditos} cr
                      </span>
                    </div>
                    <span className={`block text-xs font-normal mt-0.5 ${isSelected ? "text-blue-100" : isLocked ? "text-slate-400" : "text-slate-500"}`}>
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
  );
}