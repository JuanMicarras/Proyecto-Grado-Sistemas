# Acacia: Sistema Inteligente de Planificación Académica

![Status](https://img.shields.io/badge/Estado-Prototipo_Funcional-green)
![Docker](https://img.shields.io/badge/Despliegue-Docker_Compose-2496ED)
![Python](https://img.shields.io/badge/Backend-Python_FastAPI-blue)
![React](https://img.shields.io/badge/Frontend-React_Vite-cyan)
![Neo4j](https://img.shields.io/badge/Database-Neo4j-008CC1)

Este proyecto es un **Sistema de Apoyo a la Toma de Decisiones (DSS)** diseñado para optimizar la trayectoria académica de estudiantes de Ingeniería de Sistemas. Utiliza modelos matemáticos basados en grafos (DAGs) y técnicas de optimización multicriterio para sugerir rutas de graduación personalizadas.

## 🚀 Funcionalidades Principales

* **Modelado Curricular:** Representación del plan de estudios como un Grafo Dirigido Acíclico (DAG) persistente en Neo4j para gestionar prerrequisitos complejos.
* **Optimización de Trayectoria:** Algoritmo basado en *Constraint Programming* (Google OR-Tools) que calcula la ruta más corta para el grado.
* **Simulación de Escenarios:**
    * Control de carga académica (créditos máximos por semestre).
    * **Avance Flexible:** Opción para simular matrículas ignorando restricciones de nivel (bloqueos por rezago).
* **Visualización Interactiva:** Interfaz web para seleccionar materias aprobadas y visualizar el plan sugerido.

## 🛠️ Arquitectura y Tecnologías

El sistema sigue una arquitectura desacoplada **Cliente-Servidor**, completamente dockerizada para garantizar la consistencia entre entornos de desarrollo y producción:

### Backend (Cerebro)
* **Lenguaje:** Python 3.11
* **Framework:** FastAPI (High performance API)
* **Motor de Optimización:** Google OR-Tools (CP-SAT Solver) y NetworkX
* **Base de Datos:** Neo4j (Grafos) gestionada vía contenedor local

### Frontend (Interfaz)
* **Framework:** React (Vite) servido mediante Nginx en producción
* **Estilos:** Tailwind CSS / CSS puro
* **Comunicación:** Axios

## 📂 Estructura del Proyecto

/
├── backend/            # API, Lógica de Optimización y Scripts
│   ├── app/            # Código fuente de FastAPI
│   ├── data/           # malla_sistemas_nuevo.csv (Datos semilla)
│   ├── scripts/        # graph_builder.py (Carga de datos)
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

