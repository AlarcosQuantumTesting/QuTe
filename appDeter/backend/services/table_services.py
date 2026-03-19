# table_services.py
from ..models.table_model import TableConfig, TableResponse, TableRowModel

def build_table(config: TableConfig):
    inputs  = config.inputs or []
    outputs = config.outputs or []

    input_labels  = [f"{config.qubit_prefix}{i}" for i in inputs]
    output_labels = [f"{config.qubit_prefix}{i}" for i in outputs]

    if not input_labels:  input_labels  = [""]
    if not output_labels: output_labels = [""]

    init_vals = config.input_init_values or []

    def get_init(i):
        if i < len(init_vals):
            v = init_vals[i]
            return "" if v in (None, "") else str(v)
        return ""

    table_data = [{
        "Input Init":  [get_init(i) for i in range(len(input_labels))],
        "outputs": ["" for _ in range(len(output_labels))],
    }]

    return {
        "headers": {"inputs": input_labels, "outputs": output_labels},
        "rows": table_data
    }
'''
# appDeter/Backend/models/table_model.py
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator
#esto te lo pide la programacion de fast api, es la tabal de test configuration
class TableRowModel(BaseModel):
    label: str
    index: int
    kind: Literal["input", "output"]

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

class TableResponse(BaseModel):
    input_header: str
    output_header: str
    inputs:  List[TableRowModel]
    outputs: List[TableRowModel]

'''