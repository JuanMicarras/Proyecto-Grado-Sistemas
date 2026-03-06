// src/api/client.ts
import type { SimulationPayload, SimulatePathResponse, CatalogoResponse} from '../types/academic';

// Cambia este puerto por el que use tu backend en Python (FastAPI/Flask/Django)
const API_BASE_URL = 'http://localhost:8000/api/v1';

export const api = {
  /**
   * Estrategia: Simula toda la ruta hasta la graduación.
   */
  simulatePath: async (payload: SimulationPayload): Promise<SimulatePathResponse> => {
    const response = await fetch(`${API_BASE_URL}/simulate-path`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Lanzar un error aquí permite que React Query lo atrape automáticamente
      throw new Error(`Error del servidor: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Táctica: Optimiza solo el próximo semestre.
   * (Usamos 'any' temporalmente hasta que definamos la interfaz exacta de este endpoint).
   */
  optimizeSemester: async (payload: SimulationPayload): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/optimize-semester`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status}`);
    }

    return response.json();
  },

  getCatalogo: async (): Promise<CatalogoResponse> => {
    const response = await fetch(`${API_BASE_URL}/catalogo`);
    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status}`);
    }
    return response.json();
  }
  



};