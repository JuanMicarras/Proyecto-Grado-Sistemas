import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  getNodesBounds,
  getViewportForBounds,
} from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { useAcademicStore } from "../store/academicStore";
import { api } from "../api/client";

// ============================================================================
// 1. COMPONENTE DE NODO
// ============================================================================
const CustomSubjectNode = ({ data }: { data: any }) => {
  const { isAprobada, isDisponible } = data;

  let nodeStyle =
    "bg-slate-900 border-slate-800 opacity-50 grayscale cursor-not-allowed";
  let titleStyle = "text-slate-500";
  let badge = (
    <span className="text-[10px] font-bold bg-slate-900 text-slate-600 px-2 py-0.5 rounded-md border border-slate-800">
      Sem {data.nivel}
    </span>
  );

  if (isAprobada) {
    nodeStyle =
      "bg-slate-800 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)] opacity-100 grayscale-0 cursor-pointer";
    titleStyle = "text-green-50";
    badge = (
      <span className="text-[10px] font-bold bg-green-900/50 text-green-400 px-2 py-0.5 rounded-md border border-green-700/50">
        ✓ APROBADA
      </span>
    );
  } else if (isDisponible) {
    nodeStyle =
      "bg-slate-800 border-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.4)] opacity-100 grayscale-0 hover:border-blue-300 cursor-pointer";
    titleStyle = "text-white font-bold";
    badge = (
      <span className="text-[10px] font-bold bg-blue-900/80 text-blue-300 px-2 py-0.5 rounded-md border border-blue-500 animate-pulse">
        ✨ DISPONIBLE
      </span>
    );
  }

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-xl border-2 transition-all duration-500 w-[260px] group ${nodeStyle}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-slate-800 border-2 border-slate-500 opacity-0 group-hover:opacity-100"
      />

      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <span
            className={`text-[10px] font-black tracking-widest uppercase ${
              isAprobada
                ? "text-green-400"
                : isDisponible
                  ? "text-blue-400"
                  : "text-slate-600"
            }`}
          >
            {data.id || "COD"}
          </span>

          {badge}
        </div>

        <h3
          className={`text-sm leading-tight mt-1 transition-colors ${titleStyle}`}
        >
          {data.label}
        </h3>

        <p
          className={`text-xs font-medium ${
            isAprobada || isDisponible ? "text-slate-400" : "text-slate-600"
          }`}
        >
          {data.creditos} cr • {data.tipo}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-slate-800 border-2 border-slate-500 opacity-0 group-hover:opacity-100"
      />
    </div>
  );
};

const nodeTypes = { customSubject: CustomSubjectNode };

