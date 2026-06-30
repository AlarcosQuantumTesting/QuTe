package edu.uclm.qute.service;

import edu.uclm.qute.runner.RemoteCodeRunner;
import edu.uclm.qute.runner.QuantumRunnerResult;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class CircuitService {

    @Value("${proxy.url}")
    private String proxyUrl;

    @Value("${remote.runner.url}")
    private String remoteRunnerUrl;

    private static String sanitizeCircuitCode(String circuitCode) {
        return circuitCode
                .replace(", assemble", "")
                .replace("assemble, ", "");
    }

    public Map<String, Object> validate(String circuitCode) {
        StringBuilder sb = new StringBuilder();
        sb.append(sanitizeCircuitCode(circuitCode)).append("\n\n");
        sb.append("""
import json
import traceback
from qiskit import QuantumCircuit
try:
    CuT = create_cut_circuit()
    qubits = len(list(q for qr in CuT.qregs for q in qr)) if hasattr(CuT, 'qregs') else 0
    print(json.dumps({
        "status": "success",
        "valid": True,
        "qubits": qubits
    }))
except Exception as e:
    print(json.dumps({
        "status": "success",
        "valid": False,
        "error": str(e)
    }))
""");

        QuantumRunnerResult result = RemoteCodeRunner.execute(
                sb.toString(),
                proxyUrl,
                remoteRunnerUrl
        );

        if (result.getExitCode() != 0) {
            return Map.of("valid", false, "error", "Python execution error: " + result.getStderr());
        }

        JSONObject json = new JSONObject(result.getStdout());
        return json.toMap();
    }

    public Map<String, Object> draw(String circuitCode) {
        StringBuilder sb = new StringBuilder();
        sb.append(sanitizeCircuitCode(circuitCode)).append("\n\n");
        sb.append("""
import json
import base64
import io
import traceback
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from qiskit import QuantumCircuit

try:
    CuT = create_cut_circuit()
    fig = CuT.draw(output='mpl')
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    img = base64.b64encode(buf.read()).decode('utf-8')
    print(json.dumps({
        "status": "success",
        "imageBase64": img
    }))
except Exception as e:
    print(json.dumps({
        "status": "error",
        "error": str(e),
        "traceback": traceback.format_exc()
    }))
""");

        QuantumRunnerResult result = RemoteCodeRunner.execute(
                sb.toString(),
                proxyUrl,
                remoteRunnerUrl
        );

        if (result.getExitCode() != 0) {
            throw new RuntimeException("Python execution failed: " + result.getStderr());
        }

        JSONObject json = new JSONObject(result.getStdout());
        if ("error".equals(json.optString("status"))) {
            throw new RuntimeException("Python execution error: " + json.optString("error") + "\\n" + json.optString("traceback"));
        }

        return json.toMap();
    }
}
