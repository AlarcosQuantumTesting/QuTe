package edu.uclm.qute.service;

import edu.uclm.qute.model.TestExecutionRequest;
import edu.uclm.qute.runner.QuantumRunner;
import edu.uclm.qute.runner.QuantumRunnerResult;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class TestExecutionService {

    @Value("${python.executable}")
    private String pythonExecutable;

    @Value("${python.path}")
    private String pythonPath;

    @Value("${python.working.directory}")
    private String workingDirectory;

    public Map<String, Object> runDeterministic(TestExecutionRequest request) {
        String script = PythonScriptBuilder.buildDeterministicScript(
                request.getCircuitCode(),
                request.getInputs(),
                request.getOutputs(),
                request.getTestSuite(),
                request.getShots(),
                request.getInitValues()
        );

        QuantumRunnerResult result = QuantumRunner.execute(
                script,
                pythonExecutable,
                pythonPath,
                workingDirectory
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
        String script = PythonScriptBuilder.buildStochasticScript(
                request.getCircuitCode(),
                request.getInputs(),
                request.getOutputs(),
                request.getTestSuite(),
                request.getShots(),
                request.getErrorRange(),
                request.getInitValues()
        );

        QuantumRunnerResult result = QuantumRunner.execute(
                script,
                pythonExecutable,
                pythonPath,
                workingDirectory
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
