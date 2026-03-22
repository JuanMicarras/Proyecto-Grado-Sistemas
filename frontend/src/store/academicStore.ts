// src/store/academicStore.ts
import { create } from 'zustand';
import type { SimulationPayload } from '../types/academic';

interface AcademicStore {
  payload: SimulationPayload;
  toggleMateria: (codigo: string) => void;
  // NUEVO: Función genérica para actualizar cualquier parte del payload
  updatePayload: (updates: Partial<SimulationPayload>) => void;
}

export const useAcademicStore = create<AcademicStore>((set) => ({
  payload: {
    aprobadas: [],
    creditos_acumulados: 0,
    max_creditos: 17,
    perfil_estudiante: 'balanceado',
    materias_prioritarias: [],
  },
  
  toggleMateria: (codigo: string) => set((state) => {
    const yaAprobada = state.payload.aprobadas.includes(codigo);
    return {
      payload: {
        ...state.payload,
        aprobadas: yaAprobada
          ? state.payload.aprobadas.filter((c) => c !== codigo)
          : [...state.payload.aprobadas, codigo],
      }
    };
  }),

  // NUEVO: Recibe un pedacito de información y lo fusiona con el payload actual
  updatePayload: (updates) => set((state) => ({
    payload: { ...state.payload, ...updates }
  })),
}));