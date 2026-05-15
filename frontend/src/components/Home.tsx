import { useEffect, useMemo, useRef, useState } from "react";
import type { SimulationPayload, MateriaCatalogo } from "../types/academic";
import type {
  ChainReactionNoticeData,
  PrereqNoticeData,
  PartialSelectionNoticeData,
} from "../types/modals";
import { api } from "../api/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GraduationTimeline } from "./GraduationTimeline";
import { useNavigate } from "react-router-dom";
import { useAcademicStore } from "../store/academicStore";
import {
  LIMITE_BASE_CREDITOS,
  CODIGO_PRACTICA,
  URLS,
  nivelesIdioma,
  romanToLevel,
} from "../config/constants";
import { ChainReactionModal } from "./modals/ChainReactionModal";
import { PrereqNoticeModal } from "./modals/PrereqNoticeModal";
import { PartialSelectionModal } from "./modals/PartialSelectionModal";
import { SemesterGrid } from "./home/SemesterGrid";
import { SimulationSettings } from "./home/SimulationSettings";
import { useSimulationLogic } from "../hooks/useSimulationLogic";

export function Home() {
  const {
    payload,
    updatePayload,
    setSimulationResult,
    isFlexibleMode,
    setFlexibleMode,
  } = useAcademicStore();

  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [quickFillOpen, setQuickFillOpen] = useState(false);
  const [languageFillOpen, setLanguageFillOpen] = useState(false);

  const [chainReactionNotice, setChainReactionNotice] =
    useState<ChainReactionNoticeData | null>(null);
  const [prereqNotice, setPrereqNotice] = useState<PrereqNoticeData | null>(
    null,
  );
  const [partialSelectionNotice, setPartialSelectionNotice] =
    useState<PartialSelectionNoticeData | null>(null);

  const quickFillRef = useRef<HTMLDivElement | null>(null);
  const languageFillRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        quickFillRef.current &&
        !quickFillRef.current.contains(event.target as Node)
      ) {
        setQuickFillOpen(false);
      }

      if (
        languageFillRef.current &&
        !languageFillRef.current.contains(event.target as Node)
      ) {
        setLanguageFillOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const {
    data: catalogoData,
    isLoading: isLoadingCatalogo,
    isError: isErrorCatalogo,
  } = useQuery({
    queryKey: ["catalogo"],
    queryFn: api.getCatalogo,
    refetchOnWindowFocus: false,
  });

  const { data: graphResponse } = useQuery({
    queryKey: ["grafo-topologia"],
    queryFn: () =>
      fetch("http://localhost:8000/api/v1/malla-visual").then((res) =>
        res.json(),
      ),
    refetchOnWindowFocus: false,
  });

  const topologia = useMemo(() => {
    const reqMap: Record<string, string[]> = {};
    const depMap: Record<string, string[]> = {};

    if (graphResponse?.grafo?.edges) {
      graphResponse.grafo.edges.forEach((edge: any) => {
        const { source, target } = edge;

        if (!reqMap[target]) reqMap[target] = [];
        reqMap[target].push(source);

        if (!depMap[source]) depMap[source] = [];
        depMap[source].push(target);
      });
    }

    return { reqMap, depMap };
  }, [graphResponse]);

  const resultadosBusqueda = useMemo(() => {
    if (!searchTerm || !catalogoData?.catalogo) return [];

    const term = searchTerm.toLowerCase();

    return catalogoData.catalogo
      .filter(
        (m) =>
          m.codigo !== CODIGO_PRACTICA &&
          (m.nombre.toLowerCase().includes(term) ||
            m.codigo.toLowerCase().includes(term)) &&
          !payload.aprobadas.includes(m.codigo) &&
          !payload.materias_prioritarias.includes(m.codigo),
      )
      .slice(0, 20);
  }, [
    searchTerm,
    catalogoData,
    payload.aprobadas,
    payload.materias_prioritarias,
  ]);

  const getNivelIdioma = (materia: MateriaCatalogo) => {
    const match = materia.nombre.match(
      /Exigencia de Idiomas\s+(VIII|VII|VI|V|IV|III|II|I)/i,
    );

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

    const unionSinDuplicados = new Set([
      ...payload.aprobadas,
      ...materiasIdioma,
    ]);

    updatePayload({
      aprobadas: Array.from(unionSinDuplicados),
    });
  };

  const handleToggleInteligente = (codigo: string) => {
    const isAprobada = payload.aprobadas.includes(codigo);

    if (!isAprobada) {
      const prerrequisitos = topologia.reqMap[codigo] || [];
      const faltantes = prerrequisitos.filter(
        (req) => !payload.aprobadas.includes(req),
      );

      if (faltantes.length > 0) {
        const nombresFaltantes = faltantes.map(
          (cod) =>
            catalogoData?.catalogo.find((m) => m.codigo === cod)?.nombre || cod,
        );

        const materiaActual =
          catalogoData?.catalogo.find((m) => m.codigo === codigo)?.nombre ||
          codigo;

        setPrereqNotice({
          codigo,
          nombre: materiaActual,
          materiasFaltantes: nombresFaltantes,
        });

        return;
      }

      updatePayload({ aprobadas: [...payload.aprobadas, codigo] });
    } else {
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

      updatePayload({
        aprobadas: payload.aprobadas.filter((c) => !aEliminar.has(c)),
      });
    }
  };

  const togglePrioridad = (codigo: string) => {
    const yaEsta = payload.materias_prioritarias.includes(codigo);

    if (yaEsta) {
      updatePayload({
        materias_prioritarias: payload.materias_prioritarias.filter(
          (c) => c !== codigo,
        ),
      });
      return;
    }

    if (payload.materias_prioritarias.length >= 5) {
      alert(
        "Para no sobrecargar el algoritmo, puedes elegir un máximo de 3 materias prioritarias.",
      );
      return;
    }

    updatePayload({
      materias_prioritarias: [...payload.materias_prioritarias, codigo],
    });

    setSearchTerm("");
  };

  const semestresAgrupados = useMemo(() => {
    if (!catalogoData?.catalogo) return [];

    const grupos = catalogoData.catalogo
      .filter((m) => m.codigo !== CODIGO_PRACTICA)
      .reduce(
        (acc, materia) => {
          const sem = materia.semestre || 0;

          if (!acc[sem]) acc[sem] = [];
          acc[sem].push(materia);

          return acc;
        },
        {} as Record<number, MateriaCatalogo[]>,
      );

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
      const materia = catalogoData.catalogo.find(
        (m) => m.codigo === codigoAprobado,
      );

      return total + (materia?.creditos || 0);
    }, 0);
  }, [payload.aprobadas, catalogoData]);

  const todasAprobadas = useMemo(() => {
    if (!catalogoData?.catalogo) return false;
    const materiasRequeridas = catalogoData.catalogo.filter((m) => {
      if (m.codigo === CODIGO_PRACTICA) return false;
      if (
        payload.opcion_practica &&
        (m.codigo === "ELP4030" || m.codigo === "ELP8090")
      ) {
        return false;
      }

      return true;
    });
    return materiasRequeridas.every((materia) =>
      payload.aprobadas.includes(materia.codigo),
    );
  }, [catalogoData, payload.aprobadas, payload.opcion_practica]);

  const simulateMutation = useMutation({
    mutationFn: (payloadFinal: SimulationPayload) =>
      isFlexibleMode
        ? api.simulateFlexiblePath(payloadFinal)
        : api.simulatePath(payloadFinal),
    onSuccess: (data) => {
      setSimulationResult(data);
      navigate("/resultados");
    },
    onError: (error) => {
      console.error("Falló la simulación:", error);
      alert("Error al contactar con el motor de optimización.");
    },
  });

  const toggleSemestreCompleto = (materiasDelSemestre: MateriaCatalogo[]) => {
    const codigosSemestre = materiasDelSemestre.map((m) => m.codigo);

    const estanTodasSeleccionadas = codigosSemestre.every((codigo) =>
      payload.aprobadas.includes(codigo),
    );

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

      updatePayload({
        aprobadas: payload.aprobadas.filter((c) => !aEliminar.has(c)),
      });
    } else {
      const codigosAprobables = codigosSemestre.filter((codigo) => {
        if (payload.aprobadas.includes(codigo)) return true;

        const prerrequisitos = topologia.reqMap[codigo] || [];
        const cumpleRequisitos = prerrequisitos.every((req) =>
          payload.aprobadas.includes(req),
        );

        return cumpleRequisitos;
      });

      const unionSinDuplicados = new Set([
        ...payload.aprobadas,
        ...codigosAprobables,
      ]);

      updatePayload({
        aprobadas: Array.from(unionSinDuplicados),
      });

      if (codigosAprobables.length < codigosSemestre.length) {
        const omitidas = codigosSemestre.length - codigosAprobables.length;

        setPartialSelectionNotice({
          selectedCount: codigosAprobables.length,
          omittedCount: omitidas,
        });
      }
    }
  };

  const aprobarHastaSemestre = (semestreLimite: number) => {
    if (!catalogoData?.catalogo) return;

    const materiasAAprobar = catalogoData.catalogo
      .filter((materia) => (materia.semestre || 0) <= semestreLimite)
      .map((m) => m.codigo);

    updatePayload({ aprobadas: materiasAAprobar });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payloadFinal = {
      ...payload,
      creditos_acumulados: creditosAcumulados,
    };

    simulateMutation.mutate(payloadFinal);
  };

  if (simulateMutation.isSuccess && simulateMutation.data && catalogoData) {
    return (
      <main className="min-h-screen bg-slate-50 py-8">
        <GraduationTimeline
          data={simulateMutation.data}
          catalogo={catalogoData.catalogo}
          onReset={() => simulateMutation.reset()}
        />
      </main>
    );
  }

  if (isLoadingCatalogo) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="font-medium animate-pulse">
            Cargando malla curricular desde la base de datos...
          </p>
        </div>
      </main>
    );
  }

  if (isErrorCatalogo) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-50 p-6 rounded-2xl border border-red-200 text-center">
          <h2 className="text-red-800 font-bold text-lg">Error de Conexión</h2>
          <p className="text-red-600 mt-2 text-sm">
            No pudimos obtener el catálogo de materias. Verifica que el backend
            esté corriendo.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 flex justify-center items-start">
      <section className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-6 mt-4 md:mt-10">
        <header className="flex justify-between items-start">
          <div>
            <div className="inline-flex items-center  border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700 mb-2">
              Ingeniería de Sistemas
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight">
              Planificador Académico
            </h1>

            <p className="text-sm md:text-base text-slate-500 mt-1">
              Selecciona tus materias aprobadas.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/malla")}
              className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md transition-all"
            >
              Explorar Malla Interactiva
            </button>

            <div className="flex flex-col items-end bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Acumulados
              </span>
              <span className="text-2xl font-black text-blue-900 leading-none mt-1">
                {creditosAcumulados}{" "}
                <span className="text-sm font-medium text-blue-600">cr</span>
              </span>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
            {" "}
            <span className="text-xs md:text-sm font-bold text-blue-800 flex items-center gap-2 shrink-0">
              ⚡ Llenado rápido
            </span>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-auto" ref={quickFillRef}>
                <button
                  type="button"
                  onClick={() => setQuickFillOpen((prev) => !prev)}
                  className="text-xs md:text-sm px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer flex items-center justify-between gap-1 w-full sm:w-[215px]"
                >
                  <span className="truncate">Aprobar hasta semestre...</span>

                  <svg
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      quickFillOpen ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {quickFillOpen && (
                  <div className="absolute right-0 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg z-30">
                    <div className="max-h-72 overflow-y-auto py-1">
                      {semestresAgrupados.map((grupo) => (
                        <button
                          key={grupo.semestre}
                          type="button"
                          onClick={() => {
                            aprobarHastaSemestre(grupo.semestre);
                            setQuickFillOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs md:text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          Todo hasta Semestre {grupo.semestre}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative w-full sm:w-auto" ref={languageFillRef}>
                <button
                  type="button"
                  onClick={() => setLanguageFillOpen((prev) => !prev)}
                  className="text-xs md:text-sm px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer flex items-center justify-between gap-1 w-full sm:w-[190px]"
                >
                  <span className="truncate">Exigencia de idioma...</span>

                  <svg
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      languageFillOpen ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {languageFillOpen && (
                  <div className="absolute right-0 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg z-30">
                    <div className="max-h-72 overflow-y-auto py-1">
                      {nivelesIdioma.map((item) => (
                        <button
                          key={item.nivel}
                          type="button"
                          onClick={() => {
                            aprobarHastaNivelIdioma(item.nivel);
                            setLanguageFillOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs md:text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Componente del Grid de Materias */}
          <SemesterGrid
            semestresAgrupados={semestresAgrupados}
            aprobadas={payload.aprobadas}
            topologia={topologia}
            onToggleSemestreCompleto={toggleSemestreCompleto}
            onToggleInteligente={handleToggleInteligente}
          />

          <hr className="border-slate-100" />

          {/* Componente de Configuraciones y Extracrédito */}
          <SimulationSettings />

          <hr className="border-slate-100" />

          <div className="flex flex-col gap-3 bg-purple-50/50 p-4 rounded-xl border border-purple-100">
            <header>
              <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                🎯 ¿Tienes alguna prioridad?
              </h3>

              <p className="text-xs text-purple-700 mt-1">
                Busca hasta 5 materias que te urge cursar. Nuestro algoritmo
                intentará adelantarlas lo más posible.
              </p>
            </header>

            {payload.materias_prioritarias.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {payload.materias_prioritarias.map((codigo) => {
                  const materiaReal = catalogoData?.catalogo.find(
                    (c) => c.codigo === codigo,
                  );

                  return (
                    <span
                      key={codigo}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-600 text-white shadow-sm animate-in zoom-in duration-200"
                    >
                      {codigo} - {materiaReal?.nombre.substring(0, 15)}...
                      <button
                        type="button"
                        onClick={() => togglePrioridad(codigo)}
                        className="ml-1 hover:text-purple-200 transition-colors bg-purple-800/30 rounded-full p-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={payload.materias_prioritarias.length >= 5}
                placeholder={
                  payload.materias_prioritarias.length >= 5
                    ? "Límite alcanzado"
                    : "Escribe el nombre o código..."
                }
                className="w-full px-4 py-3 rounded-lg border border-purple-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
              />

              {resultadosBusqueda.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 flex flex-col overflow-hidden">
                  {resultadosBusqueda.map((materia) => (
                    <button
                      key={materia.codigo}
                      type="button"
                      onClick={() => togglePrioridad(materia.codigo)}
                      className="text-left px-4 py-3 text-sm hover:bg-purple-50 border-b border-slate-100 last:border-0 flex justify-between items-center transition-colors"
                    >
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {materia.nombre}
                        </span>

                        <span className="text-slate-500 text-xs">
                          {materia.codigo}
                        </span>
                      </div>

                      <span className="text-xs bg-slate-100 px-2 py-1 rounded font-medium text-slate-600">
                        Sem {materia.semestre}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mensaje de feedback opcional */}
          {todasAprobadas && (
            <div className="p-3 bg-green-50 text-green-700 text-sm font-semibold rounded-lg border border-green-200 text-center animate-in fade-in duration-300">
              Has seleccionado todas las materias de la malla. ¡Ya cumples con
              los requisitos base para graduarte! 🎓
            </div>
          )}

          <button
            type="submit"
            disabled={simulateMutation.isPending || todasAprobadas}
            className={`
              w-full text-white font-bold py-4 rounded-xl shadow-sm transition-colors text-lg flex justify-center items-center gap-2
              ${
                simulateMutation.isPending || todasAprobadas
                  ? "bg-slate-400 cursor-not-allowed" // Color gris si está deshabilitado
                  : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]" // Color normal
              }
            `}
          >
            {simulateMutation.isPending ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Procesando en el servidor...
              </>
            ) : todasAprobadas ? (
              "Malla Completada" // Texto alternativo
            ) : (
              "Generar Ruta Óptima" // Texto original
            )}
          </button>

          {simulateMutation.isError && (
            <div className="p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-lg border border-red-200 text-center">
              Hubo un problema de conexión con el servidor. Revisa si tu backend
              en Python está encendido.
            </div>
          )}
        </form>
      </section>

      {chainReactionNotice && (
        <ChainReactionModal
          notice={chainReactionNotice}
          onClose={() => setChainReactionNotice(null)}
        />
      )}
      {prereqNotice && (
        <PrereqNoticeModal
          notice={prereqNotice}
          onClose={() => setPrereqNotice(null)}
        />
      )}
      {partialSelectionNotice && (
        <PartialSelectionModal
          notice={partialSelectionNotice}
          onClose={() => setPartialSelectionNotice(null)}
        />
      )}
    </main>
  );
}
