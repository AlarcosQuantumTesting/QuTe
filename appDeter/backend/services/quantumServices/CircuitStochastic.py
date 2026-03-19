from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister

from .Circuit import Circuit  # para _prepare_qubit


class CircuitStochastic:
    @staticmethod
    def generateQTCC_stochastic(CuT, CuT_output_indexes, input_values=None, input_indexes=None, expected_out=None):
        CuT_qubits = list(q for qr in CuT.qregs for q in qr)
        n_qubits = len(CuT_qubits)

        if any(idx < 0 or idx >= n_qubits for idx in (CuT_output_indexes or [])):
            raise ValueError("Índices de salida fuera de rango.")
        if input_indexes and input_values and len(input_indexes) != len(input_values):
            raise ValueError("input_indexes y input_values deben tener la misma longitud.")

        QTCC = QuantumCircuit()
        qreg = QuantumRegister(n_qubits, "QTCC_input")
        creg = ClassicalRegister(len(CuT_output_indexes or []), "c_out")
        QTCC.add_register(qreg, creg)

        if input_indexes:
            for j, idx in enumerate(input_indexes):
                if idx < 0 or idx >= n_qubits:
                    raise ValueError(f"Index incorrect: {idx}")
                spec = 0
                if input_values:
                    try:
                        spec = input_values[j]
                    except Exception:
                        spec = 0
                Circuit._prepare_qubit(QTCC, qreg, idx, spec)

        QTCC.barrier(qreg)
        QTCC.append(CuT.to_instruction(), qreg)
        QTCC.barrier(qreg)

        for i, q_idx in enumerate(CuT_output_indexes or []):
            QTCC.measure(qreg[q_idx], creg[i])

        return QTCC
