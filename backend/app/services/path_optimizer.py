class PathOptimizer:
    def __init__(self, repository):
        # Inyección de dependencias: el optimizador no sabe que existe Neo4j,
        # solo conoce la interfaz del repositorio.
        self.repo = repository

    def generar_semestre_optimo(self, aprobadas: list, creditos_acumulados: int, max_creditos: int = 17, perfil_estudiante: str = "balanceado", plan_id: str = "SIST-2024") -> dict:
        """
        Genera el conjunto óptimo de materias a matricular maximizando el avance 
        curricular y respetando la restricción de créditos máximos.
        """
        # 1. Obtener espacio de búsqueda válido (O(1) I/O de red, delegando el DAG a la BD)
        disponibles = self.repo.get_materias_disponibles(aprobadas, creditos_acumulados, plan_id)

        if not disponibles:
            return {"estado": "Sin materias disponibles o carrera finalizada", "seleccion": []}
        
        ruta_data = self.repo.get_ruta_critica_dinamica(aprobadas, plan_id)
        # Convertir a Set de Python para lookups O(1)
        codigos_criticos = {nodo["codigo"] for nodo in ruta_data.get("ruta", [])}

        # 2. Definición de Pesos Multicriterio según el perfil del estudiante
        w_critico = 50.0  # Peso dominante para forzar el avance en el DAG principal
        # W_semestre: Penaliza fuertemente materias atrasadas.
        # W_dificultad: Positivo si queremos salir de lo difícil rápido, negativo si queremos un semestre suave.
        if perfil_estudiante == "agresivo":
            w_semestre, w_dificultad = -10.0, 2.0 
        elif perfil_estudiante == "suave":
            w_semestre, w_dificultad = -10.0, -2.0
        else: # balanceado
            w_semestre, w_dificultad = -10.0, 0.0

        # 3. Función de Evaluación (Fitness) O(N)
        # Calculamos un "Priority Score" (mayor es mejor)
        for m in disponibles:
            # Semestres menores (atrasados) generan un score más alto al multiplicar por un peso negativo
            score_retraso = w_semestre * m['semestre_sugerido']
            score_dificultad = w_dificultad * m['dificultad']
            # Boost masivo si la materia es un cuello de botella
            score_ruta = w_critico if m['codigo'] in codigos_criticos else 0.0

            # El ratio creditos actúa como un normalizador (densidad de valor del Knapsack)
            densidad_creditos = m['creditos'] if m['creditos'] > 0 else 1 
            
            m['priority_score'] = (score_retraso + score_dificultad + score_ruta) / densidad_creditos

        # 4. Ordenamiento Heurístico O(N log N)
        # Ordenamos descendentemente por el score de prioridad
        disponibles.sort(key=lambda x: x['priority_score'], reverse=True)

        # 5. Algoritmo Greedy para empaquetamiento de créditos O(N)
        seleccion = []
        carga_creditos_actual = 0
        carga_dificultad_actual = 0

        for materia in disponibles:
            if carga_creditos_actual + materia['creditos'] <= max_creditos:
                seleccion.append({
                    "codigo": materia['codigo'],
                    "nombre": materia['nombre'],
                    "creditos": materia['creditos'],
                    "dificultad": materia['dificultad']
                })
                carga_creditos_actual += materia['creditos']
                carga_dificultad_actual += materia['dificultad']

        return {
            "estadisticas": {
                "total_creditos": carga_creditos_actual,
                "dificultad_agregada": carga_dificultad_actual,
                "materias_inscritas": len(seleccion)
            },
            "seleccion": seleccion
        }