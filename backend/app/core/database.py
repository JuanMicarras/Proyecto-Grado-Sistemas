from neo4j import GraphDatabase
import threading

class Neo4jConnection:
    _instance = None
    _lock = threading.Lock() # Hilo seguro para concurrencia (Gunicorn/Uvicorn)

    def __new__(cls, uri, user, password):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(Neo4jConnection, cls).__new__(cls)
                # Configuración explícita del Pool de Conexiones
                cls._instance.driver = GraphDatabase.driver(
                    uri, 
                    auth=(user, password),
                    max_connection_pool_size=50, # Límite de conexiones abiertas simultáneas
                    connection_acquisition_timeout=60.0 # Timeout si el pool se agota
                )
            return cls._instance

    def get_driver(self):
        return self.driver

    def close(self):
        if self.driver:
            self.driver.close()