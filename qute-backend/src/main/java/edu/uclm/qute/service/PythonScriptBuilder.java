package edu.uclm.qute.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PythonScriptBuilder {

    public static String buildDeterministicScript(
            String circuitCode,
            List<Integer> inputs,
            List<Integer> outputs,
            String testSuiteJson,
            int shots,
            List<String> initValues) {

        StringBuilder sb = new StringBuilder();

        // Append user circuit code
        sb.append(circuitCode).append("\n\n");

        // Append helper functions and imports
        appendCommonLobe(sb);

        // Define parameters
        sb.append("inputs = ").append(inputs.toString()).append("\n");
        sb.append("outputs = ").append(outputs.toString()).append("\n");
        sb.append("shots = ").append(shots).append("\n");

        if (initValues != null) {
            sb.append("init_values = ").append(new JSONArray(initValues).toString()).append("\n");
        } else {
            sb.append("init_values = None\n");
        }

        sb.append("test_suite = ").append(testSuiteJson).append("\n");

        // Execution logic
        sb.append("""
                try:
                    CuT = create_cut_circuit()

                    # Render CuT
                    cut_img = circuit_to_base64(CuT)

                    # Build QTCC preview using init_values or first test case input
                    preview_init = init_values
                    if preview_init is None and len(test_suite) > 0:
                        preview_init = test_suite[0][0]

                    # Normalize preview_init (replace empty strings with None)
                    if isinstance(preview_init, list):
                        preview_init = [None if str(v).strip() == "" else v for v in preview_init]

                    expected_out = test_suite[0][1] if len(test_suite) > 0 else None

                    QTCC_preview = generateQTCC_deterministic(CuT, outputs, preview_init, expected_out, inputs)
                    qtcc_img = circuit_to_base64(QTCC_preview)

                    # Run tests
                    logs = []
                    simulator = Aer.get_backend('qasm_simulator')
                    for inp, expected in test_suite:
                        # Normalize input
                        norm_inp = [None if str(v).strip() == "" else v for v in inp]
                        QTCC = generateQTCC_deterministic(CuT, outputs, norm_inp, expected, inputs)
                        circ = transpile(QTCC, simulator)
                        result = simulator.run(circ, shots=shots, memory=True).result()
                        counts = result.get_counts()
                        verdict = '1' in counts.keys()
                        logs.append(f"Input: {inp} → Expected: {expected} → Verdict: {verdict}")

                    print(json.dumps({
                        "status": "success",
                        "cutImageBase64": cut_img,
                        "qtccImageBase64": qtcc_img,
                        "logs": logs
                    }))
                except Exception as e:
                    print(json.dumps({
                        "status": "error",
                        "error": str(e),
                        "traceback": traceback.format_exc()
                    }))
                """);

        return sb.toString();
    }

    public static String buildStochasticScript(
            String circuitCode,
            List<Integer> inputs,
            List<Integer> outputs,
            int shots,
            List<String> initValues) {

        StringBuilder sb = new StringBuilder();

        // Imports (following qumugen template pattern)
        sb.append("from qiskit import QuantumRegister, ClassicalRegister, QuantumCircuit, transpile\n");
        sb.append("from qiskit_aer import AerSimulator\n");
        sb.append("from math import pi\n");
        sb.append("import json\n\n");

        // User circuit code (defines create_cut_circuit())
        sb.append(circuitCode).append("\n\n");

        // Create the Circuit under Test
        sb.append("CuT = create_cut_circuit()\n");
        sb.append("n_qubits = len(list(q for qr in CuT.qregs for q in qr))\n\n");

        // Declaration (like qumugen #DECLARATION#)
        sb.append("qreg = QuantumRegister(n_qubits)\n");
        sb.append("creg = ClassicalRegister(").append(outputs.size()).append(")\n");
        sb.append("circuit = QuantumCircuit(qreg, creg)\n\n");

        // Initialization (like qumugen #INITIALIZATION#)
        sb.append("#Initialization\n");
        if (initValues != null) {
            for (int j = 0; j < inputs.size() && j < initValues.size(); j++) {
                String val = initValues.get(j);
                if (val != null && val.trim().equals("1")) {
                    sb.append("circuit.x(").append(inputs.get(j)).append(")\n");
                }
            }
        }
        sb.append("circuit.barrier()\n\n");

        // Append CuT as instruction (like qumugen #CALCULUS#)
        sb.append("circuit.append(CuT.to_instruction(), qreg)\n");
        sb.append("circuit.barrier()\n\n");

        // Measures (like qumugen #MEASURES#)
        sb.append("#Measures\n");
        for (int i = 0; i < outputs.size(); i++) {
            sb.append("circuit.measure(").append(outputs.get(i)).append(", ").append(i).append(")\n");
        }
        sb.append("\n");

        // Execution (like qumugen template)
        sb.append("simulator = AerSimulator()\n");
        sb.append("compiled_circuit = transpile(circuit, simulator)\n");
        sb.append("result = simulator.run(compiled_circuit, shots=").append(shots).append(").result()\n");
        sb.append("histogram = result.get_counts()\n");
        sb.append("print(histogram)\n");

        return sb.toString();
    }


    private static void appendCommonLobe(StringBuilder sb) {
        sb.append("""
                import sys
                import json
                import base64
                import io
                import traceback
                from qiskit import QuantumCircuit, transpile, QuantumRegister, ClassicalRegister
                from qiskit_aer import Aer
                import matplotlib
                matplotlib.use('Agg')
                import matplotlib.pyplot as plt

                def _prepare_qubit(circ: QuantumCircuit, qreg: QuantumRegister, idx: int, spec):
                    if spec is None:
                        return
                    if isinstance(spec, str):
                        s = spec.strip().lower()
                        if s in ("0", ""):
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
                        raise ValueError(f"State not supported: {spec} (use 0,1,h,y,z,s,t)")
                    try:
                        v = int(spec)
                        if v == 0:
                            return
                        if v == 1:
                            circ.x(qreg[idx]); return
                    except:
                        pass
                    raise ValueError(f"State not supported: {spec} (use 0,1,h,y,z,s,t)")

                def generateQTCC_deterministic(CuT, CuT_output_indexes, input_values, result, input_indexes):
                    QTCC = QuantumCircuit()
                    CuT_registers = []
                    for register in CuT.qregs:
                        for qubit in register:
                            CuT_registers.append(qubit)
                    CuT_qr = QuantumRegister(len(CuT_registers), 'QTCC_input')
                    expectedValue_qr = QuantumRegister(len(CuT_output_indexes), 'expected')
                    valueCheck_qr = QuantumRegister(len(CuT_output_indexes), 'check')
                    verdict_qr = QuantumRegister(1, 'q_verdict')
                    verdict_bit = ClassicalRegister(1, 'c_verdict')
                    QTCC.add_register(CuT_qr, expectedValue_qr, valueCheck_qr, verdict_qr, verdict_bit)
                    for j, idx in enumerate(input_indexes):
                        try:
                            spec = input_values[j]
                        except:
                            spec = 0
                        _prepare_qubit(QTCC, CuT_qr, idx, spec)
                    if result is not None:
                        for i, value in enumerate(result):
                            try:
                                if int(value) == 1:
                                    QTCC.x(expectedValue_qr[i])
                            except:
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

                def generateQTCC_stochastic(CuT, CuT_output_indexes, input_values, input_indexes):
                    CuT_qubits = list(q for qr in CuT.qregs for q in qr)
                    n_qubits = len(CuT_qubits)
                    QTCC = QuantumCircuit()
                    qreg = QuantumRegister(n_qubits, "QTCC_input")
                    creg = ClassicalRegister(len(CuT_output_indexes or []), "c_out")
                    QTCC.add_register(qreg, creg)
                    if input_indexes:
                        for j, idx in enumerate(input_indexes):
                            spec = 0
                            if input_values:
                                try:
                                    spec = input_values[j]
                                except:
                                    spec = 0
                            _prepare_qubit(QTCC, qreg, idx, spec)
                    QTCC.barrier(qreg)
                    QTCC.append(CuT.to_instruction(), qreg)
                    QTCC.barrier(qreg)
                    for i, q_idx in enumerate(CuT_output_indexes or []):
                        QTCC.measure(qreg[q_idx], creg[i])
                    return QTCC

                def circuit_to_base64(qc):
                    try:
                        fig = qc.draw(output='mpl')
                        buf = io.BytesIO()
                        fig.savefig(buf, format='png', bbox_inches='tight')
                        plt.close(fig)
                        buf.seek(0)
                        return base64.b64encode(buf.read()).decode('utf-8')
                    except Exception as e:
                        return "Error drawing: " + str(e)
                """);
    }
}
