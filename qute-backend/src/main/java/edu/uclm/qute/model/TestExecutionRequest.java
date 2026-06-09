package edu.uclm.qute.model;

import java.util.List;

public class TestExecutionRequest {
    private String circuitCode;
    private List<Integer> inputs;
    private List<Integer> outputs;
    private String testSuite; // JSON representation of test suite
    private int shots = 1024;
    private Double errorRange;
    private List<String> initValues;

    // Getters and Setters
    public String getCircuitCode() {
        return circuitCode;
    }

    public void setCircuitCode(String circuitCode) {
        this.circuitCode = circuitCode;
    }

    public List<Integer> getInputs() {
        return inputs;
    }

    public void setInputs(List<Integer> inputs) {
        this.inputs = inputs;
    }

    public List<Integer> getOutputs() {
        return outputs;
    }

    public void setOutputs(List<Integer> outputs) {
        this.outputs = outputs;
    }

    public String getTestSuite() {
        return testSuite;
    }

    public void setTestSuite(String testSuite) {
        this.testSuite = testSuite;
    }

    public int getShots() {
        return shots;
    }

    public void setShots(int shots) {
        this.shots = shots;
    }

    public Double getErrorRange() {
        return errorRange;
    }

    public void setErrorRange(Double errorRange) {
        this.errorRange = errorRange;
    }

    public List<String> getInitValues() {
        return initValues;
    }

    public void setInitValues(List<String> initValues) {
        this.initValues = initValues;
    }
}
