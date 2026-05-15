export interface ChainReactionNoticeData {
  title: string;
  message: string;
  affectedCount: number;
  variant: "materia" | "semestre";
}

export interface PrereqNoticeData {
  codigo: string;
  nombre: string;
  materiasFaltantes: string[];
}

export interface PartialSelectionNoticeData {
  selectedCount: number;
  omittedCount: number;
}