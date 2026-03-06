import os
import sys

from fastapi.responses import RedirectResponse

# Ajuste de path para ejecución directa si es necesario
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Neo4jConnection
from app.repository.graph_repo import CurricularRepository
from app.services.path_optimizer import PathOptimizer
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from app.api.routes import router


app = FastAPI(
    title="Motor de Inferencia Curricular",
    description="API de optimización de grafos dirigidos para mallas académicas.",
    version="1.0.0"
)
# 1. Definir lista blanca de orígenes (Origins Strict Allowlist)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # "https://tu-dominio-en-produccion.edu.co" -> Agregar en despliegue
]
# 2. Configuración del Middleware en la pila ASGI
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,         # Aplica la lista blanca (Evitar usar ["*"] en producción)
    allow_credentials=True,        # Necesario si el frontend envía cookies o tokens de sesión
    allow_methods=["*"],           # Habilita todos los métodos HTTP (incluyendo el OPTIONS del preflight)
    allow_headers=["*"],           # Habilita todos los headers (Authorization, Content-Type, etc.)
)

# Acoplamiento del Router
app.include_router(router, prefix="/api/v1")

@app.on_event("shutdown")
def shutdown_event():
    """
    Teardown determinista. Libera los descriptores de archivo (File Descriptors) 
    y cierra los sockets TCP hacia Neo4j para evitar Memory Leaks al detener el worker.
    """
    URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    USER = os.getenv("NEO4J_USER", "neo4j")
    PASSWORD = os.getenv("NEO4J_PASSWORD", "tesis123")
    
    db_connection = Neo4jConnection(URI, USER, PASSWORD)
    db_connection.close()

@app.get("/", include_in_schema=False)
def root():
    """
    Redirige el tráfico de la raíz al contrato de la API.
    """
    return RedirectResponse(url="/docs")

@app.get("/health", tags=["System"])
def health_check():
    """
    Liveness probe para balanceadores de carga.
    """
    return {
        "status": "online", 
        "service": "Motor de Inferencia Curricular",
        "neo4j_ready": True # Aquí se podría inyectar un ping al driver en el futuro
    }
# Ejecución para entorno local de desarrollo
# En producción usar: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.0", port=8000, reload=True)
    