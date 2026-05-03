import { useEffect, useMemo, useRef, useState } from "react";
import type { SimulationPayload, MateriaCatalogo } from "../types/academic";
import { api } from "../api/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GraduationTimeline } from "./GraduationTimeline";
import { useNavigate } from "react-router-dom";
import { useAcademicStore } from "../store/academicStore";

const LIMITE_BASE_CREDITOS = 17;
const PRECIO_EXTRACREDITO_URL =
  "https://www.uninorte.edu.co/documents/19420483/68546913/Tarifas+derechos+pecuniarios+en+la+web+-+ajustado+2026+marzo+20+%281%29.pdf/9977c107-9cad-6a7a-925b-88e2393b5f49?t=1775593952436";
const AVANCE_FLEXIBLE_VIDEO_URL = "https://www.youtube.com/watch?v=fPw8G3YfclY";
const AVANCE_FLEXIBLE_PDF_URL = "/docs/Avance Flexible 202610.pdf";

export function Home() {
  const {
    payload,
    toggleMateria,
    updatePayload,
    setSimulationResult,
    isFlexibleMode,
    setFlexibleMode,
  } = useAcademicStore();

  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [quickFillOpen, setQuickFillOpen] = useState(false);
  const [extracreditoActivo, setExtracreditoActivo] = useState(false);
  const quickFillRef = useRef<HTMLDivElement | null>(null);

  const extracreditos = Math.max(
    0,
    payload.max_creditos - LIMITE_BASE_CREDITOS,
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        quickFillRef.current &&
        !quickFillRef.current.contains(event.target as Node)
      ) {
        setQuickFillOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setExtracreditoActivo(payload.max_creditos > LIMITE_BASE_CREDITOS);
  }, [payload.max_creditos]);

  const {
    data: catalogoData,
    isLoading: isLoadingCatalogo,
    isError: isErrorCatalogo,
  } = useQuery({
    queryKey: ["catalogo"],
    queryFn: api.getCatalogo,
    refetchOnWindowFocus: false,
  });

  const resultadosBusqueda = useMemo(() => {
    if (!searchTerm || !catalogoData?.catalogo) return [];

    const term = searchTerm.toLowerCase();

    return catalogoData.catalogo
      .filter(
        (m) =>
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

    const grupos = catalogoData.catalogo.reduce(
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
      updatePayload({
        aprobadas: payload.aprobadas.filter(
          (c) => !codigosSemestre.includes(c),
        ),
      });
    } else {
      const unionSinDuplicados = new Set([
        ...payload.aprobadas,
        ...codigosSemestre,
      ]);

      updatePayload({
        aprobadas: Array.from(unionSinDuplicados),
      });
    }
  };

  const aprobarHastaSemestre = (semestreLimite: number) => {
    if (!catalogoData?.catalogo) return;

    const materiasAAprobar = catalogoData.catalogo
      .filter((materia) => (materia.semestre || 0) <= semestreLimite)
      .map((m) => m.codigo);

    updatePayload({ aprobadas: materiasAAprobar });
  };

  const handleMaxCreditosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;

    if (rawValue === "") {
      updatePayload({ max_creditos: 0 });
      return;
    }

    const value = Number(rawValue);
    const limitedValue = Math.max(0, Math.min(21, value));

    updatePayload({
      max_creditos: limitedValue,
    });
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
          <div className="flex items-center justify-between bg-blue-50/50 p-3 rounded-xl border border-blue-100">
            <span className="text-xs md:text-sm font-bold text-blue-800 flex items-center gap-2">
              ⚡ Llenado rápido
            </span>

            <div className="relative" ref={quickFillRef}>
              <button
                type="button"
                onClick={() => setQuickFillOpen((prev) => !prev)}
                className="text-xs md:text-sm px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer flex items-center justify-between gap-3 min-w-[220px] md:min-w-[260px]"
              >
                <span>Aprobar hasta semestre...</span>

                <svg
                  className={`h-4 w-4 transition-transform ${
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
                <div className="absolute right-0 mt-2 w-full min-w-[220px] md:min-w-[260px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg z-30">
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
          </div>

          <div className="flex flex-col gap-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {semestresAgrupados.map((grupo) => {
              const codigosGrupo = grupo.materias.map((m) => m.codigo);

              const todasSeleccionadas = codigosGrupo.every((c) =>
                payload.aprobadas.includes(c),
              );

              return (
                <div key={grupo.semestre} className="flex flex-col gap-2">
                  <div className="flex justify-between items-end border-b pb-1 sticky top-0 bg-white z-10 pt-1">
                    <h3 className="text-sm font-bold text-slate-700">
                      Semestre {grupo.semestre}
                    </h3>

                    <button
                      type="button"
                      onClick={() => toggleSemestreCompleto(grupo.materias)}
                      className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded transition-colors ${
                        todasSeleccionadas
                          ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          : "text-blue-600 hover:bg-blue-50"
                      }`}
                    >
                      {todasSeleccionadas
                        ? "Limpiar semestre"
                        : "Seleccionar todas"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-1">
                    {grupo.materias.map((materia) => {
                      const isSelected = payload.aprobadas.includes(
                        materia.codigo,
                      );

                      return (
                        <button
                          key={materia.codigo}
                          type="button"
                          onClick={() => toggleMateria(materia.codigo)}
                          className={`
                            text-left px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 border
                            ${
                              isSelected
                                ? "bg-blue-600 text-white border-blue-600 shadow-md"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }
                          `}
                        >
                          <div className="flex justify-between items-center gap-3">
                            <span className="block font-bold">
                              {materia.codigo}
                            </span>

                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                isSelected
                                  ? "bg-blue-500 text-white"
                                  : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              {materia.creditos}
                            </span>
                          </div>

                          <span
                            className={`block text-xs font-normal mt-0.5 ${
                              isSelected ? "text-blue-100" : "text-slate-400"
                            }`}
                          >
                            {materia.nombre}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <hr className="border-slate-100" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="max_creditos"
                className="text-sm font-semibold text-slate-700"
              >
                Límite de créditos por Semestre
              </label>

              <div className="relative">
                <input
                  id="max_creditos"
                  type="number"
                  min={0}
                  max={21}
                  value={payload.max_creditos}
                  onChange={handleMaxCreditosChange}
                  className="
                    w-full px-4 py-3 pr-4 rounded-lg border border-slate-200
                    bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500
                    outline-none transition-all
                    [&::-webkit-inner-spin-button]:opacity-100
                    [&::-webkit-inner-spin-button]:cursor-pointer
                    [&::-webkit-outer-spin-button]:opacity-100
                  "
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="perfil"
                  className="text-sm font-semibold text-slate-500"
                >
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
                  title="Esta opción estará disponible más adelante"
                  className="
                    w-full px-4 py-3 pr-10 rounded-lg border border-slate-200
                    bg-slate-100 text-slate-400 outline-none appearance-none
                    cursor-not-allowed opacity-70
                  "
                >
                  <option value="suave">Suave (Relajado)</option>
                  <option value="balanceado">Balanceado (Recomendado)</option>
                  <option value="agresivo">Agresivo (Rápido)</option>
                </select>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              className={`flex items-center justify-between p-4 rounded-xl border ${
                payload.max_creditos > LIMITE_BASE_CREDITOS
                  ? "bg-cyan-50/60 border-cyan-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="pr-4 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className={`text-sm font-bold flex items-center gap-2 ${
                      payload.max_creditos > LIMITE_BASE_CREDITOS
                        ? "text-cyan-900"
                        : "text-slate-500"
                    }`}
                  >
                    💳 Extracrédito
                  </h3>
                </div>

                <p
                  className={`text-xs mt-1 ${
                    payload.max_creditos > LIMITE_BASE_CREDITOS
                      ? "text-cyan-800"
                      : "text-slate-500"
                  }`}
                >
                  Más de 17 créditos implica pago de extracrédito.
                </p>

                <div
                  className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${
                    payload.max_creditos > LIMITE_BASE_CREDITOS
                      ? "text-cyan-800"
                      : "text-slate-500"
                  }`}
                >
                  <span>
                    <span className="font-semibold">Extracréditos:</span>{" "}
                    {extracreditos}
                  </span>

                  <span>
                    <a
                      href={PRECIO_EXTRACREDITO_URL}
                      target="_blank"
                      rel="noreferrer"
                      className={`font-semibold underline ${
                        payload.max_creditos > LIMITE_BASE_CREDITOS
                          ? "text-cyan-700"
                          : "text-slate-600"
                      }`}
                    >
                      Valor actual
                    </a>
                  </span>
                </div>
              </div>

              <label
                title={
                  payload.max_creditos <= LIMITE_BASE_CREDITOS
                    ? "Disponible al superar 17 créditos por semestre."
                    : "Desactivar extracrédito"
                }
                className={`relative inline-flex items-center ml-4 shrink-0 self-start ${
                  payload.max_creditos > LIMITE_BASE_CREDITOS
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={extracreditoActivo}
                  disabled={payload.max_creditos <= LIMITE_BASE_CREDITOS}
                  onChange={(e) => handleExtracreditoChange(e.target.checked)}
                />

                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600 peer-disabled:bg-slate-200"></div>
              </label>
            </div>

            <div className="flex items-center justify-between bg-amber-50/50 p-4 rounded-xl border border-amber-200">
              <div className="pr-4 flex-1">
                <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  ⚡ Habilitar Avance Flexible
                </h3>

                <p className="text-xs text-amber-700 mt-1 pl-2">
                  Permite al algoritmo saltar ciertos prerrequisitos si cumples
                  con las condiciones. Ideal para adelantar materias.
                </p>

                <div className="mt-2 pl-2 flex items-center gap-4 text-xs whitespace-nowrap">
                  <a
                    href={AVANCE_FLEXIBLE_VIDEO_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-amber-800 underline hover:text-amber-900"
                  >
                    Video explicativo
                  </a>

                  <a
                    href={AVANCE_FLEXIBLE_PDF_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-amber-800 underline hover:text-amber-900"
                  >
                    PDF informativo
                  </a>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer ml-1 shrink-0 self-start">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isFlexibleMode}
                  onChange={(e) => setFlexibleMode(e.target.checked)}
                />

                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

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

          <button
            type="submit"
            disabled={simulateMutation.isPending}
            className={`
              w-full text-white font-bold py-4 rounded-xl shadow-sm transition-colors text-lg flex justify-center items-center gap-2
              ${
                simulateMutation.isPending
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
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
            ) : (
              "Generar Ruta Óptima"
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
    </main>
  );
}
