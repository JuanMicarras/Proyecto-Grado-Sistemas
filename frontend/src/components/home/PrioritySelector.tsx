import type { MateriaCatalogo } from "../../types/academic";

interface Props {
  materiasPrioritarias: string[];
  catalogo: MateriaCatalogo[] | undefined;
  searchTerm: string;
  resultadosBusqueda: MateriaCatalogo[];
  onSearchChange: (term: string) => void;
  onTogglePrioridad: (codigo: string) => void;
}

export function PrioritySelector({
  materiasPrioritarias,
  catalogo,
  searchTerm,
  resultadosBusqueda,
  onSearchChange,
  onTogglePrioridad,
}: Props) {
  return (
    <div className="flex flex-col gap-3 bg-purple-50/50 p-4 rounded-xl border border-purple-100">
      <header>
        <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
          🎯 ¿Tienes alguna prioridad?
        </h3>
        <p className="text-xs text-purple-700 mt-1">
          Busca hasta 5 materias que te urge cursar. Nuestro algoritmo intentará
          adelantarlas lo más posible.
        </p>
      </header>

      {materiasPrioritarias.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {materiasPrioritarias.map((codigo) => {
            const materiaReal = catalogo?.find((c) => c.codigo === codigo);
            return (
              <span
                key={codigo}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-600 text-white shadow-sm animate-in zoom-in duration-200"
              >
                {codigo} - {materiaReal?.nombre.substring(0, 15)}...
                <button
                  type="button"
                  onClick={() => onTogglePrioridad(codigo)}
                  className="ml-1 hover:text-purple-200 transition-colors bg-purple-800/30 rounded-full p-0.5"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={materiasPrioritarias.length >= 5}
          placeholder={
            materiasPrioritarias.length >= 5
              ? "Límite alcanzado"
              : "Escribe el nombre o código..."
          }
          className="w-full px-4 py-3 rounded-lg border border-purple-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
        />

        {resultadosBusqueda.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 flex flex-col overflow-hidden">
            {resultadosBusqueda.map((materia) => (
              <button
                key={materia.codigo}
                type="button"
                onClick={() => onTogglePrioridad(materia.codigo)}
                className="text-left px-4 py-3 text-sm hover:bg-purple-50 border-b border-slate-100 last:border-0 flex justify-between items-center transition-colors"
              >
                <div>
                  <span className="font-bold text-slate-800 block">
                    {materia.nombre}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {materia.codigo}
                  </span>
                </div>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded font-medium text-slate-600">
                  Sem {materia.semestre}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}