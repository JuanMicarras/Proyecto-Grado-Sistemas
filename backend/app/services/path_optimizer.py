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
    
    def simular_trayectoria_completa(self, aprobadas_iniciales: list, creditos_iniciales: int, max_creditos: int = 18, perfil_estudiante: str = "balanceado", plan_id: str = "SIST-2024") -> dict:
        # Aislamiento de variables de estado para no mutar los inputs
        estado_aprobadas = set(aprobadas_iniciales)
        estado_creditos = creditos_iniciales
        trayectoria_proyectada = []
        total_materias_plan = self.repo.get_total_materias_plan(plan_id)
        # Pesos Heurísticos
        w_critico = 50.0
        if perfil_estudiante == "agresivo": w_semestre, w_dificultad = -10.0, 2.0 
        elif perfil_estudiante == "suave": w_semestre, w_dificultad = -10.0, -2.0
        else: w_semestre, w_dificultad = -10.0, 0.0

        while True:
            # 1. Lectura de Estado Actual (DB)
            disponibles_raw = self.repo.get_materias_disponibles_pathfinder(list(estado_aprobadas), estado_creditos, plan_id)
            
            if not disponibles_raw:
                break # Condición de Parada: Grafo completado o Deadlock absoluto
                
            # --- REGLA 1: Ventana de Semestres (N + 2) ---
            # El semestre actual N es exactamente el mínimo semestre sugerido del pool de desbloqueadas.
            materias_regulares = [m for m in disponibles_raw if m['semestre_sugerido'] > 0]
            
            if materias_regulares:
                semestre_actual = min(m['semestre_sugerido'] for m in materias_regulares)
            else:
                semestre_actual = 0 # Fallback si solo le faltan idiomas
                
            ventana_maxima = semestre_actual + 2
            
            # Permitir materias que estén en la ventana O que sean transversales (semestre 0)
            disponibles = [
                m for m in disponibles_raw 
                if m['semestre_sugerido'] <= ventana_maxima or m['semestre_sugerido'] == 0
            ]
            
            if not disponibles:
                disponibles = disponibles_raw # Fallback preventivo estructural

            # 2. Inyección de Ruta Crítica Dinámica
            ruta_data = self.repo.get_ruta_critica_dinamica(list(estado_aprobadas), plan_id)
            codigos_criticos = {nodo["codigo"] for nodo in ruta_data.get("ruta", [])}
            
            # 3. Función Fitness
            for m in disponibles:
                score_retraso = w_semestre * m['semestre_sugerido']
                score_dificultad = w_dificultad * m['dificultad']
                score_ruta = w_critico if m['codigo'] in codigos_criticos else 0.0
                densidad = m['creditos'] if m['creditos'] > 0 else 1 
                
                m['priority_score'] = (score_retraso + score_dificultad + score_ruta) / densidad

            disponibles.sort(key=lambda x: x['priority_score'], reverse=True)

            # --- REGLA 2: Knapsack Atómico (Correquisitos) ---
            seleccion_semestre = []
            carga_actual = 0
            procesados = set()
            mapa_lookup = {m['codigo']: m for m in disponibles}
            
            for m in disponibles:
                cod = m['codigo']
                if cod in procesados:
                    continue
                    
                # Identificar corequisitos pendientes (que no han sido aprobados antes)
                coreqs_pendientes = [c for c in m['correquisitos'] if c not in estado_aprobadas]
                
                # Regla Estricta: Si un corequisito no está disponible en este semestre (por ventana N+2 o prerrequisito faltante), abortar el bloque
                if not all(c in mapa_lookup for c in coreqs_pendientes):
                    continue 

                # Construir el bloque atómico
                bloque_materias = [m] + [mapa_lookup[c] for c in coreqs_pendientes]
                creditos_bloque = sum(mat['creditos'] for mat in bloque_materias)
                
                if carga_actual + creditos_bloque <= max_creditos:
                    for mat in bloque_materias:
                        if mat['codigo'] not in procesados:
                            seleccion_semestre.append({
                                "codigo": mat['codigo'],
                                "nombre": mat['nombre'],
                                "creditos": mat['creditos'],
                                "es_critica": mat['codigo'] in codigos_criticos
                            })
                            procesados.add(mat['codigo'])
                            carga_actual += mat['creditos']
                            
            if not seleccion_semestre:
                break # Evitar loop infinito si ninguna materia o bloque cabe (Deadlock de créditos)

            # --- REGLA 3: Mutación de Estado (Acumulación) ---
            trayectoria_proyectada.append({
                "semestre_simulado": len(trayectoria_proyectada) + 1,
                "creditos_matriculados": carga_actual,
                "materias": seleccion_semestre
            })
            
            # Sumar al estado para la iteración del próximo semestre
            estado_aprobadas.update(procesados)
            estado_creditos += carga_actual
            # --- VALIDACIÓN DE COMPLETITUD (NUEVO) ---
        materias_aprobadas_final = len(estado_aprobadas)
        logro_graduarse = materias_aprobadas_final == total_materias_plan

        estado_simulacion = "Exitoso" if logro_graduarse else "Bloqueo Estructural (Deadlock)"
        mensaje = "El estudiante proyecta graduarse." if logro_graduarse else f"El estudiante quedó atascado. Aprobó {materias_aprobadas_final}/{total_materias_plan} materias. Revisa el acumulado de créditos o correquisitos imposibles."
        return {
            "resumen": {
                "estado_simulacion": estado_simulacion,
                "mensaje_diagnostico": mensaje,
                "graduacion_alcanzada": logro_graduarse,
                "semestres_extra_requeridos": len(trayectoria_proyectada),
                "total_creditos_carrera": estado_creditos
            },
            "trayectoria": trayectoria_proyectada
        }