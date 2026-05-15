export function SemesterLimitModal({ nombre, codigo, semestreMateria, semestreLimite, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-2xl">
        <div className="border-b border-orange-100 bg-orange-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xl">⏳</div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Límite de Avance Académico</h2>
              <p className="mt-1 text-sm text-orange-800">Ubicación semestral restringida.</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-5 text-sm text-slate-700 leading-relaxed">
          <p>
            No puedes seleccionar <span className="font-bold text-slate-900">{nombre} ({codigo})</span> de <span className="font-bold">Semestre {semestreMateria}</span> porque todavía tienes materias pendientes de <span className="font-bold text-red-600">Semestre {semestreLimite}</span>.
          </p>
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs italic">
            * Según el reglamento, solo puedes cursar materias hasta 2 niveles por encima de tu ubicación actual.
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button onClick={onClose} className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-700 active:scale-95">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}