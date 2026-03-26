class PathOptimizer:
    def __init__(self, repository):
        # Inyección de dependencias: el optimizador no sabe que existe Neo4j,
        # solo conoce la interfaz del repositorio.
        self.repo = repository

    def generar_semestre_optimo(self, aprobadas: list, creditos_acumulados: int, max_creditos: int = 17, perfil_estudiante: str = "balanceado", materias_prioritarias: list = None,plan_id: str = "SIST-2024", ignorar_ventana: bool = False) -> dict:
        """
        Genera el conjunto óptimo de materias a matricular maximizando el avance 
        curricular y respetando la restricción de créditos máximos.
        """
        if materias_prioritarias is None:
            materias_prioritarias = []
        # 1. Obtener espacio de búsqueda válido (O(1) I/O de red, delegando el DAG a la BD)
        disponibles_crudo = self.repo.get_materias_disponibles_pathfinder(aprobadas, creditos_acumulados, plan_id)

        if not disponibles_crudo:
            return {"estado": "Sin materias disponibles o carrera finalizada", "seleccion": []}
        
        materias_regulares = [m for m in disponibles_crudo if m['semestre_sugerido'] > 0]
        semestre_actual = min(m['semestre_sugerido'] for m in disponibles_crudo if m['semestre_sugerido'] > 0)
        ventana_maxima = semestre_actual + 2

        
        # Lógica de Bypass Condicional
        if ignorar_ventana:
            disponibles = disponibles_crudo  # Pasan todas las que cumplan prerrequisitos
        else:
            disponibles = [
                m for m in disponibles_crudo 
                if m['semestre_sugerido'] <= ventana_maxima or m.get('tipo') == 'Requisito_Idioma'
            ]
        if not disponibles: disponibles = disponibles_crudo # Fallback preventivo

        ruta_data = self.repo.get_ruta_critica_dinamica(aprobadas, plan_id)
        # Convertir a Set de Python para lookups O(1)
        codigos_criticos = {nodo["codigo"] for nodo in ruta_data.get("ruta", [])}

        # 2. Definición de Pesos Multicriterio 
        w_critico = 50.0  # Peso para forzar el avance en el DAG principal
        w_prioridad = 100.0  
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
            
            score_ruta = w_critico if m['codigo'] in codigos_criticos else 0.0
            score_prioridad = w_prioridad if m['codigo'] in materias_prioritarias else 0.0
            # El ratio creditos actúa como un normalizador (densidad de valor del Knapsack)
            densidad_creditos = m['creditos'] if m['creditos'] > 0 else 1 
            
            m['priority_score'] = (score_retraso + score_dificultad + score_ruta + score_prioridad) / densidad_creditos

        # 4. Ordenamiento Heurístico O(N log N)
        disponibles.sort(key=lambda x: x['priority_score'], reverse=True)

        # 5. Algoritmo Greedy para empaquetamiento de créditos O(N)
        seleccion = []
        carga_creditos_actual = 0
        carga_dificultad_actual = 0
        procesados = set()
        mapa_lookup = {m['codigo']: m for m in disponibles}

        for m in disponibles:
            cod = m['codigo']
            if cod in procesados: continue
            
            coreqs_pendientes = [c for c in m['correquisitos'] if c not in aprobadas]
            
            # Si un correquisito no está disponible en este semestre, se omite el bloque entero
            if not all(c in mapa_lookup for c in coreqs_pendientes): continue 
            # Construir bloque atómico
            bloque_materias = [m] + [mapa_lookup[c] for c in coreqs_pendientes]
            creditos_bloque = sum(mat['creditos'] for mat in bloque_materias)
            
            if carga_creditos_actual + creditos_bloque <= max_creditos:
                for mat in bloque_materias:
                    if mat['codigo'] not in procesados:

                        es_avance_flexible = (mat['semestre_sugerido'] > ventana_maxima) and (mat.get('tipo') != 'Requisito_Idioma')
                        seleccion.append({
                            "codigo": mat['codigo'],
                            "nombre": mat['nombre'],
                            "creditos": mat['creditos'],
                            "dificultad": mat['dificultad'],
                            "es_critica": mat['codigo'] in codigos_criticos,
                            "requiere_avance_flexible": es_avance_flexible
                        })
                        procesados.add(mat['codigo'])
                        carga_creditos_actual += mat['creditos']
                        carga_dificultad_actual += mat['dificultad']
 
        return {
            "estadisticas": {
                "total_creditos": carga_creditos_actual,
                "dificultad_agregada": carga_dificultad_actual,
                "materias_inscritas": len(seleccion)
            },
            "seleccion": seleccion
        }
    
    def simular_trayectoria_completa(self, aprobadas_iniciales: list, creditos_iniciales: int, max_creditos: int = 17, perfil_estudiante: str = "balanceado", materias_prioritarias: list = None, plan_id: str = "SIST-2024", ignorar_ventana: bool = False) -> dict:
        if materias_prioritarias is None:
            materias_prioritarias = []
        # Aislamiento de variables de estado para no mutar los inputs
        estado_aprobadas = set(aprobadas_iniciales)
        estado_creditos = creditos_iniciales
        trayectoria_proyectada = []
        total_materias_plan = self.repo.get_total_materias_plan(plan_id)

        while True:
            # 1. Delegar toda la lógica matemática al generador de semestre
            resultado_semestre = self.generar_semestre_optimo(
                aprobadas=list(estado_aprobadas),
                creditos_acumulados=estado_creditos,
                max_creditos=max_creditos,
                perfil_estudiante=perfil_estudiante,
                materias_prioritarias=materias_prioritarias,
                plan_id=plan_id,
                ignorar_ventana=ignorar_ventana,
            )

            # 2. Condición de Parada: El empaquetador no pudo meter ninguna materia (Grafo vacío o Deadlock de créditos)
            materias_seleccionadas = resultado_semestre.get("seleccion", [])
            if not materias_seleccionadas:
                break

            # 3. Ensamblar output
            trayectoria_proyectada.append({
                "semestre_simulado": len(trayectoria_proyectada) + 1,
                "creditos_matriculados": resultado_semestre["estadisticas"]["total_creditos"],
                "materias": materias_seleccionadas
            })
            
            # 4. Mutación de Estado (Simulación Estocástica determinista)
            nuevos_codigos = {m["codigo"] for m in materias_seleccionadas}
            estado_aprobadas.update(nuevos_codigos)
            estado_creditos += resultado_semestre["estadisticas"]["total_creditos"]

        # Validación final de integridad
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
    