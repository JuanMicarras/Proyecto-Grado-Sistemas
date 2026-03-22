class CurricularRepository:
    def __init__(self, driver):
        self.driver = driver

    def get_materias_disponibles(self, aprobadas: list, creditos_acumulados: int, plan_id: str = "SIST-2024") -> list:
        """
        USO: Endpoint /optimize-semester (Táctico).
        Lógica flexible: Retorna todo lo lógicamente desbloqueado sin forzar N+2 en BD.
        """
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
        
    def get_materias_disponibles_pathfinder(self, aprobadas: list, creditos_acumulados: int, plan_id: str = "SIST-2024") -> list:
        query = """
        MATCH (m:Materia)-[:PERTENECE_A]->(p:PlanEstudio {id: $plan_id})
        WHERE NOT m.codigo IN $aprobadas
        
        // Extraer Prerrequisitos
        OPTIONAL MATCH (req:Materia)-[:HABILITA]->(m)
        WITH m, collect(req.codigo) AS prerrequisitos
        
        // Extraer Correquisitos Bidireccionales
        OPTIONAL MATCH (m)-[:EXIGE_CORREQUISITO]-(coreq:Materia)
        WITH m, prerrequisitos, collect(coreq.codigo) AS correquisitos
        
        WHERE all(r IN prerrequisitos WHERE r IN $aprobadas)
        AND $creditos_acumulados >= m.min_creditos_req
        
        RETURN m.codigo AS codigo, 
               m.nombre AS nombre, 
               m.creditos AS creditos, 
               m.dificultad AS dificultad,
               m.semestre AS semestre_sugerido,
               m.tipo AS tipo,
               correquisitos
        """
        with self.driver.session() as session:
            result = session.run(query, plan_id=plan_id, aprobadas=aprobadas, creditos_acumulados=creditos_acumulados)
            return [record.data() for record in result]
    
    def get_total_materias_plan(self, plan_id: str = "SIST-2024") -> int:
        """
        Retorna el número total de vértices (materias) en el DAG del plan de estudios.
        """
        query = "MATCH (m:Materia)-[:PERTENECE_A]->(:PlanEstudio {id: $plan_id}) RETURN count(m) AS total"
        with self.driver.session() as session:
            result = session.run(query, plan_id=plan_id)
            return result.single()["total"]
        
    def get_catalogo(self, plan_id: str = "SIST-2024") -> list:
        """
        Retorna todas las materias del plan de estudios agrupadas por semestre.
        """
        query = """
        MATCH (m:Materia)-[:PERTENECE_A]->(p:PlanEstudio {id: $plan_id})
        RETURN m.codigo AS codigo, 
               m.nombre AS nombre, 
               m.creditos AS creditos, 
               m.semestre AS semestre,
               m.tipo AS tipo,
               m.dificultad AS dificultad,
               m.min_creditos_req AS min_creditos_req
        ORDER BY m.semestre ASC, m.nombre ASC
        """
        with self.driver.session() as session:
            result = session.run(query, plan_id=plan_id)
            return [record.data() for record in result]

    def get_malla_visual(self, plan_id: str = "SIST-2024") -> dict:
        """
        Extrae la topología completa del DAG estructurada para librerías 
        de renderizado visual en el Frontend (Nodos y Aristas) y la ordena heurísticamente
        para simular los 'carriles visuales'.
        """
        query = """
        MATCH (m:Materia)-[:PERTENECE_A]->(p:PlanEstudio {id: $plan_id})
        // Buscamos opcionalmente qué materias habilitan a 'm'
        OPTIONAL MATCH (pre:Materia)-[:HABILITA]->(m)
        RETURN m.codigo AS id, 
               m.nombre AS label, 
               m.semestre AS nivel,
               m.tipo AS tipo,
               m.creditos AS creditos,
               collect(pre.codigo) AS prerrequisitos
        """
        with self.driver.session() as session:
            result = session.run(query, plan_id=plan_id)
            
            nodes = []
            edges = []
            
            for record in result:
                target_id = record["id"]
                
                # 1. Construir el Nodo
                nodes.append({
                    "id": target_id,
                    "data": { 
                        "label": record["label"],
                        "nivel": record["nivel"],
                        "tipo": record["tipo"],
                        "creditos": record["creditos"]
                    }
                })
                
                # 2. Construir las Aristas (Edges)
                for pre_req in record["prerrequisitos"]:
                    if pre_req is not None:
                        edges.append({
                            "id": f"e-{pre_req}-{target_id}",
                            "source": pre_req,
                            "target": target_id,
                            "type": "smoothstep", # Sugerencia visual para el front
                            "animated": True      # Opcional para mostrar flujo
                        })
            def get_prioridad_area(codigo: str) -> int:
                # prefijo = codigo[:3]
                # jerarquia = {
                #     "MAT": 1,  # Matemáticas (Arriba)
                #     "FIS": 2,  # Física
                #     "EST": 3,  # Estadística
                #     "IST": 4,  # Sistemas / Disciplinares (Centro)
                #     "INV": 5,  # Proyectos / Investigación
                #     "IIN": 6,  # Exámenes Comprensivos
                #     "CAS": 7,  # Competencias Comunicativas
                #     "ELG": 8,  # Electivas
                #     "ELP": 9,  # Electivas Libres
                #     "IGL": 10, # Idiomas 
                # }
                prefijo = codigo
                
                jerarquia = {    
                    "MAT1031": 1, "MAT1101": 2, "IST0010": 3, "IST2088": 4, "CAS3020": 5, "IGL1010": 6,
                    "ELG1140": 1, "MAT1111": 2, "FIS1023": 3, "IST2089": 4, "CAS3030": 5, "IGL1020": 6,
                    "ELG1130": 1, "MAT1121": 2, "FIS1043": 3, "IST4021": 4, "IST2110": 5, "IGL1030": 6,
                    "ELG1150": 1, "MAT4011": 2, "FIS1033": 3, "IST4031": 4, "MAT4021": 5, "IGL1040": 6,
                    "ELG0007": 1, "EST7042": 2, "IST4310": 3, "IST4330": 4, "IST7072": 5, "IGL4010": 6, "IIN4310": 7, "IST4370": 8,
                    "ELG0008": 1, "IST4360": 2, "IST7111": 3, "IST7191": 4, "IST4012": 5, "IGL4040": 6,
                    "ELG1170": 1, "IST7420": 2, "IST7121": 3, "IST7081": 4, "IST7102": 5, "IGL7030": 6,
                    "ELG1190": 1, "ELG1301": 2, "IST7122": 3, "ELG1302": 4, "IST7410": 5, "ELG8400": 6, "IGL7080": 7,
                    "ELG1160": 1, "ELG1305": 2, "ELG1303": 3, "ELG1304": 4, "ELP4030": 5, "IIN4319": 6, "IST4380": 7,
                    "ELG1180": 1, "ELG1306": 2, "INV7363": 3, "ELP8090": 4,
                }
                return jerarquia.get(prefijo, 99)
            
            nodes.sort(key=lambda n: (
                # 1. Criterio Primario: Semestre (Columna en la UI)
                n["data"]["nivel"] if n["data"]["nivel"] > 0 else 99, 
                
                # 2. Criterio Secundario: Carril Temático (Fila en la UI)
                get_prioridad_area(n["id"]),
                
                # 3. Desempate: Orden alfabético por si hay dos del mismo área
                n["id"]
            ))
                        
            return {
                "nodes": nodes,
                "edges": edges
            }
        
