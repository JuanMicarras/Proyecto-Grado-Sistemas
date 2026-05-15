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
import { useSimulationLogic } from "../hooks/useSimulationLogic";
import { ChainReactionModal } from "./modals/ChainReactionModal";
import { PrereqNoticeModal } from "./modals/PrereqNoticeModal";

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

export function GrafoInteractivo() {
  const navigate = useNavigate();
  const { payload } = useAcademicStore();
  const aprobadas = payload.aprobadas;
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [nodosMovibles, setNodosMovibles] = useState(false);

  const { estado, acciones, modales } = useSimulationLogic();

  const { data: graphResponse, isLoading: isLoadingGrafo } = useQuery({
    queryKey: ["grafo-curricular"],
    queryFn: () =>
      fetch("http://localhost:8000/api/v1/malla-visual").then((res) =>
        res.json(),
      ),
  });

  const payloadConCreditos = useMemo(
    () => ({
      ...payload,
      creditos_acumulados: estado.creditosAcumulados,
    }),
    [payload, estado.creditosAcumulados],
  );

  const { data: disponiblesResponse } = useQuery({
    queryKey: ["materias-disponibles", aprobadas, estado.creditosAcumulados],
    queryFn: () => api.getDisponibles(payloadConCreditos),
    enabled: !!graphResponse,
  });

  const codigosDisponibles = useMemo(() => {
    if (!disponiblesResponse?.disponibles) return [];

    return disponiblesResponse.disponibles.map((m: any) => m.codigo);
  }, [disponiblesResponse]);


  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

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
      const materiasPorSemestre: Record<number, any[]> = {};

      const CODIGO_PRACTICA = "PML4130";
      const rawNodes = graphResponse.grafo.nodes.filter(
        (n: any) => n.id !== CODIGO_PRACTICA,
      );
      const rawEdges = graphResponse.grafo.edges.filter(
        (e: any) =>
          e.source !== CODIGO_PRACTICA && e.target !== CODIGO_PRACTICA,
      );
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
            onClick={() => setNodosMovibles(!nodosMovibles)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 border ${
              nodosMovibles
                ? "bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.4)]"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600"
            }`}
          >
            {nodosMovibles ? "🔓 Mover nodos" : "🔒 Mover nodos"}
          </button>

          <button
            type="button"
            onClick={descargarMallaComoImagen}
            disabled={isExportingImage}
            className="bg-slate-700 hover:bg-slate-600 border border-blue-400/30 hover:border-blue-300/60 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_14px_rgba(59,130,246,0.18)] hover:shadow-[0_0_18px_rgba(59,130,246,0.32)] transition-all active:scale-95 disabled:bg-slate-700/60 disabled:text-slate-300 disabled:cursor-not-allowed"
          >
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
      return (
      <div className="flex-grow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => {
            acciones.handleToggleInteligente(node.id);
          }}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
          minZoom={0.2}
          nodesDraggable={nodosMovibles}
          nodesConnectable={false}
        >
          <Background color="#1e293b" gap={24} size={2} />

          <Controls showInteractive={false} className="bg-slate-800 border-slate-700 fill-white" />

          {/*Minimapa configurado explícitamente con los colores Hexadecimales */}
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
    </div>
  );
}
