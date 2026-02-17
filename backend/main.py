from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import pandas as pd
import networkx as nx
from ortools.sat.python import cp_model
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="Sistema de Planificación Académica - Uninorte")
#uvicorn main:app --reload
# Configurar CORS (Para que React pueda hablar con Python)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite conexiones desde cualquier lado (React)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
print("Cargando grafo de conocimientos...")
df = pd.read_csv('malla_sistemas_nuevo.csv')
df['prerrequisitos'] = df['prerrequisitos'].fillna('')

G = nx.DiGraph()

# Agregar nodos (Materias)
for _, row in df.iterrows():
    G.add_node(row['codigo'], 
               nombre=row['nombre'], 
               creditos=int(row['creditos']), 
               semestre=int(row['semestre']),
               min_creditos_req=int(row['min_creditos_req']),
               tipo=row['tipo'])

# Agregar aristas (Prerrequisitos)
for _, row in df.iterrows():
    if row['prerrequisitos']:
        reqs = str(row['prerrequisitos']).split(';')
        for req in reqs:
            req = req.strip()
            # Solo agregamos la arista si el prerrequisito existe en el grafo
            if req in G.nodes:
                G.add_edge(req, row['codigo'])

print(f"Grafo cargado con {len(G.nodes)} materias y {len(G.edges)} conexiones.")

# --- 2. MODELOS DE DATOS (Para que la API entienda JSON) ---
class PerfilEstudiante(BaseModel):
    materias_aprobadas: List[str]  # Lista de códigos, ej: ["MAT1031", "IST0010"]

def calcular_semestre_real_estudiante(aprobadas, G):
    """
    El semestre del estudiante es el de la materia 
    pendiente más baja (rezago).
    """
    todas_las_materias = set(G.nodes)
    pendientes = list(todas_las_materias - set(aprobadas))
    
    semestres_pendientes = []
    for m in pendientes:
        sem = G.nodes[m]['semestre']
        # Ignoramos materias con semestre 0 (Idiomas/Exámenes sin ubicación fija)
        if sem > 0:
            semestres_pendientes.append(sem)
            
    if not semestres_pendientes:
        # Si no debe nada con semestre > 0, asumimos que está al final
        return 10 
        
    return min(semestres_pendientes)


# Actualizamos la función del solver
def resolver_ruta_optima(materias_faltantes, aprobadas, G, max_creditos_semestre=18, es_avance_flexible=False):
    model = cp_model.CpModel()
    x = {}
    semestre_materia = {}
    
    # 1. Calcular Semestre REAL (Basado en la materia más baja pendiente)
    nivel_actual = calcular_semestre_real_estudiante(aprobadas, G)
    print(f"Estudiante ubicado por rezago en semestre: {nivel_actual}")

    # Horizonte de simulación (ej. 12 semestres hacia el futuro)
    horizonte = 12 
    
    # Solo programamos las que faltan
    materias_a_programar = [m for m in materias_faltantes if m in G.nodes]
    
    for m in materias_a_programar:
        # Variables x[m, s]
        for s in range(horizonte):
            x[(m, s)] = model.NewBoolVar(f'x_{m}_{s}')
        
        # Restricción: Cada materia se ve una vez
        model.Add(sum(x[(m, s)] for s in range(horizonte)) == 1)
        
        semestre_materia[m] = model.NewIntVar(0, horizonte, f'sem_idx_{m}')
        model.Add(semestre_materia[m] == sum(s * x[(m, s)] for s in range(horizonte)))

        # --- LÓGICA DE BLOQUEO (Ventana Móvil) ---
        if not es_avance_flexible:
            sem_materia_ideal = G.nodes[m]['semestre']
            
            if sem_materia_ideal > 0:
                # REGLA DE ORO: 
                # En el futuro (s), tu nivel "teórico" aumenta a medida que avanzas.
                # Nivel Futuro = Nivel Actual + s
                # Límite = Nivel Futuro + 2
                
                # Ejemplo: Estoy en Sem 1 (s=0). Límite = 1+2 = 3. Materias de 4 bloqueadas.
                # En el siguiente periodo (s=1), ya soy teóricamente Sem 2. Límite = 2+2=4.
                
                VENTANA = 2 # Configurable
                
                for s in range(horizonte):
                    nivel_futuro = nivel_actual + s
                    limite_superior = nivel_futuro + VENTANA
                    
                    if sem_materia_ideal > limite_superior:
                         # Bloquear esta materia en este periodo 's'
                         model.Add(x[(m, s)] == 0)

    # 2. Prerrequisitos (STANDARD)
    for m in materias_a_programar:
        reqs = list(G.predecessors(m))
        for p in reqs:
            if p in materias_a_programar:
                model.Add(semestre_materia[p] < semestre_materia[m])

    # 3. Créditos (STANDARD)
    for s in range(horizonte):
        cr_s = sum(x[(m, s)] * G.nodes[m]['creditos'] for m in materias_a_programar)
        model.Add(cr_s <= max_creditos_semestre)
        
    # 4. Minimizar tiempo (Makespan)
    makespan = model.NewIntVar(0, horizonte, 'makespan')
    for m in materias_a_programar:
        model.Add(makespan >= semestre_materia[m])
    model.Minimize(makespan)

    # Solver
    solver = cp_model.CpSolver()
    status = solver.Solve(model)
    
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        plan = {}
        for m in materias_a_programar:
            sem_idx = solver.Value(semestre_materia[m])
            if sem_idx not in plan: plan[sem_idx] = []
            plan[sem_idx].append(G.nodes[m])
        return plan
    return None

