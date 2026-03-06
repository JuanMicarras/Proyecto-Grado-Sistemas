from pydantic import BaseModel, Field
from typing import List

class StudentStateRequest(BaseModel):
    aprobadas: List[str] = Field(
        ..., 
        description="Lista de códigos de materias aprobadas",
        example=["MAT1031", "MAT1101", "IST0010"]
    )
    creditos_acumulados: int = Field(
        ..., 
        ge=0, 
        description="Total de créditos aprobados históricamente"
    )
    max_creditos: int = Field(
        default=17, 
        ge=1, 
        le=22, 
        description="Límite máximo de créditos a matricular en el semestre"
    )
    perfil_estudiante: str = Field(
        default="balanceado", 
        pattern="^(balanceado|agresivo|suave)$",
        description="Heurística multicriterio a aplicar"
    )