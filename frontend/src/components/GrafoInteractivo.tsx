import { useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

// ============================================================================
// 1. COMPONENTE DE NODO PERSONALIZADO (El "Look and Feel" Moderno)
// ============================================================================
const CustomSubjectNode = ({ data }: { data: any }) => {
  return (
    // Diseño tipo tarjeta moderna, fondo oscuro, bordes sutiles y hover glow
    <div className="px-4 py-3 shadow-lg rounded-xl bg-slate-800 border-2 border-slate-700 hover:border-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300 w-[260px] group"
     style={{ backgroundColor: data.colorFondo || "#1e293b" }} // Color dinámico basado en el tipo de materia
    >
      {/* Punto de conexión de entrada (Izquierda) */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-slate-800 border-2 border-blue-400 group-hover:bg-blue-400 transition-colors"
      />

      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
            {data.id || "COD"}
          </span>
          <span className="text-[10px] font-bold bg-slate-900 text-blue-400 px-2 py-0.5 rounded-md border border-slate-700">
            Sem {data.nivel}
          </span>
        </div>

        <h3 className="text-sm font-bold text-white leading-tight mt-1">
          {data.label}
        </h3>

        <p className="text-xs text-slate-500 font-medium">{data.tipo}</p>
      </div>

      {/* Punto de conexión de salida (Derecha) */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-slate-800 border-2 border-blue-400 group-hover:bg-blue-400 transition-colors"
      />
    </div>
  );
};

// Registramos nuestro nodo personalizado para que React Flow lo use
const nodeTypes = {
  customSubject: CustomSubjectNode,
};

// ============================================================================
// 2. COMPONENTE PRINCIPAL Y ALGORITMO DE LAYOUT POR SEMESTRE
// ============================================================================
export function GrafoInteractivo() {
  const navigate = useNavigate();

  const { data: graphResponse, isLoading } = useQuery({
    queryKey: ["grafo-curricular"],
    queryFn: () =>
      fetch("http://localhost:8000/api/v1/malla-visual").then((res) =>
        res.json(),
      ),
  });

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
  if (id.startsWith("MAT") || id.startsWith("FIS") || id.startsWith("ELG0008")) return gris; 
  if (tipo === "Electiva" || id.startsWith("CAS")) return azulElectiva; 
  if (id.startsWith("IIN") || id.startsWith("IST4370") || id.startsWith("IST4380")) return rosado;
  if ((id.startsWith("ELG") || id.startsWith("IST")) && nivel > 5) return naranja; 
  if (id.startsWith("IST7072") || id.startsWith("INV7363")) return naranja;
  if (id.startsWith("ELP")) return verde;
  if (id.startsWith("IST") || id.startsWith("E")) return gris;
  
  return "#1e293b"; // Color por defecto
};
  useMemo(() => {
    if (graphResponse?.grafo) {
      const { nodes: rawNodes, edges: rawEdges } = graphResponse.grafo;

      // A. Agrupamos las materias por su "nivel" (Semestre)
      const materiasPorSemestre: Record<number, any[]> = {};
      rawNodes.forEach((node: any) => {
        const nivel = node.data.nivel || 1;
        if (!materiasPorSemestre[nivel]) materiasPorSemestre[nivel] = [];
        materiasPorSemestre[nivel].push(node);
      });

      const columnSpacing = 300;
      const rowSpacing = 120;
      const yInglesfijo = 850; // Coordenada Y donde empezará la fila de idiomas

      const positionedNodes: Node[] = rawNodes.map((node: any) => {
        const nivel = node.data.nivel || 1;
        const materiasEnEsteSemestre = materiasPorSemestre[nivel];

        // Filtramos para saber qué posición ocupa ignorando los idiomas
        const materiasSinIngles = materiasEnEsteSemestre.filter(
          (n) => !n.id.startsWith("IGL"),
        );
        const indexSinIngles = materiasSinIngles.findIndex(
          (n: any) => n.id === node.id,
        );

        let finalY: number;

        // CASO A: Es una exigencia de idiomas (Código IGL)
        if (node.id.startsWith("IGL")) {
          finalY = yInglesfijo;
        }
        
        else {
          finalY = indexSinIngles * rowSpacing;
        }

        return {
          id: node.id,
          type: "customSubject",
          data: { ...node.data, id: node.id,colorFondo: getSubjectColor(node) },
          position: {
            x: (nivel - 1) * columnSpacing,
            y: finalY,
          },
        };
      });
      // C. Estilizamos las flechas (Edges)
      const styledEdges: Edge[] = rawEdges.map((edge: any) => ({
        ...edge,
        type: "smoothstep", // Hace que las líneas sean curvas y elegantes
        animated: true, // Le da un efecto de flujo de energía
        style: { stroke: "#3b82f6", strokeWidth: 2, opacity: 0.6 }, // Azul brillante
      }));

      setNodes(positionedNodes);
      setEdges(styledEdges);
    }
  }, [graphResponse, setNodes, setEdges]);

  if (isLoading) {
    return (
      <div className="h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white gap-4">
        <div className="w-12 h-12 border-4 border-blue-900 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="font-bold text-slate-400 tracking-widest uppercase text-sm">
          Construyendo Mapa Curricular...
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0f172a] flex flex-col font-sans">
      {/* HEADER DEL GRAFO */}
      <header className="p-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex justify-between items-center z-10 shadow-lg">
        <div>
          <h1 className="text-white font-black text-xl tracking-tight">
            Malla Interactiva
          </h1>
          <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mt-0.5">
            Vista de Correlativas
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all active:scale-95"
        >
          ← Volver al Planificador
        </button>
      </header>

      {/* LIENZO DEL GRAFO */}
      <div className="flex-grow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes} // Inyectamos nuestros nodos
          fitView
          colorMode="dark"
          minZoom={0.2}
        >
          {/* Fondo con grilla muy sutil */}
          <Background color="#1e293b" gap={24} size={2} />
          <Controls className="bg-slate-800 border-slate-700 fill-white" />
          <MiniMap
            nodeColor="#3b82f6"
            maskColor="rgba(15, 23, 42, 0.8)"
            className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