@app.get("/")
def home():
    return {"mensaje": "API de Planificación Académica Funcionando"}

@app.get("/catalogo")
def obtener_catalogo():
    # Devuelve todas las materias ordenadas por semestre
    lista = []
    for n in G.nodes:
        lista.append({
            "codigo": n,
            "nombre": G.nodes[n]['nombre'],
            "semestre_sugerido": G.nodes[n]['semestre']
        })
    # Ordenar por semestre
    lista.sort(key=lambda x: x['semestre_sugerido'])
    return lista

@app.post("/recomendar")
def recomendar_materias(perfil: PerfilEstudiante):
    """
    Recibe las materias aprobadas y devuelve las disponibles 
    respetando prerrequisitos y créditos.
    """
    aprobadas = set(perfil.materias_aprobadas)
    
    # Calcular total de créditos aprobados por el estudiante
    creditos_acumulados = 0
    for codigo in aprobadas:
        if codigo in G.nodes:
            creditos_acumulados += G.nodes[codigo]['creditos']
    
    materias_disponibles = []

    # Recorremos todas las materias del plan de estudios
    for materia in G.nodes:
        
        if materia in aprobadas:
            continue
            
        # 2. Verificar Prerrequisitos 
        prerrequisitos = list(G.predecessors(materia))
        cumple_prerrequisitos = all(p in aprobadas for p in prerrequisitos)
        
        # 3. Verificar Requisito de Créditos 
        min_creditos = G.nodes[materia]['min_creditos_req']
        cumple_creditos = creditos_acumulados >= min_creditos
        
        # Si cumple todo, es candidata
        if cumple_prerrequisitos and cumple_creditos:
            datos_materia = G.nodes[materia]
            materias_disponibles.append({
                "codigo": materia,
                "nombre": datos_materia['nombre'],
                "creditos": datos_materia['creditos'],
                "semestre_sugerido": datos_materia['semestre'],
                "tipo": datos_materia['tipo'],
                "razon": "Cumple prerrequisitos y créditos"
            })
    
    # Ordenar por semestre sugerido para que se vea bonito
    materias_disponibles.sort(key=lambda x: x['semestre_sugerido'])
    
    return {
        "creditos_totales": creditos_acumulados,
        "materias_disponibles": materias_disponibles
    }

class OpcionesSimulacion(BaseModel):
    materias_aprobadas: List[str]
    max_creditos: int = 17
    es_avance_flexible: bool = False  

@app.post("/optimizar")
def generar_plan(opciones: OpcionesSimulacion):
    aprobadas = set(opciones.materias_aprobadas)
    todas = set(G.nodes)
    faltantes = list(todas - aprobadas)
    
    plan = resolver_ruta_optima(
        faltantes, 
        aprobadas, # Pasamos las aprobadas para calcular el nivel
        G, 
        opciones.max_creditos, 
        opciones.es_avance_flexible
    )
    
    if not plan:
        raise HTTPException(status_code=400, detail="No se encontró solución viable")
    
    # Formatear respuesta
    respuesta = []
    for s in sorted(plan.keys()):
        respuesta.append({
            "semestre_relativo": s + 1,
            "materias": plan[s]
        })
    return {"plan": respuesta}