// ============================================================================
// 2. COMPONENTE PRINCIPAL
// ============================================================================
export function GrafoInteractivo() {
  const navigate = useNavigate();
  const { payload, toggleMateria } = useAcademicStore();
  const aprobadas = payload.aprobadas;
  const [isExportingImage, setIsExportingImage] = useState(false);

  const { data: graphResponse, isLoading: isLoadingGrafo } = useQuery({
    queryKey: ["grafo-curricular"],
    queryFn: () =>
      fetch("http://localhost:8000/api/v1/malla-visual").then((res) =>
        res.json(),
      ),
  });

  // SOLUCIÓN 1: Calculamos los créditos en tiempo real dentro del Grafo
  const creditosAcumulados = useMemo(() => {
    if (!graphResponse?.grafo?.nodes) return 0;

    return aprobadas.reduce((total, codigo) => {
      const nodoMateria = graphResponse.grafo.nodes.find(
        (n: any) => n.id === codigo,
      );

      return total + (nodoMateria?.data?.creditos || 0);
    }, 0);
  }, [aprobadas, graphResponse]);

  // SOLUCIÓN 1 (Continuación): Inyectamos los créditos reales al llamar a /disponibles
  const payloadConCreditos = useMemo(
    () => ({
      ...payload,
      creditos_acumulados: creditosAcumulados,
    }),
    [payload, creditosAcumulados],
  );

  const { data: disponiblesResponse } = useQuery({
    // Usamos el array de aprobadas y los créditos como llaves de caché para que reaccione instantáneamente
    queryKey: ["materias-disponibles", aprobadas, creditosAcumulados],
    queryFn: () => api.getDisponibles(payloadConCreditos),
    enabled: !!graphResponse,
  });

  const codigosDisponibles = useMemo(() => {
    if (!disponiblesResponse?.disponibles) return [];

    return disponiblesResponse.disponibles.map((m: any) => m.codigo);
  }, [disponiblesResponse]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const getSubjectColor = (node: any) => {
    const id = node.id || "";
    const tipo = node.data?.tipo || "";
    const nivel = node.data?.nivel || 0;
    const gris = "#334155"; // Gris Azulado para básicas y profesionales sin otro color asignado
    const naranja = "#f59e0b"; // Naranja para profesionales
    const azulElectiva = "#0ea5e9"; // Azul Brillante para electivas
    const verde = "#059669"; // Verde para especialización
    const rosado = "#ec4899"; // Rosado para comprensivo y seminario
    const morado = "#7e22ce"; // Morado para idiomas (IGL)

    if (id.startsWith("IGL")) return morado;

    if (
      id.startsWith("MAT") ||
      id.startsWith("FIS") ||
      id.startsWith("ELG0008")
    ) {
      return gris;
    }

    if (tipo === "Electiva" || id.startsWith("CAS")) return azulElectiva;

    if (
      id.startsWith("IIN") ||
      id.startsWith("IST4370") ||
      id.startsWith("IST4380")
    ) {
      return rosado;
    }

    if ((id.startsWith("ELG") || id.startsWith("IST")) && nivel > 5) {
      return naranja;
    }

    if (id.startsWith("IST7072") || id.startsWith("INV7363")) return naranja;

    if (id.startsWith("ELP")) return verde;

    if (id.startsWith("IST") || id.startsWith("E")) return gris;

    return "#1e293b"; // Color por defecto
  };

  const descargarMallaComoImagen = async () => {
    if (!nodes.length) {
      alert("No hay materias para exportar.");
      return;
    }

    const viewport = document.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement | null;

    if (!viewport) {
      alert("No se encontró la malla para exportar.");
      return;
    }

    try {
      setIsExportingImage(true);

      const imageWidth = 3840;
      const imageHeight = 2160;

      const nodesBounds = getNodesBounds(nodes);

      const transform = getViewportForBounds(
        nodesBounds,
        imageWidth,
        imageHeight,
        0.3,
        2,
        0.15,
      );

      const dataUrl = await toPng(viewport, {
        backgroundColor: "#0b0f14",
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 2,
        cacheBust: true,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
        },
      });

      const link = document.createElement("a");
      link.download = "malla-interactiva.png";
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Error exportando la malla:", error);
      alert("No se pudo guardar la imagen de la malla.");
    } finally {
      setIsExportingImage(false);
    }
  };

  useEffect(() => {
    if (graphResponse?.grafo) {
      const { nodes: rawNodes, edges: rawEdges } = graphResponse.grafo;
      const materiasPorSemestre: Record<number, any[]> = {};

      rawNodes.forEach((node: any) => {
        const nivel = node.data.nivel || 1;

        if (!materiasPorSemestre[nivel]) materiasPorSemestre[nivel] = [];

        materiasPorSemestre[nivel].push(node);
      });

      const columnSpacing = 300;
      const rowSpacing = 120;
      const yInglesfijo = 850;

      const positionedNodes: Node[] = rawNodes.map((node: any) => {
        const nivel = node.data.nivel || 1;
        const materiasEnEsteSemestre = materiasPorSemestre[nivel];
        const materiasSinIngles = materiasEnEsteSemestre.filter(
          (n) => !n.id.startsWith("IGL"),
        );

        const indexSinIngles = materiasSinIngles.findIndex(
          (n: any) => n.id === node.id,
        );

        let finalY: number;

        if (node.id.startsWith("IGL")) {
          finalY = yInglesfijo;
        } else {
          finalY = indexSinIngles * rowSpacing;
        }

        return {
          id: node.id,
          type: "customSubject",
          data: {
            ...node.data,
            id: node.id,
            colorFondo: getSubjectColor(node),
            isAprobada: aprobadas.includes(node.id),
            isDisponible: codigosDisponibles.includes(node.id),
          },
          position: {
            x: (nivel - 1) * columnSpacing,
            y: finalY,
          },
        };
      });

      const styledEdges: Edge[] = rawEdges.map((edge: any) => ({
        ...edge,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#3b82f6", strokeWidth: 1.5, opacity: 0.3 },
      }));

      setNodes(positionedNodes);
      setEdges(styledEdges);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphResponse, setNodes, setEdges]);

  useEffect(() => {
    setNodes((nodosActuales) =>
      nodosActuales.map((nodo) => ({
        ...nodo,
        data: {
          ...nodo.data,
          isAprobada: aprobadas.includes(nodo.id),
          isDisponible: codigosDisponibles.includes(nodo.id),
        },
      })),
    );
  }, [aprobadas, codigosDisponibles, setNodes]);

  if (isLoadingGrafo) {
    return (
      <div className="h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white">
        Cargando...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0f172a] flex flex-col font-sans">
      <header className="p-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex justify-between items-center z-10 shadow-lg">
        <div>
          <h1 className="text-white font-black text-xl tracking-tight">
            Malla Interactiva
          </h1>

          <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mt-0.5">
            Vista de Correlativas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={descargarMallaComoImagen}
            disabled={isExportingImage}
            className="bg-slate-700 hover:bg-slate-600 border border-blue-400/30 hover:border-blue-300/60 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_14px_rgba(59,130,246,0.18)] hover:shadow-[0_0_18px_rgba(59,130,246,0.32)] transition-all active:scale-95 disabled:bg-slate-700/60 disabled:text-slate-300 disabled:cursor-not-allowed"  >
            {isExportingImage ? "Generando..." : "Guardar imagen"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all active:scale-95"
          >
            ← Volver al Planificador
          </button>
        </div>
      </header>

      <div className="flex-grow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          // SOLUCIÓN 2: Solo permitimos el clic si está disponible o si ya la habías aprobado (para quitarla)
          onNodeClick={(_, node) => {
            if (node.data.isAprobada || node.data.isDisponible) {
              toggleMateria(node.id);
            }
          }}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
          minZoom={0.2}
        >
          <Background color="#1e293b" gap={24} size={2} />

          <Controls className="bg-slate-800 border-slate-700 fill-white" />

          {/* SOLUCIÓN 3: Minimapa configurado explícitamente con los colores Hexadecimales */}
          <MiniMap
            nodeColor={(n) => {
              if (n.data.isAprobada) return "#16a34a"; // Verde fuerte
              if (n.data.isDisponible) return "#2563eb"; // Azul fuerte
              return "#1e293b"; // Gris oscuro para las bloqueadas
            }}
            maskColor="rgba(15, 23, 42, 0.85)"
            className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
