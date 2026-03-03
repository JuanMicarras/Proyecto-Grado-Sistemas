# Sistema Inteligente de Planificación Académica (SIPA)

![Status](https://img.shields.io/badge/Estado-Prototipo_Funcional-green)
![Python](https://img.shields.io/badge/Backend-Python_FastAPI-blue)
![React](https://img.shields.io/badge/Frontend-React_Vite-cyan)

Este proyecto es un **Sistema de Apoyo a la Toma de Decisiones (DSS)** diseñado para optimizar la trayectoria académica de estudiantes de Ingeniería de Sistemas. Utiliza modelos matemáticos basados en grafos (DAGs) y técnicas de optimización multicriterio para sugerir rutas de graduación personalizadas.

## 🚀 Funcionalidades Principales

* **Modelado Curricular:** Representación del plan de estudios como un Grafo Dirigido Acíclico (DAG) para gestionar prerrequisitos complejos.
* **Optimización de Trayectoria:** Algoritmo basado en *Constraint Programming* (Google OR-Tools) que calcula la ruta más corta para el grado.
* **Simulación de Escenarios:**
    * Control de carga académica (créditos máximos por semestre).
    * **Avance Flexible:** Opción para simular matrículas ignorando restricciones de nivel (bloqueos por rezago).
* **Visualización Interactiva:** Interfaz web para seleccionar materias aprobadas y visualizar el plan sugerido.

## 🛠️ Arquitectura y Tecnologías

El sistema sigue una arquitectura desacoplada **Cliente-Servidor**:

### Backend (Cerebro)
* **Lenguaje:** Python 3.10+
* **Framework:** FastAPI (High performance API).
* **Motor de Optimización:** Google OR-Tools (CP-SAT Solver).
* **Grafos:** NetworkX.
* **Datos:** Carga dinámica desde CSV (`malla_sistemas_nuevo.csv`).

### Frontend (Interfaz)
* **Framework:** React (Vite).
* **Estilos:** CSS puro / Tailwind conceptual.
* **Comunicación:** Axios.

## 📂 Estructura del Proyecto

```text
/
├── backend/            # API y Lógica de Optimización
│   ├── main.py         # Punto de entrada de la aplicación
│   ├── malla_sistemas_nuevo.csv # Definición del Plan de Estudios
│   └── requirements.txt
│
├── frontend/           # Interfaz de Usuario Web
│   ├── src/            # Código fuente React
│   └── package.json
```

## ⚙️ Instalación y Ejecución
Sigue estos pasos para correr el proyecto en local:
### 1. Levantar Base de Datos (Neo4j)
``` Bash
docker run -d --name tesis-neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/tesis123 neo4j:latest
```
Acceder al panel en: http://localhost:7474
### 2. Configurar el Backend
``` Bash
cd backend
# (Opcional) Crear entorno virtual: python -m venv venv
pip install -r requirements.txt
# (Solo la primera vez) Cargar datos semilla
python loader.py
uvicorn main:app --reload
El servidor iniciará en: http://127.0.0.1:8000
```

### 2. Configurar el Frontend
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

