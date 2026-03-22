from fastapi import APIRouter, Depends, HTTPException
from app.models.domain import StudentStateRequest
from app.core.database import Neo4jConnection
from app.repository.graph_repo import CurricularRepository
from app.services.path_optimizer import PathOptimizer
import os

router = APIRouter()

def get_optimizer() -> PathOptimizer:
    # Recuperación Singleton del Pool de Conexiones en tiempo de petición O(1)
    URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    USER = os.getenv("NEO4J_USER", "neo4j")
    PASSWORD = os.getenv("NEO4J_PASSWORD", "tesis123")
    
    db_connection = Neo4jConnection(URI, USER, PASSWORD)
    repo = CurricularRepository(db_connection.get_driver())
    return PathOptimizer(repo)

@router.post("/optimize-semester")
def optimize_semester(request: StudentStateRequest, optimizer: PathOptimizer = Depends(get_optimizer)):
    """
    Endpoint O(N \log N) para calcular la trayectoria óptima del próximo semestre.
    """
    try:
        resultado = optimizer.generar_semestre_optimo(
            aprobadas=request.aprobadas,
            creditos_acumulados=request.creditos_acumulados,
            max_creditos=request.max_creditos,
            perfil_estudiante=request.perfil_estudiante,
            materias_prioritarias=request.materias_prioritarias
        )
        return resultado
    except Exception as e:
        # Prevención de fuga de información de stacktrace al cliente (Security Exception Handling)
        raise HTTPException(status_code=500, detail=f"Error interno en motor de inferencia: {str(e)}")
    
def get_repository() -> CurricularRepository:
    """
    Dependency Provider para inyectar el repositorio aislado.
    """
    URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    USER = os.getenv("NEO4J_USER", "neo4j")
    PASSWORD = os.getenv("NEO4J_PASSWORD", "tesis123")
    
    db_connection = Neo4jConnection(URI, USER, PASSWORD)
    return CurricularRepository(db_connection.get_driver())

@router.post("/critical-path")
def analyze_critical_path(request: StudentStateRequest, repo: CurricularRepository = Depends(get_repository)):
    """
    Endpoint O(V+E) en DAG para identificar la cadena de prerrequisitos más larga 
    que bloquea la graduación del estudiante.
    """
    try:
        ruta_data = repo.get_ruta_critica_dinamica(aprobadas=request.aprobadas)
        
        if not ruta_data.get("ruta"):
            return {"estado": "Estudiante sin materias pendientes o error en grafo"}
            
        return {
            "metricas": {
                "semestres_minimos_restantes": ruta_data["materias_en_ruta"],
                "creditos_en_ruta_critica": ruta_data["creditos_ruta"]
            },
            "ruta_critica": ruta_data["ruta"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculando ruta crítica: {str(e)}")

@router.post("/simulate-path")
def simulate_full_path(request: StudentStateRequest, optimizer: PathOptimizer = Depends(get_optimizer)):
    """
    Endpoint $O(S \\times (V+E))$ para proyectar la trayectoria académica completa 
    hasta la graduación mediante simulación de estados discretos.
    """
    try:
        resultado = optimizer.simular_trayectoria_completa(
            aprobadas_iniciales=request.aprobadas,
            creditos_iniciales=request.creditos_acumulados,
            max_creditos=request.max_creditos,
            perfil_estudiante=request.perfil_estudiante,
            materias_prioritarias=request.materias_prioritarias
        )
        
        # Validación de interbloqueo (Deadlock en el DAG)
        if not resultado.get("trayectoria"):
            raise HTTPException(
                status_code=409, 
                detail="Deadlock detectado: El estudiante no cumple prerrequisitos mínimos para avanzar o la malla tiene ciclos."
            )
            
        return resultado
        
    except Exception as e:
        # Prevención de exposición de trazas internas
        raise HTTPException(
            status_code=500, 
            detail=f"Fallo crítico en el motor de simulación (Pathfinder): {str(e)}"
        )

@router.get("/catalogo")
def get_catalogo(repo: CurricularRepository = Depends(get_repository)):
    """
    Endpoint O(V) para extraer la totalidad de los nodos de la malla curricular.
    Carga de lectura directa sin procesamiento algorítmico.
    """
    try:
        materias = repo.get_catalogo()
        return {
            "metadata": {
                "plan": "SIST-2024",
                "total_materias": len(materias)
            },
            "catalogo": materias
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Fallo en la extracción de la topología del grafo: {str(e)}"
        )

@router.post("/disponibles")
def get_materias_disponibles(request: StudentStateRequest, repo: CurricularRepository = Depends(get_repository)):
    """
    Endpoint O(V + E) filtrado por subgrafo condicional. 
    Evalúa cumplimiento de in-degree (prerrequisitos) y restricciones de semestre (DAG topology).
    """
    try:
        # 1. Consulta al grafo evaluando prerrequisitos, créditos mínimos y ventana semestral
        materias = repo.get_materias_disponibles(
            aprobadas=request.aprobadas,
            creditos_acumulados=request.creditos_acumulados
        )
        
        if not materias:
            return {"estado": "Sin materias disponibles para el estado actual", "disponibles": []}

        # 2. Extracción de la ventana heurística calculada en la query de Cypher
        semestre_ancla = materias[0].get("semestre_ancla", 1)
        
        return {
            "estado_proyectado": {
                "semestre_actual_calculado": semestre_ancla,
                "limite_ventana_semestral": semestre_ancla + 2,
                "creditos_base": request.creditos_acumulados
            },
            "total_disponibles": len(materias),
            "disponibles": materias
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error evaluando el subgrafo de disponibilidad: {str(e)}"
        )

@router.get("/malla-visual")
def get_malla_visual(repo: CurricularRepository = Depends(get_repository)):
    """
    Endpoint O(V+E) que retorna la estructura topológica del plan de estudios
    formateada para renderizado de grafos en UI (Nodos y Edges).
    """
    try:
        grafo_data = repo.get_malla_visual()
        return {
            "metadata": {
                "total_nodos": len(grafo_data["nodes"]),
                "total_aristas": len(grafo_data["edges"])
            },
            "grafo": grafo_data
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error extrayendo topología visual: {str(e)}"
        )
    
