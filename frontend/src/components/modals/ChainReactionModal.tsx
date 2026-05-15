import type { ChainReactionNoticeData } from "../../types/modals";

interface Props {
  notice: ChainReactionNoticeData;
  onClose: () => void;
}

export function ChainReactionModal({ notice, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl">
        <div className="border-b border-amber-100 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">⚠️</div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{notice.title}</h2>
              <p className="mt-1 text-sm text-amber-800">{notice.message}</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-5">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm leading-relaxed text-slate-600">
              {notice.variant === "materia" ? (
                <>
                  Al quitar esta materia, el sistema <span className="font-bold text-slate-900">desmarcó automáticamente</span>{" "}
                  <span className="font-bold text-amber-700">
                    {notice.affectedCount} {notice.affectedCount === 1 ? "materia dependiente" : "materias dependientes"}
                  </span>.
                </>
              ) : (
                <>
                  Al limpiar este semestre, el sistema <span className="font-bold text-slate-900">desmarcó automáticamente</span>{" "}
                  <span className="font-bold text-amber-700">
                    {notice.affectedCount} {notice.affectedCount === 1 ? "materia adicional" : "materias adicionales"}
                  </span>{" "}
                  de semestres superiores por pérdida de prerrequisitos.
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}