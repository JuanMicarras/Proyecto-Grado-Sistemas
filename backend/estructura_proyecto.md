backend_tesis/
├── app/
│   ├── __init__.py
│   ├── main.py                 # Punto de entrada (Setup de API/App)
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py           # Carga de variables de entorno (.env)
│   │   └── database.py         # Singleton del Driver de Neo4j (Connection Pool)
│   ├── models/
│   │   ├── __init__.py
│   │   └── domain.py           # Clases puras de Python (DTOs, Pydantic models)
│   ├── repository/
│   │   ├── __init__.py
│   │   ├── base_repo.py        # Interfaz base
│   │   └── graph_repo.py       # Capa exclusiva para queries Cypher (CurricularQueryEngine)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── path_optimizer.py   # Lógica MCO (A*, Dijkstra) sin saber de Cypher
│   │   └── student_service.py  # Reglas de negocio (cálculo de estado del estudiante)
│   └── api/                    # (Opcional) Si vas a exponer REST con FastAPI/Flask
│       ├── __init__.py
│       └── routes.py           # Controladores HTTP
├── data/
│   └── malla_sistemas_nuevo.csv # Origen crudo (Seed)
├── scripts/
│   └── graph_builder.py        # El script de ingesta (CurricularGraphBuilder) que ya hicimos
├── tests/
│   ├── test_algorithms.py      # Tests aislados para algoritmos de grafos
│   └── test_graph_repo.py      # Tests de integración con Neo4j
├── .env                        # NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
├── .gitignore
└── requirements.txt            # neo4j, pandas, python-dotenv, etc.s