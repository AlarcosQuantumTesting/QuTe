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

        // Execution logic: run each test case and collect verdicts
        sb.append("""
                try:
                    CuT = create_cut_circuit()
                    n_qubits = len(list(q for qr in CuT.qregs for q in qr))

                    # Run tests
                    verdicts = []
                    simulator = AerSimulator()
                    for inp, expected in test_suite:
                        # Normalize input
                        norm_inp = [None if str(v).strip() == "" else v for v in inp]
                        
                        # 1. Run quantum check assertion circuit to verify verdict
                        QTCC = generateQTCC_deterministic(CuT, outputs, norm_inp, expected, inputs)
                        circ = transpile(QTCC, simulator)
                        result = simulator.run(circ, shots=shots).result()
                        counts = result.get_counts()
                        verdict = '1' in counts.keys()
                        
                        # 2. Run standard circuit to get the actual measured output bits
                        qr_cut = QuantumRegister(n_qubits)
                        cr_out = ClassicalRegister(len(outputs))
                        actual_circ = QuantumCircuit(qr_cut, cr_out)
                        for j, idx in enumerate(inputs):
                            try:
                                spec = norm_inp[j]
                            except:
                                spec = 0
                            _prepare_qubit(actual_circ, qr_cut, idx, spec)
                        
                        actual_circ.append(CuT.to_instruction(), qr_cut)
                        for i, out_idx in enumerate(outputs):
                            actual_circ.measure(qr_cut[out_idx], cr_out[i])
                            
                        actual_circ_transpiled = transpile(actual_circ, simulator)
                        actual_result = simulator.run(actual_circ_transpiled, shots=shots).result()
                        actual_counts = actual_result.get_counts()
                        
                        # Find the most frequent outcome key (e.g. "01")
                        most_frequent_key = max(actual_counts, key=actual_counts.get)
                        # Qiskit key is in reversed bit order, e.g. "01" means bit 0 is 1 and bit 1 is 0
                        actual_bits = [int(char) for char in reversed(most_frequent_key)]

                        verdicts.append({
                            "input": inp,
                            "expected": expected,
                            "actual": actual_bits,
                            "verdict": verdict
                        })

                    print(json.dumps({
                        "status": "success",
                        "verdicts": verdicts
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
                import json
                import traceback
                from qiskit import QuantumCircuit, transpile, QuantumRegister, ClassicalRegister
                from qiskit_aer import AerSimulator

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
                """);
    }
}
