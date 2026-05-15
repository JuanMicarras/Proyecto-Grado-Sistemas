import { useEffect, useState } from "react";
import { useAcademicStore } from "../../store/academicStore";
import { LIMITE_BASE_CREDITOS, URLS } from "../../config/constants";

export function SimulationSettings() {
  const { payload, updatePayload, isFlexibleMode, setFlexibleMode } = useAcademicStore();
  
  // Estado local encapsulado
  const [extracreditoActivo, setExtracreditoActivo] = useState(payload.max_creditos > LIMITE_BASE_CREDITOS);
  const extracreditos = Math.max(0, payload.max_creditos - LIMITE_BASE_CREDITOS);

  useEffect(() => {
    setExtracreditoActivo(payload.max_creditos > LIMITE_BASE_CREDITOS);
  }, [payload.max_creditos]);

  const handleMaxCreditosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === "") {
      updatePayload({ max_creditos: 0 });
      return;
    }
    const value = Number(rawValue);
    const limitedValue = Math.max(7, Math.min(21, value));
    updatePayload({ max_creditos: limitedValue });
  };

  const handleExtracreditoChange = (checked: boolean) => {
    if (!checked) {
      setExtracreditoActivo(false);
      updatePayload({ max_creditos: LIMITE_BASE_CREDITOS });
      return;
    }
    if (payload.max_creditos > LIMITE_BASE_CREDITOS) {
      setExtracreditoActivo(true);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="max_creditos" className="text-sm font-semibold text-slate-700">
            Límite de créditos por Semestre
          </label>
          <div className="relative">
            <input
              id="max_creditos"
              type="number"
              min={7}
              max={21}
              value={payload.max_creditos}
              onChange={handleMaxCreditosChange}
              className="w-full px-4 py-3 pr-4 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-inner-spin-button]:cursor-pointer [&::-webkit-outer-spin-button]:opacity-100"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="perfil" className="text-sm font-semibold text-slate-500">
              Perfil de Ritmo
            </label>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              Deshabilitado
            </span>
          </div>
          <div className="relative">
            <select
              id="perfil"
              value={payload.perfil_estudiante}
              disabled
              aria-disabled="true"
              className="w-full px-4 py-3 pr-10 rounded-lg border border-slate-200 bg-slate-100 text-slate-400 outline-none appearance-none cursor-not-allowed opacity-70"
            >
              <option value="suave">Suave (Relajado)</option>
              <option value="balanceado">Balanceado (Recomendado)</option>
              <option value="agresivo">Agresivo (Rápido)</option>
            </select>
          </div>
        </div>
      </div>

      <hr className="border-slate-100" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`flex items-center justify-between p-4 rounded-xl border ${payload.max_creditos > LIMITE_BASE_CREDITOS ? "bg-cyan-50/60 border-cyan-200" : "bg-slate-50 border-slate-200"}`}>
          <div className="pr-4 flex-1">
            <h3 className={`text-sm font-bold flex items-center gap-2 ${payload.max_creditos > LIMITE_BASE_CREDITOS ? "text-cyan-900" : "text-slate-500"}`}>
              💳 Extracrédito
            </h3>
            <p className={`text-xs mt-1 ${payload.max_creditos > LIMITE_BASE_CREDITOS ? "text-cyan-800" : "text-slate-500"}`}>
              Más de 17 créditos implica pago de extracrédito.
            </p>
            <div className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${payload.max_creditos > LIMITE_BASE_CREDITOS ? "text-cyan-800" : "text-slate-500"}`}>
              <span><span className="font-semibold">Extracréditos:</span> {extracreditos}</span>
              <span>
                <a href={URLS.PRECIO_EXTRACREDITO} target="_blank" rel="noreferrer" className={`font-semibold underline ${payload.max_creditos > LIMITE_BASE_CREDITOS ? "text-cyan-700" : "text-slate-600"}`}>
                  Valor actual
                </a>
              </span>
            </div>
          </div>
          <label className={`relative inline-flex items-center ml-4 shrink-0 self-start ${payload.max_creditos > LIMITE_BASE_CREDITOS ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
            <input type="checkbox" className="sr-only peer" checked={extracreditoActivo} disabled={payload.max_creditos <= LIMITE_BASE_CREDITOS} onChange={(e) => handleExtracreditoChange(e.target.checked)} />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600 peer-disabled:bg-slate-200"></div>
          </label>
        </div>

        <div className="flex items-center justify-between bg-amber-50/50 p-4 rounded-xl border border-amber-200">
          <div className="pr-4 flex-1">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">⚡ Habilitar Avance Flexible</h3>
            <p className="text-xs text-amber-700 mt-1 pl-2">Permite al algoritmo saltar ciertos prerrequisitos si cumples con las condiciones. Ideal para adelantar materias.</p>
            <div className="mt-2 pl-2 flex items-center gap-4 text-xs whitespace-nowrap">
              <a href={URLS.AVANCE_FLEXIBLE_VIDEO} target="_blank" rel="noreferrer" className="font-semibold text-amber-800 underline hover:text-amber-900">Video explicativo</a>
              <a href={URLS.AVANCE_FLEXIBLE_PDF} target="_blank" rel="noreferrer" className="font-semibold text-amber-800 underline hover:text-amber-900">PDF informativo</a>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer ml-1 shrink-0 self-start">
            <input type="checkbox" className="sr-only peer" checked={isFlexibleMode} onChange={(e) => setFlexibleMode(e.target.checked)} />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        <div className="md:col-span-2 flex items-center justify-between bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
          <div className="pr-4 flex-1">
            <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">💼 Opción de Grado: Práctica Profesional</h3>
            <p className="text-xs text-emerald-700 mt-1 pl-2">Si activas esto, el motor matemático ajustará automáticamente la ruta para que curses <strong>PML4130</strong> (Práctica).</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer ml-1 shrink-0 self-start">
            <input type="checkbox" className="sr-only peer" checked={payload.opcion_practica} onChange={(e) => updatePayload({ opcion_practica: e.target.checked })} />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </div>
    </div>
  );
}