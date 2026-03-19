import json

class Converter:
    def __init__(self, file_path=None):
        self.control_qubits = []
        self.control_values = []
        self.circuit_name = ""
        self.file_path = file_path  # Ruta del archivo, opcional

   # Nombre del circuito
        
    def convert(self, language):
        with open(self.file_path, "r") as file:
            json_data = json.load(file)
        
        if language == "qiskit":
            return self.generate_algorithm_qiskit("qc", json_data)
        elif language == "qsharp":
            return self.generate_qsharp_code("QuantumProgram", json_data)
        else:
            raise ValueError(f"Lenguaje no soportado: {language}")
        
    def generate_algorithm_qiskit(self, name, json_data):
        self.circuit_name = name
        steps = json_data["cols"]
    
    # Encabezado con las importaciones necesarias
        code = (
        "import matplotlib.pyplot as plt\n"
        "import numpy as np\n"
        "from qiskit import QuantumCircuit, transpile, assemble, QuantumRegister, ClassicalRegister\n"
        "from qiskit_aer import AerSimulator\n"
        "from math import gcd\n"
        "from numpy.random import randint\n"
        "import pandas as pd\n"
        "import importlib.util\n"
        "from fractions import Fraction\n\n"
        "def create_cut_circuit():\n"
        "    qc = QuantumCircuit()\n"
        )
    
        if steps: 
            num_qubits=max(len(step) for step in steps)
        else:
            num_qubits = 0
        code += f"    qreg = QuantumRegister({num_qubits}, 'q')\n"
        code += f"    qc.add_register(qreg)\n"
        
    
    # Generación del código para cada paso
        for step in steps:
            code += self.generate_step_code(step)
    
    # Cierre de la función
        code += f"    return {self.circuit_name}\n"
        return code

    def generate_step_code(self, step):
        """Genera el código para un paso del circuito."""
        self.control_qubits = []
        self.control_values = []
        code = ""
        controlled = self.check_for_controls(step)
    
        for qubit_index, gate in enumerate(step):
            if isinstance(gate, str):  # Si es una puerta
                if gate in ["H", "X", "Y", "Z", "Z^½", "Z^¼"]:
                    if not controlled:
                        code += f"    {self.circuit_name}.{self.map_gate(gate)}(qreg[{qubit_index}])\n"
                    else:
                        code += self.controlled_unitary_gate(gate.lower(), qubit_index)
                elif gate == "Swap":
                 # Implementar manejo de Swap
                 pass
            # Otros casos para puertas personalizadas
            elif gate == 1:  # Si es un espacio vacío
                continue
    
        return code

    
    def check_for_controls(self, step):
        """Revisa si hay controles en el paso."""
        for qubit_index, gate in enumerate(step):
            if gate == "•":
                self.control_qubits.append(qubit_index)
                self.control_values.append(True)
            elif gate == "◦":
                self.control_qubits.append(qubit_index)
                self.control_values.append(False)
        
        return len(self.control_qubits) > 0
    
    def controlled_unitary_gate(self, gate, target_qubit):
        """Genera el código para una puerta controlada."""
        if len(self.control_qubits) == 1:
            control = self.control_qubits[0]
            return f"{self.circuit_name}.c{gate}({control}, {target_qubit})\n"
        elif len(self.control_qubits) == 2:
            control1, control2 = self.control_qubits
            return f"{self.circuit_name}.cc{gate}({control1}, {control2}, {target_qubit})\n"
        return ""
    
    def map_gate(self, gate):
        """Mapea el nombre de la puerta al método correspondiente en Qiskit."""
        gate_mapping = {
            "H": "h",
            "X": "x",
            "Y": "y",
            "Z": "z",
            "Z^½": "s",
            "Z^¼": "t",
        }
        return gate_mapping.get(gate, "x")  # Predeterminado a X para errores
    
    def parse_json(self, json_string):
        """Parsea una cadena JSON y genera código Qiskit."""
        json_data = json.loads(json_string)
        return self.generate_algorithm_code("qc", json_data)
    
    def generate_qsharp_code(self, name, json_data):
        """Genera el código de Q# a partir del JSON."""
        self.circuit_name = name
        steps = json_data["cols"]
        code = f"namespace QuantumCircuits {{\n"
        code += f"    open Microsoft.Quantum.Intrinsic;\n"
        code += f"    open Microsoft.Quantum.Canon;\n"
        code += f"    operation {self.circuit_name}() : Unit {{\n"
        code += f"        using (qs = Qubit[{len(steps[0])}]) {{\n"

        for step in steps:
            code += self.generate_qsharp_step_code(step)

        code += "        }\n    }\n}\n"
        return code

    def generate_qsharp_step_code(self, step):
        """Genera el código para un paso en Q#."""
        self.control_qubits = []
        self.control_values = []
        code = ""
        controlled = self.check_for_controls(step)

        for qubit_index, gate in enumerate(step):
            if isinstance(gate, str):
                if gate in ["H", "X", "Y", "Z", "Z^½", "Z^¼"]:
                    if not controlled:
                        code += f"            {self.map_qsharp_gate(gate)}(qs[{qubit_index}]);\n"
                    else:
                        code += self.controlled_qsharp_gate(gate.lower(), qubit_index)
                elif gate == "Swap":
                    code += f"            SWAP(qs[{self.control_qubits[0]}], qs[{qubit_index}]);\n"
            elif gate == 1:
                continue

        return code

    def controlled_qsharp_gate(self, gate, target_qubit):
        """Genera el código para una puerta controlada en Q#."""
        if len(self.control_qubits) == 1:
            control = self.control_qubits[0]
            return f"            Controlled {self.map_qsharp_gate(gate)}([qs[{control}]], qs[{target_qubit}]);\n"
        elif len(self.control_qubits) == 2:
            control1, control2 = self.control_qubits
            return f"            Controlled {self.map_qsharp_gate(gate)}([qs[{control1}], qs[{control2}]], qs[{target_qubit}]);\n"
        return ""

    def map_qsharp_gate(self, gate):
        """Mapea las puertas al formato Q#."""
        gate_mapping = {
            "H": "H",
            "X": "X",
            "Y": "Y",
            "Z": "Z",
            "Z^½": "S",
            "Z^¼": "T",
        }
        return gate_mapping.get(gate, "X")

    def parse_json(self, json_string):
        """Parsea una cadena JSON y genera código Q#."""
        json_data = json.loads(json_string)
        return self.generate_qsharp_code("QuantumProgram", json_data)