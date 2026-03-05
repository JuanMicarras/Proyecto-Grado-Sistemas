class CurricularRepository:
    def __init__(self, driver):
        self.driver = driver

    def get_materias_disponibles(self, aprobadas: list, creditos_acumulados: int, plan_id: str = "SIST-2024") -> list:
        query = """
        MATCH (m:Materia)-[:PERTENECE_A]->(p:PlanEstudio {id: $plan_id})
        WHERE NOT m.codigo IN $aprobadas
        
        OPTIONAL MATCH (req:Materia)-[:HABILITA]->(m)
        WITH m, collect(req.codigo) AS prerrequisitos
        
        WHERE all(r IN prerrequisitos WHERE r IN $aprobadas)
        AND $creditos_acumulados >= m.min_creditos_req
        
        RETURN m.codigo AS codigo, 
               m.nombre AS nombre, 
               m.creditos AS creditos, 
               m.dificultad AS dificultad,
               m.semestre AS semestre_sugerido
        ORDER BY m.semestre ASC, m.dificultad ASC
        """
        with self.driver.session() as session:
            result = session.run(query, plan_id=plan_id, aprobadas=aprobadas, creditos_acumulados=creditos_acumulados)
            return [record.data() for record in result]

    def get_ruta_critica_absoluta(self, plan_id: str = "SIST-2024") -> dict:
        """
        Calcula el Longest Path en el DAG para identificar el cuello de botella del pensum.
        """
        query = """
        // 1. Identificar Nodos Raíz (sin prerrequisitos) y Nodos Hoja (que no habilitan a nadie)
        MATCH path = (start:Materia)-[:HABILITA*]->(end:Materia)
        WHERE NOT ()-[:HABILITA]->(start) 
          AND NOT (end)-[:HABILITA]->()
          AND (start)-[:PERTENECE_A]->(:PlanEstudio {id: $plan_id})
          
        // 2. Extraer métricas de la ruta
        RETURN [n IN nodes(path) | n.codigo] AS ruta_codigos,
               length(path) AS profundidad_semestres,
               reduce(s = 0, n IN nodes(path) | s + n.creditos) AS total_creditos_ruta
               
        // 3. Maximizar por longitud de saltos y desempatar por carga de créditos
        ORDER BY profundidad_semestres DESC, total_creditos_ruta DESC
        LIMIT 1
        """
        with self.driver.session() as session:
            result = session.run(query, plan_id=plan_id)
            record = result.single()
            return record.data() if record else {}
        
    def get_ruta_critica_dinamica(self, aprobadas: list, plan_id: str = "SIST-2024") -> dict:
        """
        Calcula el Longest Path en el DAG excluyendo los nodos ya aprobados.
        Complejidad de búsqueda optimizada por filtrado inicial.
        """
        query = """
        MATCH path = (inicio:Materia)-[:HABILITA*]->(fin:Materia)
        WHERE (inicio)-[:PERTENECE_A]->(:PlanEstudio {id: $plan_id})
          AND NOT inicio.codigo IN $aprobadas
          AND NOT (fin)-[:HABILITA]->()
          
        // Extraer los nodos de la ruta descartando las aprobadas
        WITH [n IN nodes(path) WHERE NOT n.codigo IN $aprobadas] AS ruta_filtrada
        
        // Calcular métricas ignorando las materias de 0 créditos (como Idiomas) para la longitud real
        WITH ruta_filtrada,
             [n IN ruta_filtrada WHERE n.creditos > 0] AS ruta_disciplinar,
             reduce(s = 0, n IN ruta_filtrada | s + n.creditos) AS creditos_ruta
             
        RETURN [n IN ruta_filtrada | {
                 codigo: n.codigo, 
                 nombre: n.nombre, 
                 creditos: n.creditos
               }] AS ruta_completa,
               size(ruta_disciplinar) AS semestres_disciplinares,
               creditos_ruta
        // Ahora maximizamos buscando la ruta con más materias que SÍ tienen créditos
        ORDER BY semestres_disciplinares DESC, creditos_ruta DESC
        LIMIT 1
        """
        with self.driver.session() as session:
            result = session.run(query, plan_id=plan_id, aprobadas=aprobadas)
            record = result.single()
            if not record:
                return {"ruta": [], "materias_en_ruta": 0, "creditos_ruta": 0}
                
            return {
                "ruta": record["ruta_completa"],
                "materias_en_ruta": record["semestres_disciplinares"],
                "creditos_ruta": record["creditos_ruta"]
            }
        
