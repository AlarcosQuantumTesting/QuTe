# appDeter/Backend/models/table_model.py
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator
#esto te lo pide la programacion de fast api, es la tabal de test configuration
class TableRowModel(BaseModel):
    label: str
    index: int
    kind: Literal["input", "output"]
    # ------------------------------
    # Servicio base de una fila de la tabla de configuración de qubits.
    # Representa un qubit “pintable” en el frontend con su etiqueta, índice numérico
    # y su rol (input u output).
    # ------------------------------
class TableConfig(BaseModel):
    num_qubits: int = Field(gt=0, description="number of qubits.")
    inputs:  List[int] = Field(default_factory=list, description="Input qubit indices.")
    outputs: List[int] = Field(default_factory=list, description="Output qubit indices.")
    input_header:  str = "Inputs"
    output_header: str = "Outputs"
    qubit_prefix:  str = "q"
    input_init_values: List[str] = Field(default_factory=list, description="Optional per-input init tokens: '',0,1,h,y,z,s,t")

    @model_validator(mode="after")
    def _check(self):
        max_q = self.num_qubits - 1
        for v in self.inputs + self.outputs:
            if v < 0 or v > max_q:
                raise ValueError(f"Qubit {v} out of ranges(0-{max_q}).")
        if len(set(self.inputs)) != len(self.inputs):
            raise ValueError("Input qubit indices must be unique.")
        if len(set(self.outputs)) != len(self.outputs):
            raise ValueError("Output qubit indices must be unique.")
        # Qubits disjuntos (sin solape)
        if set(self.inputs) & set(self.outputs):
            raise ValueError("A qubit cannot be both an input and an output.")
        return self

    # ------------------------------
    # Configuración completa de la tabla de Test Configuration.
    # Define el número total de qubits del circuito y qué índices son inputs/outputs,
    # además de cabeceras y prefijos para construir labels (ej: "q0").
    # Incluye opcionalmente tokens de inicialización por qubit de entrada.
    # ------------------------------
class TableResponse(BaseModel):
    input_header: str
    output_header: str
    inputs:  List[TableRowModel]
    outputs: List[TableRowModel]
