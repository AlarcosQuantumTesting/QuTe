from qiskit import QuantumCircuit, transpile, QuantumRegister, ClassicalRegister
from qiskit_aer import Aer

from .Circuit import Circuit  # para usar _prepare_qubit


class CircuitDeterministic:
    @staticmethod
    def generateQTCC(CuT, CuT_output_indexes, input_values, result, input_indexes):
        QTCC = QuantumCircuit()

        # a) recolectar qubits del CuT
        CuT_registers = []
        for register in CuT.qregs:
            for qubit in register:
                CuT_registers.append(qubit)

        # b) registros auxiliares
        CuT_qr = QuantumRegister(len(CuT_registers), 'QTCC_input')
        expectedValue_qr = QuantumRegister(len(CuT_output_indexes), 'expected')
        valueCheck_qr = QuantumRegister(len(CuT_output_indexes), 'check')
        verdict_qr = QuantumRegister(1, 'q_verdict')
        verdict_bit = ClassicalRegister(1, 'c_verdict')

        QTCC.add_register(CuT_qr, expectedValue_qr, valueCheck_qr, verdict_qr, verdict_bit)

        # c) preparar entradas
        for j, idx in enumerate(input_indexes):
            try:
                spec = input_values[j]
            except Exception:
                spec = 0
            Circuit._prepare_qubit(QTCC, CuT_qr, idx, spec)

        # d) expected
        for i, value in enumerate(result):
            try:
                if int(value) == 1:
                    QTCC.x(expectedValue_qr[i])
            except Exception:
                pass

        QTCC.barrier(CuT_qr, expectedValue_qr, valueCheck_qr, verdict_qr)
        QTCC.append(CuT.to_instruction(), CuT_qr)
        QTCC.barrier(CuT_qr, expectedValue_qr, valueCheck_qr, verdict_qr)

        n_qubit = 0
        for index in CuT_output_indexes:
            QTCC.ccx(CuT_qr[index], expectedValue_qr[n_qubit], valueCheck_qr[n_qubit])
            QTCC.ccx(CuT_qr[index], expectedValue_qr[n_qubit], valueCheck_qr[n_qubit], ctrl_state='00')
            n_qubit += 1

        QTCC.barrier(CuT_qr, expectedValue_qr, valueCheck_qr, verdict_qr)
        QTCC.mcx(valueCheck_qr, verdict_qr)
        QTCC.measure(verdict_qr, verdict_bit)

        return QTCC
