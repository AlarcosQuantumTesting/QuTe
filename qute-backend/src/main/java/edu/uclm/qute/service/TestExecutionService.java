package edu.uclm.qute.service;

import edu.uclm.qute.model.TestExecutionRequest;
import edu.uclm.qute.runner.RemoteCodeRunner;
import edu.uclm.qute.runner.QuantumRunnerResult;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TestExecutionService {

    @Value("${proxy.url}")
    private String proxyUrl;

    @Value("${remote.runner.url}")
    private String remoteRunnerUrl;

    public Map<String, Object> runDeterministic(TestExecutionRequest request) {
        String script = PythonScriptBuilder.buildDeterministicScript(
                request.getCircuitCode(),
                request.getInputs(),
                request.getOutputs(),
                request.getTestSuite(),
                request.getShots(),
                request.getInitValues()
        );

        QuantumRunnerResult result = RemoteCodeRunner.execute(
                script,
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

    public Map<String, Object> runStochastic(TestExecutionRequest request) {
        // 1. Build flat Qiskit script (circuit + inputs + measures + execution)
        String script = PythonScriptBuilder.buildStochasticScript(
                request.getCircuitCode(),
                request.getInputs(),
                request.getOutputs(),
                request.getShots(),
                request.getInitValues()
        );

        // 2. Execute remotely
        QuantumRunnerResult result = RemoteCodeRunner.execute(
                script,
                proxyUrl,
                remoteRunnerUrl
        );

        if (result.getExitCode() != 0) {
            throw new RuntimeException("Python execution failed: " + result.getStderr());
        }

        // 3. Parse stdout as raw counts JSON (e.g. {'01': 512, '10': 512})
        //    The Python print() outputs a dict repr, need to handle both Python and JSON formats
        String stdout = result.getStdout().trim();
        // Python dicts use single quotes; replace with double quotes for JSON parsing
        stdout = stdout.replace("'", "\"");
        JSONObject countsJson = new JSONObject(stdout);
        Map<String, Object> counts = countsJson.toMap();

        // 4. Compare execution results with test cases in Java
        return compareStochasticResults(
                counts,
                request.getTestSuite(),
                request.getShots(),
                request.getErrorRange()
        );
    }

    /**
     * Compares the raw execution counts from the quantum circuit against the test suite.
     * Counts come directly from the circuit execution stdout (no wrapper JSON).
     * 
     * @param counts        Raw counts from circuit execution (e.g. {"01": 512, "10": 512})
     * @param testSuiteJson JSON string: [[expected_output_bits, expected_probability], ...]
     * @param shots         Number of shots used in the simulation
     * @param errorRange    Tolerance for probability comparison (nullable)
     * @return Complete result map in the format expected by the frontend
     */
    private Map<String, Object> compareStochasticResults(
            Map<String, Object> counts,
            String testSuiteJson,
            int shots,
            Double errorRange) {

        if (counts == null) {
            counts = new LinkedHashMap<>();
        }

        JSONArray testSuite = new JSONArray(testSuiteJson);
        List<Map<String, Object>> percentages = new ArrayList<>();

        for (int i = 0; i < testSuite.length(); i++) {
            JSONArray testCase = testSuite.getJSONArray(i);
            JSONArray expectedOut = testCase.getJSONArray(0);

            // Parse expected probability
            Double expectedPercent = parseExpectedPercent(testCase);

            // Convert expected output bits to counts key (Qiskit uses reversed bit order)
            String key = bitsToKey(expectedOut);

            // Look up hits in counts
            int nHits = 0;
            if (counts.containsKey(key)) {
                nHits = ((Number) counts.get(key)).intValue();
            }
            double percent = Math.round((nHits / (double) shots) * 100.0 * 100.0) / 100.0;

            // Determine verdict
            boolean ok;
            if (expectedPercent != null && errorRange != null) {
                ok = percent >= (expectedPercent - errorRange);
            } else if (expectedPercent != null) {
                ok = percent >= expectedPercent;
            } else {
                ok = percent >= 50.0;
            }

            // Build result entry matching frontend format
            Map<String, Object> entry = new LinkedHashMap<>();
            List<Integer> outputList = new ArrayList<>();
            for (int j = 0; j < expectedOut.length(); j++) {
                outputList.add(expectedOut.getInt(j));
            }
            entry.put("output", outputList);
            entry.put("counts", nHits);
            entry.put("percent", percent);
            entry.put("expected_percent", expectedPercent);
            entry.put("tolerance", errorRange);
            entry.put("ok", ok);

            percentages.add(entry);
        }

        // Build final result (no circuit images in stochastic flow)
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "success");
        result.put("percentages", percentages);

        return result;
    }

    /**
     * Converts expected output bits to a Qiskit counts key (reversed bit order).
     * e.g. [1, 0] → "01"
     */
    private String bitsToKey(JSONArray bits) {
        StringBuilder sb = new StringBuilder();
        for (int i = bits.length() - 1; i >= 0; i--) {
            sb.append(bits.getInt(i));
        }
        return sb.toString();
    }

    /**
     * Parses the expected probability from a test case.
     * Handles both direct numbers and single-element arrays.
     * Normalizes 0.0-1.0 range to percentage.
     */
    private Double parseExpectedPercent(JSONArray testCase) {
        if (testCase.length() < 2 || testCase.isNull(1)) {
            return null;
        }

        Object probObj = testCase.get(1);

        // Handle array wrapping: [[output], [prob]] → unwrap [prob]
        if (probObj instanceof JSONArray probArray) {
            if (probArray.length() == 0) return null;
            probObj = probArray.get(0);
        }

        try {
            double value = Double.parseDouble(probObj.toString());
            if (value >= 0.0 && value <= 1.0) {
                return Math.round(value * 100.0 * 100.0) / 100.0;
            } else {
                return Math.round(value * 100.0) / 100.0;
            }
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
