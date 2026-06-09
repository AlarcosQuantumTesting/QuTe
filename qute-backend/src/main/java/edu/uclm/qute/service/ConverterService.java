package edu.uclm.qute.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ConverterService {

    private List<Integer> controlQubits = new ArrayList<>();
    private List<Boolean> controlValues = new ArrayList<>();
    private String circuitName = "";

    public String convert(String quirkJson, String language) {
        JSONObject jsonData = new JSONObject(quirkJson);
        if ("qiskit".equalsIgnoreCase(language)) {
            return generateAlgorithmQiskit("qc", jsonData);
        } else if ("qsharp".equalsIgnoreCase(language)) {
            return generateQsharpCode("QuantumProgram", jsonData);
        } else {
            throw new IllegalArgumentException("Language not supported: " + language);
        }
    }

    private String generateAlgorithmQiskit(String name, JSONObject jsonData) {
        this.circuitName = name;
        JSONArray steps = jsonData.optJSONArray("cols");
        if (steps == null) {
            steps = new JSONArray();
        }

        StringBuilder code = new StringBuilder();
        code.append("import matplotlib.pyplot as plt\n")
            .append("import numpy as np\n")
            .append("from qiskit import QuantumCircuit, transpile, assemble, QuantumRegister, ClassicalRegister\n")
            .append("from qiskit_aer import AerSimulator\n")
            .append("from math import gcd\n")
            .append("from numpy.random import randint\n")
            .append("import pandas as pd\n")
            .append("import importlib.util\n")
            .append("from fractions import Fraction\n\n")
            .append("def create_cut_circuit():\n")
            .append("    qc = QuantumCircuit()\n");

        int numQubits = 0;
        for (int i = 0; i < steps.length(); i++) {
            JSONArray step = steps.optJSONArray(i);
            if (step != null) {
                numQubits = Math.max(numQubits, step.length());
            }
        }

        code.append(String.format("    qreg = QuantumRegister(%d, 'q')\n", numQubits));
        code.append("    qc.add_register(qreg)\n");

        for (int i = 0; i < steps.length(); i++) {
            JSONArray step = steps.optJSONArray(i);
            if (step != null) {
                code.append(generateStepCode(step));
            }
        }

        code.append(String.format("    return %s\n", this.circuitName));
        return code.toString();
    }

    private String generateStepCode(JSONArray step) {
        this.controlQubits.clear();
        this.controlValues.clear();
        StringBuilder code = new StringBuilder();
        boolean controlled = checkForControls(step);

        for (int qubitIndex = 0; qubitIndex < step.length(); qubitIndex++) {
            Object gateObj = step.get(qubitIndex);
            if (gateObj instanceof String gate) {
                if (List.of("H", "X", "Y", "Z", "Z^½", "Z^¼").contains(gate)) {
                    if (!controlled) {
                        code.append(String.format("    %s.%s(qreg[%d])\n", this.circuitName, mapGate(gate), qubitIndex));
                    } else {
                        code.append(controlledUnitaryGate(gate.toLowerCase(), qubitIndex));
                    }
                } else if ("Swap".equals(gate)) {
                    // Implement SWAP mapping if required, or skip as in Python code
                }
            }
        }
        return code.toString();
    }

    private boolean checkForControls(JSONArray step) {
        for (int qubitIndex = 0; qubitIndex < step.length(); qubitIndex++) {
            Object gateObj = step.get(qubitIndex);
            if (gateObj instanceof String gate) {
                if ("•".equals(gate)) {
                    this.controlQubits.add(qubitIndex);
                    this.controlValues.add(true);
                } else if ("◦".equals(gate)) {
                    this.controlQubits.add(qubitIndex);
                    this.controlValues.add(false);
                }
            }
        }
        return !this.controlQubits.isEmpty();
    }

    private String controlledUnitaryGate(String gate, int targetQubit) {
        if (this.controlQubits.size() == 1) {
            int control = this.controlQubits.get(0);
            return String.format("    %s.c%s(%d, %d)\n", this.circuitName, gate, control, targetQubit);
        } else if (this.controlQubits.size() == 2) {
            int control1 = this.controlQubits.get(0);
            int control2 = this.controlQubits.get(1);
            return String.format("    %s.cc%s(%d, %d, %d)\n", this.circuitName, gate, control1, control2, targetQubit);
        }
        return "";
    }

    private String mapGate(String gate) {
        Map<String, String> gateMapping = new HashMap<>();
        gateMapping.put("H", "h");
        gateMapping.put("X", "x");
        gateMapping.put("Y", "y");
        gateMapping.put("Z", "z");
        gateMapping.put("Z^½", "s");
        gateMapping.put("Z^¼", "t");
        return gateMapping.getOrDefault(gate, "x");
    }

    private String generateQsharpCode(String name, JSONObject jsonData) {
        this.circuitName = name;
        JSONArray steps = jsonData.optJSONArray("cols");
        if (steps == null) {
            steps = new JSONArray();
        }

        int size = 0;
        if (steps.length() > 0 && steps.optJSONArray(0) != null) {
            size = steps.optJSONArray(0).length();
        }

        StringBuilder code = new StringBuilder();
        code.append("namespace QuantumCircuits {\n")
            .append("    open Microsoft.Quantum.Intrinsic;\n")
            .append("    open Microsoft.Quantum.Canon;\n")
            .append(String.format("    operation %s() : Unit {\n", this.circuitName))
            .append(String.format("        using (qs = Qubit[%d]) {\n", size));

        for (int i = 0; i < steps.length(); i++) {
            JSONArray step = steps.optJSONArray(i);
            if (step != null) {
                code.append(generateQsharpStepCode(step));
            }
        }

        code.append("        }\n    }\n}\n");
        return code.toString();
    }

    private String generateQsharpStepCode(JSONArray step) {
        this.controlQubits.clear();
        this.controlValues.clear();
        StringBuilder code = new StringBuilder();
        boolean controlled = checkForControls(step);

        for (int qubitIndex = 0; qubitIndex < step.length(); qubitIndex++) {
            Object gateObj = step.get(qubitIndex);
            if (gateObj instanceof String gate) {
                if (List.of("H", "X", "Y", "Z", "Z^½", "Z^¼").contains(gate)) {
                    if (!controlled) {
                        code.append(String.format("            %s(qs[%d]);\n", mapQsharpGate(gate), qubitIndex));
                    } else {
                        code.append(controlledQsharpGate(gate.toLowerCase(), qubitIndex));
                    }
                } else if ("Swap".equals(gate)) {
                    if (!this.controlQubits.isEmpty()) {
                        code.append(String.format("            SWAP(qs[%d], qs[%d]);\n", this.controlQubits.get(0), qubitIndex));
                    }
                }
            }
        }
        return code.toString();
    }

    private String controlledQsharpGate(String gate, int targetQubit) {
        if (this.controlQubits.size() == 1) {
            int control = this.controlQubits.get(0);
            return String.format("            Controlled %s([qs[%d]], qs[%d]);\n", mapQsharpGate(gate.toUpperCase()), control, targetQubit);
        } else if (this.controlQubits.size() == 2) {
            int control1 = this.controlQubits.get(0);
            int control2 = this.controlQubits.get(1);
            return String.format("            Controlled %s([qs[%d], qs[%d]], qs[%d]);\n", mapQsharpGate(gate.toUpperCase()), control1, control2, targetQubit);
        }
        return "";
    }

    private String mapQsharpGate(String gate) {
        Map<String, String> gateMapping = new HashMap<>();
        gateMapping.put("H", "H");
        gateMapping.put("X", "X");
        gateMapping.put("Y", "Y");
        gateMapping.put("Z", "Z");
        gateMapping.put("Z^½", "S");
        gateMapping.put("Z^¼", "T");
        return gateMapping.getOrDefault(gate, "X");
    }
}
