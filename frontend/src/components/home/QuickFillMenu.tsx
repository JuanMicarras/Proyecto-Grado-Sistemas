import { useEffect, useRef } from "react";
import { nivelesIdioma } from "../../config/constants";
import type { MateriaCatalogo } from "../../types/academic";

interface Props {
  semestresAgrupados: { semestre: number; materias: MateriaCatalogo[] }[];
  quickFillOpen: boolean;
  languageFillOpen: boolean;
  setQuickFillOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setLanguageFillOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  aprobarHastaSemestre: (semestre: number) => void;
  aprobarHastaNivelIdioma: (nivel: number) => void;
}

export function QuickFillMenu({
  semestresAgrupados,
  quickFillOpen,
  languageFillOpen,
  setQuickFillOpen,
  setLanguageFillOpen,
  aprobarHastaSemestre,
  aprobarHastaNivelIdioma,
}: Props) {
  // Las referencias ahora viven dentro de su propio componente
  const quickFillRef = useRef<HTMLDivElement | null>(null);
  const languageFillRef = useRef<HTMLDivElement | null>(null);

  // El efecto de cerrar al hacer clic afuera ahora está encapsulado aquí
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickFillRef.current && !quickFillRef.current.contains(event.target as Node)) {
        setQuickFillOpen(false);
      }
      if (languageFillRef.current && !languageFillRef.current.contains(event.target as Node)) {
        setLanguageFillOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setQuickFillOpen, setLanguageFillOpen]);

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
      <span className="text-xs md:text-sm font-bold text-blue-800 flex items-center gap-2 shrink-0">
        ⚡ Llenado rápido
      </span>
      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
        
        {/* Desplegable: Aprobar hasta semestre */}
        <div className="relative w-full sm:w-auto" ref={quickFillRef}>
          <button
            type="button"
            onClick={() => setQuickFillOpen((prev) => !prev)}
            className="text-xs md:text-sm px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer flex items-center justify-between gap-1 w-full sm:w-[215px]"
          >
            <span className="truncate">Aprobar hasta semestre...</span>
            <svg
              className={`h-4 w-4 shrink-0 transition-transform ${quickFillOpen ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {quickFillOpen && (
            <div className="absolute right-0 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg z-30">
              <div className="max-h-72 overflow-y-auto py-1">
                {semestresAgrupados.map((grupo) => (
                  <button
                    key={grupo.semestre}
                    type="button"
                    onClick={() => {
                      aprobarHastaSemestre(grupo.semestre);
                      setQuickFillOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs md:text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    Todo hasta Semestre {grupo.semestre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Desplegable: Exigencia de idioma */}
        <div className="relative w-full sm:w-auto" ref={languageFillRef}>
          <button
            type="button"
            onClick={() => setLanguageFillOpen((prev) => !prev)}
            className="text-xs md:text-sm px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer flex items-center justify-between gap-1 w-full sm:w-[190px]"
          >
            <span className="truncate">Exigencia de idioma...</span>
            <svg
              className={`h-4 w-4 shrink-0 transition-transform ${languageFillOpen ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {languageFillOpen && (
            <div className="absolute right-0 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg z-30">
              <div className="max-h-72 overflow-y-auto py-1">
                {nivelesIdioma.map((item) => (
                  <button
                    key={item.nivel}
                    type="button"
                    onClick={() => {
                      aprobarHastaNivelIdioma(item.nivel);
                      setLanguageFillOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs md:text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}