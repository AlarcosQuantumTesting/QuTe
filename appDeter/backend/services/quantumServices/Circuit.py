import importlib.util
import json
import os
import traceback

from qiskit import QuantumCircuit, transpile, QuantumRegister, ClassicalRegister
from qiskit_aer import Aer

from .CircuitLoadError import CircuitLoadError


class Circuit:  
     
    @staticmethod
    def executeQTCC(circuit, shots):
        simulator = Aer.get_backend('qasm_simulator')
        circuit = transpile(circuit, simulator)
        result = simulator.run(circuit, shots=shots, memory=True).result()
        counts = result.get_counts()
        verdict = '1' in counts.keys()
        return verdict

    @staticmethod
    def create_cut_circuit(file_path):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"The file {file_path} does not exist.")

        module_name = "cut_module"
        spec = importlib.util.spec_from_file_location(module_name, file_path)
        if spec is None:
            raise CircuitLoadError(f"It cannot create spec for {file_path}", filename=file_path)

        module = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(module)
        except SyntaxError as e:
            raise CircuitLoadError(
                f"SyntaxError: {e.msg}",
                filename=e.filename, lineno=e.lineno, colno=e.offset,
                code_line=e.text, tb=traceback.format_exc()
            )
        except Exception as e:
            raise CircuitLoadError(
                f"{e.__class__.__name__}: {e}",
                filename=file_path, tb=traceback.format_exc()
            )

        if not hasattr(module, 'create_cut_circuit'):
            raise CircuitLoadError("Function create_cut_circuit() missing", filename=file_path)

        try:
            cut_circuit = module.create_cut_circuit()
        except Exception as e:
            raise CircuitLoadError(
                f"Error en create_cut_circuit(): {e}",
                filename=file_path, tb=traceback.format_exc()
            )

        if not isinstance(cut_circuit, QuantumCircuit):
            raise CircuitLoadError("create_cut_circuit() no devolvió un QuantumCircuit", filename=file_path)

        return cut_circuit

    @staticmethod
    def run_counts(circuit: QuantumCircuit, shots: int) -> dict[str, int]:
        simulator = Aer.get_backend('qasm_simulator')
        circ = transpile(circuit, simulator)
        job = simulator.run(circ, shots=shots, memory=False)
        result = job.result()
        return result.get_counts()

    @staticmethod
    def getInfo(test_file_path):
        with open(test_file_path, 'r') as file:
            data = json.load(file)
            output_indexes = data.get("output_indexes")
            test_suite = data.get("test_suite")
            shots = data.get("shots", 1024)
            return output_indexes, test_suite, shots
        
    @staticmethod
    def _prepare_qubit(circ: QuantumCircuit, qreg: QuantumRegister, idx: int, spec):
        """
        Permite preparar únicamente: 0, 1, h, y, z, s, t (el resto no las entiendo).
        - 0 / "0": |0> (no-op)
        - 1 / "1": X -> |1>
        - "h": H -> |+>
        - "y": Y
        - "z": Z
        - "s": S
        - "t": T
        """
        # normaliza
        if spec is None:
            return
        if isinstance(spec, str):
            s = spec.strip().lower()
            if s in ("0",):
                return
            if s in ("1",):
                circ.x(qreg[idx]); return
            if s == "h":
                circ.h(qreg[idx]); return
            if s == "y":
                circ.y(qreg[idx]); return
            if s == "z":
                circ.z(qreg[idx]); return
            if s == "s":
                circ.s(qreg[idx]); return
            if s == "t":
                circ.t(qreg[idx]); return
            raise ValueError(f"State not suported: {spec!r} (use 0,1,h,y,z,s,t)")

        # ints sencillos
        try:
            v = int(spec)
            if v == 0:
                return
            if v == 1:
                circ.x(qreg[idx]); return
        except Exception:
            pass

        raise ValueError(f"State not suported: {spec!r} (use 0,1,h,y,z,s,t)")