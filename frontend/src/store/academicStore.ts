// src/store/academicStore.ts
import { create } from "zustand";
import type {
  SimulatePathResponse,
  SimulationPayload,
} from "../types/academic";

interface AcademicStore {
  payload: SimulationPayload;
  simulationResult: SimulatePathResponse | null;

  toggleMateria: (codigo: string) => void;
  updatePayload: (updates: Partial<SimulationPayload>) => void;
  setSimulationResult: (result: SimulatePathResponse | null) => void;
  isFlexibleMode: boolean; 
  setFlexibleMode: (active: boolean) => void;
}

export const useAcademicStore = create<AcademicStore>((set) => ({
  payload: {
    aprobadas: [],
    creditos_acumulados: 0,
    max_creditos: 17,
    perfil_estudiante: "balanceado",
    materias_prioritarias: [],
    opcion_practica: false,
    
  },
  isFlexibleMode: false, // Por defecto apagado
  setFlexibleMode: (active) => set({ isFlexibleMode: active }),
  simulationResult: null,
  toggleMateria: (codigo: string) =>
    set((state) => {
      const yaAprobada = state.payload.aprobadas.includes(codigo);
      return {
        payload: {
          ...state.payload,
          aprobadas: yaAprobada
            ? state.payload.aprobadas.filter((c) => c !== codigo)
            : [...state.payload.aprobadas, codigo],
        },
      };
    }),

  // NUEVO: Recibe un pedacito de información y lo fusiona con el payload actual
  updatePayload: (updates) =>
    set((state) => ({
      payload: { ...state.payload, ...updates },
    })),

    setSimulationResult: (result) => set({ simulationResult: result }),

}));
