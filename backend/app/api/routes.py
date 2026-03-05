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
    Endpoint $O(N \log N)$ para calcular la trayectoria óptima del próximo semestre.
    """
    try:
        resultado = optimizer.generar_semestre_optimo(
            aprobadas=request.aprobadas,
            creditos_acumulados=request.creditos_acumulados,
            max_creditos=request.max_creditos,
            perfil_estudiante=request.perfil_estudiante
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
    Endpoint $O(V+E)$ en DAG para identificar la cadena de prerrequisitos más larga 
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
    
        
