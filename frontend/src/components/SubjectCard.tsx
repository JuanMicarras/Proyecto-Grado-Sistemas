// src/components/SubjectCard.tsx
import type { Materia } from '../types/academic';

interface Props {
  materia: Materia;
}

export function SubjectCard({ materia }: Props) {
  // MENTORÍA TÉCNICA: CSS Dinámico basado en datos reales
  const isCritica = materia.es_critica;
  
  return (
    <div className={`flex flex-col p-4 rounded-xl border shadow-sm transition-all ${
      isCritica ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
    }`}>
      <div className="flex justify-between items-start gap-2">
        <h4 className={`text-sm font-bold leading-tight ${isCritica ? 'text-red-900' : 'text-slate-800'}`}>
          {materia.nombre}
        </h4>
        {isCritica && (
          <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800 shrink-0 border border-red-200">
            ⚠️ Crítica
          </span>
        )}
      </div>
      
      <div className="mt-3 flex justify-between items-center text-xs">
        <span className={`font-mono font-medium ${isCritica ? 'text-red-700' : 'text-slate-500'}`}>
          {materia.codigo}
        </span>
        <span className={`px-2 py-0.5 rounded-full font-bold ${isCritica ? 'bg-red-200 text-red-800' : 'bg-slate-100 text-slate-600'}`}>
          {materia.creditos} cr
        </span>
      </div>
    </div>
  );
}