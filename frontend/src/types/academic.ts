// src/types/academic.ts

export interface SimulationPayload {
  aprobadas: string[];
  creditos_acumulados: number;
  max_creditos: number;
  perfil_estudiante: 'balanceado' | 'agresivo' | 'suave';
  materias_prioritarias: string[];
}

export interface Materia {
  codigo: string;
  nombre: string;
  creditos: number;
  es_critica: boolean;
}

export interface ResumenSimulacion {
  estado_simulacion: string;
  mensaje_diagnostico: string;
  graduacion_alcanzada: boolean;
  semestres_extra_requeridos: number;
  total_creditos_carrera: number;
}

export interface SemestreSimulado {
  semestre_simulado: number;
  creditos_matriculados: number;
  materias: Materia[];
}

export interface SimulatePathResponse {
  resumen: ResumenSimulacion;
  trayectoria: SemestreSimulado[];
}

export interface MateriaCatalogo {
  codigo: string;
  nombre: string;
  creditos: number;
  semestre: number; // Asumo que tu BD devuelve a qué semestre pertenece
}

export interface CatalogoResponse {
  metadata: {
    plan: string;
    total_materias: number;
  };
  catalogo: MateriaCatalogo[];
}