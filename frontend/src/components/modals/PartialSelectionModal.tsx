import type { PartialSelectionNoticeData } from "../../types/modals";

interface Props {
  notice: PartialSelectionNoticeData;
  onClose: () => void;
}

export function PartialSelectionModal({ notice, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-2xl">
        <div className="border-b border-blue-100 bg-blue-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl">💡</div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Selección parcial</h2>
              <p className="mt-1 text-sm text-blue-800">Se aplicó una selección automática según los prerrequisitos disponibles.</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-5">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm leading-relaxed text-slate-600">
              El sistema seleccionó <span className="font-bold text-slate-900">{notice.selectedCount} {notice.selectedCount === 1 ? "materia válida" : "materias válidas"}</span> y omitió <span className="font-bold text-blue-700">{notice.omittedCount} {notice.omittedCount === 1 ? "materia" : "materias"}</span> porque todavía no cumples con sus prerrequisitos.
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