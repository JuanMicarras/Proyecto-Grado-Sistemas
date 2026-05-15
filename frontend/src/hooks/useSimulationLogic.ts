// src/hooks/useSimulationLogic.ts
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAcademicStore } from "../store/academicStore";
import { api } from "../api/client";
import { CODIGO_PRACTICA, romanToLevel } from "../config/constants";
import type { 
  ChainReactionNoticeData, 
  PrereqNoticeData, 
  PartialSelectionNoticeData 
} from "../types/modals";
import type { MateriaCatalogo} from "../types/academic";

export function useSimulationLogic() {
  const navigate = useNavigate();
  const { payload, updatePayload, setSimulationResult, isFlexibleMode } = useAcademicStore();

  // --- ESTADOS LOCALES ---
  const [searchTerm, setSearchTerm] = useState("");
  const [quickFillOpen, setQuickFillOpen] = useState(false);
  const [languageFillOpen, setLanguageFillOpen] = useState(false);
    const [semesterLimitNotice, setSemesterLimitNotice] = useState<{
  nombre: string;
  codigo: string;
  semestreMateria: number;
  semestreLimite: number;
} | null>(null);
  
  // Estados para los modales
  const [chainReactionNotice, setChainReactionNotice] = useState<ChainReactionNoticeData | null>(null);
  const [prereqNotice, setPrereqNotice] = useState<PrereqNoticeData | null>(null);
  const [partialSelectionNotice, setPartialSelectionNotice] = useState<PartialSelectionNoticeData | null>(null);

  // --- QUERIES (Llamadas al backend) ---
  const { data: catalogoData, isLoading: isLoadingCatalogo, isError: isErrorCatalogo } = useQuery({
    queryKey: ["catalogo"],
    queryFn: api.getCatalogo,
    refetchOnWindowFocus: false,
  });

  const { data: graphResponse } = useQuery({
    queryKey: ["grafo-topologia"],
    queryFn: () => fetch("http://localhost:8000/api/v1/malla-visual").then((res) => res.json()),
    refetchOnWindowFocus: false,
  });

  // --- CÁLCULOS (useMemo) ---
  const topologia = useMemo(() => {
    const reqMap: Record<string, string[]> = {};
    const depMap: Record<string, string[]> = {};
    if (graphResponse?.grafo?.edges) {
      graphResponse.grafo.edges.forEach((edge: any) => {
        if (!reqMap[edge.target]) reqMap[edge.target] = [];
        reqMap[edge.target].push(edge.source);
        if (!depMap[edge.source]) depMap[edge.source] = [];
        depMap[edge.source].push(edge.target);
      });
    }
    return { reqMap, depMap };
  }, [graphResponse]);

  const semestresAgrupados = useMemo(() => {
    if (!catalogoData?.catalogo) return [];
    const grupos = catalogoData.catalogo
      .filter((m) => m.codigo !== CODIGO_PRACTICA)
      .reduce((acc, materia) => {
        const sem = materia.semestre || 0;
        if (!acc[sem]) acc[sem] = [];
        acc[sem].push(materia);
        return acc;
      }, {} as Record<number, MateriaCatalogo[]>);

    return Object.entries(grupos)
      .map(([sem, materias]) => ({
        semestre: Number(sem),
        materias: materias.sort((a, b) => a.nombre.localeCompare(b.nombre)),
      }))
      .sort((a, b) => a.semestre - b.semestre);
  }, [catalogoData]);

  const creditosAcumulados = useMemo(() => {
    if (!catalogoData?.catalogo) return 0;
    return payload.aprobadas.reduce((total, codigoAprobado) => {
      const materia = catalogoData.catalogo.find((m) => m.codigo === codigoAprobado);
      return total + (materia?.creditos || 0);
    }, 0);
  }, [payload.aprobadas, catalogoData]);

  const todasAprobadas = useMemo(() => {
    if (!catalogoData?.catalogo) return false;
    const materiasRequeridas = catalogoData.catalogo.filter((m) => {
      if (m.codigo === CODIGO_PRACTICA) return false;
      if (payload.opcion_practica && (m.codigo === "ELP4030" || m.codigo === "ELP8090")) return false;
      return true;
    });
    return materiasRequeridas.every((materia) => payload.aprobadas.includes(materia.codigo));
  }, [catalogoData, payload.aprobadas, payload.opcion_practica]);

  const resultadosBusqueda = useMemo(() => {
    if (!searchTerm || !catalogoData?.catalogo) return [];
    const term = searchTerm.toLowerCase();
    return catalogoData.catalogo
      .filter(
        (m) =>
          m.codigo !== CODIGO_PRACTICA &&
          (m.nombre.toLowerCase().includes(term) || m.codigo.toLowerCase().includes(term)) &&
          !payload.aprobadas.includes(m.codigo) &&
          !payload.materias_prioritarias.includes(m.codigo)
      )
      .slice(0, 20);
  }, [searchTerm, catalogoData, payload.aprobadas, payload.materias_prioritarias]);

  const minSemestrePendiente = useMemo(() => {
  if (!catalogoData?.catalogo) return 1;
  
  const pendientes = catalogoData.catalogo.filter(
    (m) => 
      !payload.aprobadas.includes(m.codigo) && 
      m.codigo !== CODIGO_PRACTICA 
  );

  if (pendientes.length === 0) return 10;
  return Math.min(...pendientes.map((m) => m.semestre));
}, [catalogoData, payload.aprobadas]);

  // --- FUNCIONES (Reglas de negocio) ---
  const getNivelIdioma = (materia: MateriaCatalogo) => {
    const match = materia.nombre.match(/Exigencia de Idiomas\s+(VIII|VII|VI|V|IV|III|II|I)/i);
    if (!match) return null;
    return romanToLevel[match[1].toUpperCase()] ?? null;
  };

  const aprobarHastaNivelIdioma = (nivelLimite: number) => {
    if (!catalogoData?.catalogo) return;
    const materiasIdioma = catalogoData.catalogo
      .filter((materia) => {
        const nivel = getNivelIdioma(materia);
        return nivel !== null && nivel <= nivelLimite;
      })
      .map((materia) => materia.codigo);
    const unionSinDuplicados = new Set([...payload.aprobadas, ...materiasIdioma]);
    updatePayload({ aprobadas: Array.from(unionSinDuplicados) });
  };

  const aprobarHastaSemestre = (semestreLimite: number) => {
    if (!catalogoData?.catalogo) return;
    const materiasAAprobar = catalogoData.catalogo
      .filter((materia) => (materia.semestre || 0) <= semestreLimite)
      .map((m) => m.codigo);
    updatePayload({ aprobadas: materiasAAprobar });
  };

  const handleToggleInteligente = (codigo: string, esGrafo: boolean = false) => {
    const isAprobada = payload.aprobadas.includes(codigo);

    if (!isAprobada) {
      // 1. Validación de Prerrequisitos (Aplica para ambos: Home y Grafo)
      const prerrequisitos = topologia.reqMap[codigo] || [];
      const faltantes = prerrequisitos.filter((req) => !payload.aprobadas.includes(req));

      if (faltantes.length > 0) {
        const nombresFaltantes = faltantes.map(
          (cod) => catalogoData?.catalogo.find((m) => m.codigo === cod)?.nombre || cod
        );
        const materiaActual = catalogoData?.catalogo.find((m) => m.codigo === codigo)?.nombre || codigo;
        setPrereqNotice({ codigo, nombre: materiaActual, materiasFaltantes: nombresFaltantes });
        return; // Bloqueamos porque faltan prerrequisitos
      }

      // 2. Validación Estricta de Semestre (Solo aplica para el Grafo)
      if (esGrafo) {
        const materiaActual = catalogoData?.catalogo.find(m => m.codigo === codigo);
        
        // REGLA DE ORO: No más de 2 semestres de diferencia
        // EXCEPCIÓN: Exigencias de Idiomas (códigos que inician con IGL) pueden saltar esta regla
        if (
          materiaActual && 
          !materiaActual.codigo.startsWith("IGL") && 
          materiaActual.semestre >= minSemestrePendiente + 3
        ) {
          setSemesterLimitNotice({
            nombre: materiaActual.nombre,
            codigo: materiaActual.codigo,
            semestreMateria: materiaActual.semestre,
            semestreLimite: minSemestrePendiente
          });
          return; // Bloqueamos por ubicación semestral
        }
      }

      // 3. Si pasa TODAS las validaciones, por fin aprobamos la materia
      updatePayload({ aprobadas: [...payload.aprobadas, codigo] });

    } else {
      // Lógica de deselección (Reacción en cascada BFS)
      const aEliminar = new Set<string>([codigo]);
      const cola = [codigo];

      while (cola.length > 0) {
        const actual = cola.shift()!;
        const dependientes = topologia.depMap[actual] || [];
        dependientes.forEach((dep) => {
          if (payload.aprobadas.includes(dep) && !aEliminar.has(dep)) {
            aEliminar.add(dep);
            cola.push(dep);
          }
        });
      }

      const dependientesDesmarcadas = aEliminar.size - 1;
      if (dependientesDesmarcadas > 0) {
        setChainReactionNotice({
          title: "Reacción en cadena",
          message: "Se actualizaron materias dependientes de forma automática.",
          affectedCount: dependientesDesmarcadas,
          variant: "materia",
        });
      }
      
      // Eliminamos la materia clickeada y sus dependientes
      updatePayload({ aprobadas: payload.aprobadas.filter((c) => !aEliminar.has(c)) });
    }
  };


  const toggleSemestreCompleto = (materiasDelSemestre: MateriaCatalogo[]) => {
    const codigosSemestre = materiasDelSemestre.map((m) => m.codigo);
    const estanTodasSeleccionadas = codigosSemestre.every((codigo) => payload.aprobadas.includes(codigo));

    if (estanTodasSeleccionadas) {
      const aEliminar = new Set<string>(codigosSemestre);
      const cola = [...codigosSemestre];

      while (cola.length > 0) {
        const actual = cola.shift()!;
        const dependientes = topologia.depMap[actual] || [];
        dependientes.forEach((dep) => {
          if (payload.aprobadas.includes(dep) && !aEliminar.has(dep)) {
            aEliminar.add(dep);
            cola.push(dep);
          }
        });
      }

      const eliminadasExtra = aEliminar.size - codigosSemestre.length;
      if (eliminadasExtra > 0) {
        setChainReactionNotice({
          title: "Reacción en cadena",
          message: "Se actualizaron materias dependientes de forma automática.",
          affectedCount: eliminadasExtra,
          variant: "semestre",
        });
      }
      updatePayload({ aprobadas: payload.aprobadas.filter((c) => !aEliminar.has(c)) });
    } else {
      const codigosAprobables = codigosSemestre.filter((codigo) => {
        if (payload.aprobadas.includes(codigo)) return true;
        const prerrequisitos = topologia.reqMap[codigo] || [];
        return prerrequisitos.every((req) => payload.aprobadas.includes(req));
      });

      const unionSinDuplicados = new Set([...payload.aprobadas, ...codigosAprobables]);
      updatePayload({ aprobadas: Array.from(unionSinDuplicados) });

      if (codigosAprobables.length < codigosSemestre.length) {
        setPartialSelectionNotice({
          selectedCount: codigosAprobables.length,
          omittedCount: codigosSemestre.length - codigosAprobables.length,
        });
      }
    }
  };

  const togglePrioridad = (codigo: string) => {
    if (payload.materias_prioritarias.includes(codigo)) {
      updatePayload({ materias_prioritarias: payload.materias_prioritarias.filter((c) => c !== codigo) });
      return;
    }
    if (payload.materias_prioritarias.length >= 5) {
      alert("Para no sobrecargar el algoritmo, puedes elegir un máximo de 5 materias prioritarias.");
      return;
    }
    updatePayload({ materias_prioritarias: [...payload.materias_prioritarias, codigo] });
    setSearchTerm("");
  };

  const simulateMutation = useMutation({
    mutationFn: (payloadFinal: any) =>
      isFlexibleMode ? api.simulateFlexiblePath(payloadFinal) : api.simulatePath(payloadFinal),
    onSuccess: (data) => {
      setSimulationResult(data);
      navigate("/resultados");
    },
    onError: (error) => console.error("Falló la simulación:", error),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    simulateMutation.mutate({ ...payload, creditos_acumulados: creditosAcumulados });
  };
  // --- RETORNO DEL HOOK ---
  // Aquí empaquetamos todo para que el componente Home lo consuma fácilmente
  return {
    estado: {
      isLoadingCatalogo,
      isErrorCatalogo,
      catalogoData,
      topologia,
      semestresAgrupados,
      creditosAcumulados,
      todasAprobadas,
      resultadosBusqueda,
      searchTerm,
      quickFillOpen,
      languageFillOpen,
      minSemestrePendiente
    },
    acciones: {
      setSearchTerm,
      setQuickFillOpen,
      setLanguageFillOpen,
      handleToggleInteligente,
      toggleSemestreCompleto,
      togglePrioridad,
      aprobarHastaSemestre,
      aprobarHastaNivelIdioma,
      handleSubmit,
    },
    modales: {
      chainReactionNotice,
      prereqNotice,
      partialSelectionNotice,
      setChainReactionNotice,
      setPrereqNotice,
      setPartialSelectionNotice, 
      semesterLimitNotice, 
      setSemesterLimitNotice
    },
    mutacion: simulateMutation,
  };
}