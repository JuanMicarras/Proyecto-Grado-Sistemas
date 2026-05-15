# Acacia: Sistema Inteligente de Planificación Académica

![Status](https://img.shields.io/badge/Estado-Prototipo_Funcional-green)
![Docker](https://img.shields.io/badge/Despliegue-Docker_Compose-2496ED)
![Python](https://img.shields.io/badge/Backend-Python_FastAPI-blue)
![React](https://img.shields.io/badge/Frontend-React_Vite-cyan)
![Neo4j](https://img.shields.io/badge/Database-Neo4j-008CC1)

Este proyecto es un **Sistema de Apoyo a la Toma de Decisiones (DSS)** diseñado para optimizar la trayectoria académica de estudiantes de Ingeniería de Sistemas. Utiliza modelos matemáticos basados en grafos (DAGs) y técnicas de optimización multicriterio heurística para sugerir rutas de graduación personalizadas, respetando estrictamente la topología de correquisitos y prerrequisitos.

## 🚀 Funcionalidades Principales

* **Modelado Topológico Curricular:** Representación del plan de estudios como un Grafo Dirigido Acíclico (DAG) persistente en Neo4j.
* **Motor de Optimización Multicriterio (MCO):** Algoritmo *Greedy* adaptado al Problema de la Mochila 0/1 (Knapsack) que evalúa el *Longest Path* (Ruta Crítica) del DAG para empaquetar semestres óptimos.
* **Perfiles de Simulación:** El sistema adapta las recomendaciones basándose en la preferencia del estudiante:
    * *Agresivo:* Maximiza el avance topológico asumiendo mayor dificultad.
    * *Suave:* Minimiza la dificultad semestral.
    * *Balanceado:* Equilibra carga de créditos, rezago de semestres y cuellos de botella.
* **Agencia del Usuario (Materias Prioritarias):** Capacidad de inyectar preferencias estrictas al algoritmo para forzar la matriculación de materias específicas sin romper las reglas académicas.
* **Simulación de Escenarios Flexibles:**
    * Restricción de cohorte móvil (Ventana N+2 con Bypass para Exigencias de Idiomas).
    * **Avance Flexible:** Simulación de matrículas proyectadas ignorando restricciones de nivel visual.
    * **Rutas Mutuamente Excluyentes:** Cálculo dinámico de la meta de graduación dependiendo de la elección del estudiante (Práctica Profesional vs. Electivas Libres Complementarias).
* **Topología Visual:** Endpoints diseñados para inyectar *Swimlanes* temáticos ordenados a librerías de diagramación en el Frontend.

## 🛠️ Arquitectura y Tecnologías

El sistema sigue una **Arquitectura Híbrida (Por Capas + Orientada a Servicios RESTful)** con Inyección de Dependencias (IoC), completamente dockerizada para garantizar la consistencia entre entornos.

### Backend (Application Server)
* **Lenguaje:** Python 3.1x
* **Framework:** FastAPI (Ejecución síncrona optimizada para concurrencia de I/O)
* **Capa de Dominio/Servicios:** Máquinas de Estado de Markov iterativas y Algoritmia Combinatoria puramente nativa en Python (sin librerías matemáticas pesadas externas).
* **Capa de Acceso a Datos (Persistencia):** Neo4j gestionada vía Driver Bolt con un Singleton Connection Pool.

### Frontend (Client Presentation)
* **Framework:** React (Vite) servido mediante Nginx en producción.
* **Estilos:** Tailwind CSS / CSS puro.
* **Comunicación:** Axios (Consumo de REST API bajo políticas CORS estrictas).

## 📂 Estructura del Proyecto

```text
/
├── backend/            # API, Lógica MCO, Repositorios y Scripts
│   ├── app/            
│   │   ├── api/        # Controladores HTTP (routes.py)
│   │   ├── core/       # Configuración y Singleton de Neo4j (database.py)
│   │   ├── models/     # DTOs y validadores Pydantic (domain.py)
│   │   ├── repository/ # Capa de abstracción Cypher y Grafo (graph_repo.py)
│   │   └── services/   # Cerebro heurístico y Máquina de Estados (path_optimizer.py)
│   ├── data/           # malla_sistemas_nuevo.csv (Datos semilla)
│   ├── scripts/        # graph_builder.py (Script de ingesta ETL)
│   ├── .env            # Variables de entorno
│   ├── Dockerfile      # Receta de construcción del backend
│   └── requirements.txt
│
├── frontend/           # Interfaz de Usuario Web
│   ├── src/            # Código fuente React
│   ├── Dockerfile      # Receta multi-stage (Node + Nginx)
│   └── package.json
│
└── docker-compose.yml  # Orquestador del ecosistema completo
```
## ⚙️ Instalación y Ejecución
El proyecto está diseñado para desplegarse fácilmente usando contenedores, lo que automatiza la creación de la base de datos, la carga de la malla curricular y el levantamiento de los servidores.

### Opción 1: Ejecución con Docker (Recomendada)
Requisitos: Tener instalado Docker Desktop.

Abre una terminal en la raíz del proyecto.

Ejecuta el orquestador:

``` Bash
docker compose up --build
```

(Nota: El sistema incluye un contenedor sembrador (db_seeder) que inyectará automáticamente los datos a la base de datos la primera vez que se ejecute y luego se apagará de forma segura).

Accesos:

Frontend (App Web): http://localhost:5183

Backend (API Docs): http://localhost:8000/docs

Neo4j (Panel de BD): http://localhost:7474 (Usuario: neo4j / Contraseña: tesis123)

### Opción 2: Ejecución Local para Desarrollo (Sin Docker)
Si deseas modificar el código en tiempo real sin reconstruir los contenedores:

#### 1. Levantar Base de Datos (Neo4j)

``` Bash
docker run -d --name tesis-neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/tesis123 -v neo4j_data:/data neo4j:5
```
#### 2. Configurar y lanzar el Backend

``` Bash
cd backend
python -m venv venv
# Activar entorno virtual (Windows: venv\Scripts\activate | Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt

# Cargar datos semilla (Solo la primera vez)
python scripts/graph_builder.py

# Iniciar servidor
uvicorn app.main:app --reload
#Con el .env seria este
uvicorn app.main:app --reload --env-file .env
```

#### 3. Configurar y lanzar el Frontend
En una nueva terminal:

``` Bash
cd frontend
npm install
npm run dev
```
La web iniciará en: http://localhost:5173 (o similar)

📋 Autores
Alejandra Valencia Rua 
Elvira E. Florez Carbonell
Juan M. Carrasquilla Escobar

