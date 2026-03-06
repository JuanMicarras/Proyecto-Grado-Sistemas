import pandas as pd
from neo4j import GraphDatabase
import os
from pathlib import Path

class CurricularGraphBuilder:
    def __init__(self, uri, user, password):
        # El driver maneja un pool de conexiones thread-safe internamente
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def build_graph(self, csv_path, plan_id="SIST-2024", carrera="Ingeniería de Sistemas", version=2024):
        # 1. Carga y pre-procesamiento estricto en memoria (Pandas)
        df = pd.read_csv(csv_path)
        
        # Sanitización de datos para evitar fallos de casteo en Cypher
        df['prerrequisitos'] = df['prerrequisitos'].fillna('')
        df['correquisitos'] = df['correquisitos'].fillna('')
        df['creditos'] = df['creditos'].fillna(0).astype(int)
        df['semestre'] = df['semestre'].fillna(0).astype(int)
        df['min_creditos_req'] = df['min_creditos_req'].fillna(0).astype(int)
        # Preparación para el futuro: si no hay dificultad, asume 1 (peso base para Dijkstra/A*)
        df['dificultad'] = df['dificultad'].fillna(1).astype(int) 

        # Preparar listas de adyacencia en Python (más rápido que parsear strings en Cypher)
        prereq_relations = []
        coreq_relations = set() # Set para evitar duplicados en correquisitos

        for _, row in df.iterrows():
            target = row['codigo']
            
            # Prerrequisitos -> Relación dirigida (HABILITA)
            if row['prerrequisitos']:
                reqs = str(row['prerrequisitos']).split(';')
                for r in reqs:
                    if r.strip():
                        prereq_relations.append({'req': r.strip(), 'target': target})
            
            # Correquisitos -> Relación no dirigida (EXIGE_CORREQUISITO)
            if row['correquisitos']:
                coreqs = str(row['correquisitos']).split(';')
                for c in coreqs:
                    c = c.strip()
                    if c:
                        # Orden lexicográfico para garantizar unicidad bidireccional en memoria
                        m1, m2 = sorted([target, c])
                        coreq_relations.add((m1, m2))

        # Convertir set de tuplas a lista de diccionarios para Neo4j
        coreq_relations = [{'m1': m1, 'm2': m2} for m1, m2 in coreq_relations]

        # 2. Ejecución de Transacciones en Neo4j
        with self.driver.session() as session:
            # Limpiar grafo (Solo para desarrollo)
            session.run("MATCH (n) DETACH DELETE n")

            # A. Esquema de Base de Datos (Índices y Restricciones)
            session.run("CREATE CONSTRAINT materia_codigo IF NOT EXISTS FOR (m:Materia) REQUIRE m.codigo IS UNIQUE")
            session.run("CREATE CONSTRAINT plan_id IF NOT EXISTS FOR (p:PlanEstudio) REQUIRE p.id IS UNIQUE")
            #Registrar el tipo de relación en el diccionario de Neo4j (Dummy Insert)
            session.run("""
                CREATE (a:Dummy)-[r:EXIGE_CORREQUISITO]->(b:Dummy)
                DELETE a, r, b
            """)
            # B. Crear Nodo Raíz (Plan de Estudio)
            session.run("""
                MERGE (p:PlanEstudio {id: $plan_id})
                SET p.carrera = $carrera, p.version = $version
            """, plan_id=plan_id, carrera=carrera, version=version)

            # C. Ingesta Batch de Nodos y vinculación al Plan
            nodes_data = df.to_dict('records')
            node_query = """
                UNWIND $rows AS row
                MERGE (m:Materia {codigo: row.codigo})
                SET m.nombre = row.nombre,
                    m.creditos = toInteger(row.creditos),
                    m.semestre = toInteger(row.semestre),
                    m.min_creditos_req = toInteger(row.min_creditos_req),
                    m.tipo = row.tipo,
                    m.dificultad = toInteger(row.dificultad)
                WITH m
                MATCH (p:PlanEstudio {id: $plan_id})
                MERGE (m)-[:PERTENECE_A]->(p)
            """
            session.run(node_query, rows=nodes_data, plan_id=plan_id)

            # D. Ingesta Batch de Prerrequisitos (DAG Forward)
            if prereq_relations:
                prereq_query = """
                    UNWIND $rel_list AS rel
                    MATCH (pre:Materia {codigo: rel.req})
                    MATCH (post:Materia {codigo: rel.target})
                    MERGE (pre)-[:HABILITA]->(post)
                """
                session.run(prereq_query, rel_list=prereq_relations)

            # E. Ingesta Batch de Correquisitos (Undirected)
            if coreq_relations:
                coreq_query = """
                    UNWIND $coreq_list AS req
                    MATCH (a:Materia {codigo: req.m1})
                    MATCH (b:Materia {codigo: req.m2})
                    MERGE (a)-[:EXIGE_CORREQUISITO]-(b)
                """
                session.run(coreq_query, coreq_list=coreq_relations)

        print("Grafo curricular construido y optimizado exitosamente.")

if __name__ == "__main__":
    URI = "bolt://localhost:7687"
    USER = "neo4j"
    PASSWORD = "tesis123" # Inyectar por variables de entorno en Producción
    
    # 1. Obtiene la ruta del archivo actual: backend/scripts/graph_builder.py
    # 2. .parent sube a 'scripts/'
    # 3. .parent sube a 'backend/' (la raíz de tu proyecto)
    BASE_DIR = Path(__file__).resolve().parent.parent
    # Resolver ruta absoluta para evitar problemas con CWD
    # 4. Construye la ruta hacia la carpeta data
    # Esto genera automáticamente: C:\Users\juanm\...\backend\data\malla_sistemas_nuevo.csv
    ruta_csv = BASE_DIR / "data" / "malla_sistemas_nuevo.csv"

    # 5. Ahora SÍ puedes usar .exists() porque ruta_csv es un Objeto Path
    if not ruta_csv.exists():
        print(f"ERROR: No se encontró el archivo en: {ruta_csv}")
        # Opcional: listar qué hay en la carpeta data para depurar
        exit(1)
    print(f"Archivo encontrado exitosamente: {ruta_csv}")
    builder = CurricularGraphBuilder(URI, USER, PASSWORD)
    builder.build_graph(ruta_csv)
    builder.close()