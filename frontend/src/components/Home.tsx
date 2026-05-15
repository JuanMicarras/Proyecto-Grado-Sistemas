import { GraduationTimeline } from "./GraduationTimeline";
import { useNavigate } from "react-router-dom";
import { useAcademicStore } from "../store/academicStore";
import { ChainReactionModal } from "./modals/ChainReactionModal";
import { PrereqNoticeModal } from "./modals/PrereqNoticeModal";
import { PartialSelectionModal } from "./modals/PartialSelectionModal";
import { SemesterGrid } from "./home/SemesterGrid";
import { SimulationSettings } from "./home/SimulationSettings";
import { useSimulationLogic } from "../hooks/useSimulationLogic";
import { PrioritySelector } from "./home/PrioritySelector";
import { QuickFillMenu } from "./home/QuickFillMenu";

export function Home() {
  const navigate = useNavigate();
  const { payload } = useAcademicStore();
  const { estado, acciones, modales, mutacion } = useSimulationLogic();

  if (mutacion.isSuccess && mutacion.data && estado.catalogoData) {
    return (
      <main className="min-h-screen bg-slate-50 py-8">
        <GraduationTimeline
          data={mutacion.data}
          catalogo={estado.catalogoData.catalogo}
          onReset={() => mutacion.reset()}
        />
      </main>
    );
  }

  if (estado.isLoadingCatalogo) {
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

  if (estado.isErrorCatalogo) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-50 p-6 rounded-2xl border border-red-200 text-center">
          <h2 className="text-red-800 font-bold text-lg">Error de Conexión</h2>
          <p className="text-red-600 mt-2 text-sm">
            No pudimos obtener el catálogo de materias. Verifica que el backend esté corriendo.
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
                {estado.creditosAcumulados} <span className="text-sm font-medium text-blue-600">cr</span>
              </span>
            </div>
          </div>
        </header>

        <form onSubmit={acciones.handleSubmit} className="flex flex-col gap-8">
          
          <QuickFillMenu 
            semestresAgrupados={estado.semestresAgrupados}
            quickFillOpen={estado.quickFillOpen}
            languageFillOpen={estado.languageFillOpen}
            setQuickFillOpen={acciones.setQuickFillOpen}
            setLanguageFillOpen={acciones.setLanguageFillOpen}
            aprobarHastaSemestre={acciones.aprobarHastaSemestre}
            aprobarHastaNivelIdioma={acciones.aprobarHastaNivelIdioma}
          />

          <SemesterGrid
            semestresAgrupados={estado.semestresAgrupados}
            aprobadas={payload.aprobadas}
            topologia={estado.topologia}
            onToggleSemestreCompleto={acciones.toggleSemestreCompleto}
            onToggleInteligente={acciones.handleToggleInteligente}
          />
          
          <hr className="border-slate-100" />
          
          <SimulationSettings />
          
          <hr className="border-slate-100" />
          
          <PrioritySelector
            materiasPrioritarias={payload.materias_prioritarias}
            catalogo={estado.catalogoData?.catalogo}
            searchTerm={estado.searchTerm}
            resultadosBusqueda={estado.resultadosBusqueda}
            onSearchChange={acciones.setSearchTerm}
            onTogglePrioridad={acciones.togglePrioridad}
          />

          {estado.todasAprobadas && (
            <div className="p-3 bg-green-50 text-green-700 text-sm font-semibold rounded-lg border border-green-200 text-center animate-in fade-in duration-300">
              Has seleccionado todas las materias de la malla. ¡Ya cumples con
              los requisitos base para graduarte! 🎓
            </div>
          )}
          
          <button
            type="submit"
            disabled={mutacion.isPending || estado.todasAprobadas}
            className={`
              w-full text-white font-bold py-4 rounded-xl shadow-sm transition-colors text-lg flex justify-center items-center gap-2
              ${
                mutacion.isPending || estado.todasAprobadas
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
              }
            `}
          >
            {mutacion.isPending ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando en el servidor...
              </>
            ) : estado.todasAprobadas ? (
              "Malla Completada"
            ) : (
              "Generar Ruta Óptima"
            )}
          </button>
          
          {mutacion.isError && (
            <div className="p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-lg border border-red-200 text-center">
              Hubo un problema de conexión con el servidor. Revisa si tu backend en Python está encendido.
            </div>
          )}
        </form>
      </section>

      {modales.chainReactionNotice && (
        <ChainReactionModal
          notice={modales.chainReactionNotice}
          onClose={() => modales.setChainReactionNotice(null)}
        />
      )}
      {modales.prereqNotice && (
        <PrereqNoticeModal
          notice={modales.prereqNotice}
          onClose={() => modales.setPrereqNotice(null)}
        />
      )}
      {modales.partialSelectionNotice && (
        <PartialSelectionModal
          notice={modales.partialSelectionNotice}
          onClose={() => modales.setPartialSelectionNotice(null)}
        />
      )}
    </main>
  );
}