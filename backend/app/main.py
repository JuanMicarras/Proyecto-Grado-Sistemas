import os
import sys

from fastapi.responses import RedirectResponse

# Ajuste de path para ejecución directa si es necesario
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Neo4jConnection
from app.repository.graph_repo import CurricularRepository
from app.services.path_optimizer import PathOptimizer

from fastapi import FastAPI
from app.api.routes import router

def ejecutar_simulacion():
    # 1. Configuración vía Variables de Entorno (12-Factor App)
    URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    USER = os.getenv("NEO4J_USER", "neo4j")
    PASSWORD = os.getenv("NEO4J_PASSWORD", "tesis123")

    # 2. Inicialización del Singleton de BD (O(1) RAM)
    db_connection = Neo4jConnection(URI, USER, PASSWORD)
    driver = db_connection.get_driver()

    try:
        # 3. Inyección de Dependencias (Top-Down)
        repo = CurricularRepository(driver)
        optimizer = PathOptimizer(repo)

        # 4. Definición del Estado del Estudiante (Mock)
        # Supongamos un estudiante que aprobó todo el 1er semestre y parte del 2do.
        # Reprobó/No matriculó Física Mecánica (FIS1023) ni Competencias II (CAS3030)
        historial_aprobadas = [
            "MAT1031", "MAT1101", "IST0010", "IST2088", "CAS3020", # Semestre 1 completo
            "MAT1111", "IST2089"                                   # Semestre 2 parcial
        ]
        creditos_acumulados = 23 # Cálculo rápido de los créditos de esas materias
        max_creditos_semestre = 17

        print("=== Simulador de Toma de Decisiones Académicas ===")
        print(f"Estudiante | Créditos Aprobados: {creditos_acumulados} | Materias: {len(historial_aprobadas)}")

        # 5. Ejecución Multicriterio
        perfiles = ["balanceado", "agresivo", "suave"]
        
        for perfil in perfiles:
            resultado = optimizer.generar_semestre_optimo(
                aprobadas=historial_aprobadas,
                creditos_acumulados=creditos_acumulados,
                max_creditos=max_creditos_semestre,
                perfil_estudiante=perfil
            )

            stats = resultado.get("estadisticas", {})
            seleccion = resultado.get("seleccion", [])

            print(f"\n[+] Perfil de Optimización: {perfil.upper()}")
            print(f"    Carga Total: {stats.get('total_creditos')}/{max_creditos_semestre} Cr | Dificultad Agregada: {stats.get('dificultad_agregada')}")
            
            for mat in seleccion:
                print(f"    - [{mat['codigo']}] {mat['nombre']} (Cr: {mat['creditos']}, Dif: {mat['dificultad']})")

    except Exception as e:
        print(f"[!] Error crítico en tiempo de ejecución: {str(e)}")
    
    finally:
        # 6. Teardown y Liberación de Recursos
        db_connection.close()
        print("\n=== Conexiones liberadas. Simulación finalizada. ===")

app = FastAPI(
    title="Motor de Inferencia Curricular",
    description="API de optimización de grafos dirigidos para mallas académicas.",
    version="1.0.0"
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
    ejecutar_simulacion()