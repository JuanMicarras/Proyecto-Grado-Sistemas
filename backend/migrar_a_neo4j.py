import pandas as pd
from neo4j import GraphDatabase
import os

# Configuración
URI = "bolt://localhost:7687"
AUTH = ("neo4j", "tesis123")

def migrar_datos():

    base_dir = os.path.dirname(__file__)
    ruta_csv = os.path.join(base_dir, 'malla_sistemas_nuevo.csv')

    df = pd.read_csv(ruta_csv)
    df['prerrequisitos'] = df['prerrequisitos'].fillna('')
    
    driver = GraphDatabase.driver(URI, auth=AUTH)
    
    with driver.session() as session:
        # 1. Limpiar base de datos previa
        session.run("MATCH (n) DETACH DELETE n")
        print("Base de datos limpiada.")

        # 2. Crear Nodos (Materias)
        for _, row in df.iterrows():
            query = """
            CREATE (m:Materia {
                codigo: $codigo,
                nombre: $nombre,
                creditos: $creditos,
                semestre: $semestre,
                min_creditos_req: $min_creditos_req,
                tipo: $tipo
            })
            """
            session.run(query, 
                        codigo=row['codigo'], 
                        nombre=row['nombre'], 
                        creditos=int(row['creditos']), 
                        semestre=int(row['semestre']),
                        min_creditos_req=int(row['min_creditos_req']),
                        tipo=row['tipo'])
        print(f"Nodos creados: {len(df)}")

        # 3. Crear Relaciones (Prerrequisitos)
        for _, row in df.iterrows():
            if row['prerrequisitos']:
                reqs = str(row['prerrequisitos']).split(';')
                for req in reqs:
                    req = req.strip()
                    # Crear flecha: (Prerrequisito)-[:HABILITA]->(Materia)
                    query_rel = """
                    MATCH (a:Materia {codigo: $req}), (b:Materia {codigo: $target})
                    MERGE (a)-[:HABILITA]->(b)
                    """
                    session.run(query_rel, req=req, target=row['codigo'])
        print("Relaciones creadas.")

    driver.close()

if __name__ == "__main__":
    migrar_datos()