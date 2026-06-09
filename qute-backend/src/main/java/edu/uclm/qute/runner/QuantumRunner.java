package edu.uclm.qute.runner;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class QuantumRunner {

    public static QuantumRunnerResult execute(String scriptContent, String pythonExecutable, String pythonPath, String workingDirectory) {
        File tempFile = null;
        try {
            // Ensure working directory exists
            File workDir = new File(workingDirectory);
            if (!workDir.exists()) {
                workDir.mkdirs();
            }

            // Write temporary python script
            tempFile = File.createTempFile("qute_run_", ".py", workDir);
            try (FileWriter writer = new FileWriter(tempFile)) {
                writer.write(scriptContent);
            }

            // Build Process
            ProcessBuilder pb = new ProcessBuilder();
            Map<String, String> env = pb.environment();
            if (pythonPath != null && !pythonPath.isEmpty()) {
                env.put("PATH", pythonPath + File.pathSeparator + env.getOrDefault("PATH", ""));
            }

            pb.directory(workDir);
            
            List<String> commands = new ArrayList<>();
            commands.add(pythonExecutable);
            commands.add(tempFile.getAbsolutePath());
            pb.command(commands);

            Process process = pb.start();

            // Read output
            StringBuilder stdout = new StringBuilder();
            StringBuilder stderr = new StringBuilder();

            try (BufferedReader outReader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                 BufferedReader errReader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                
                String line;
                while ((line = outReader.readLine()) != null) {
                    stdout.append(line).append("\n");
                }
                while ((line = errReader.readLine()) != null) {
                    stderr.append(line).append("\n");
                }
            }

            int exitCode = process.waitFor();
            return new QuantumRunnerResult(exitCode, stdout.toString(), stderr.toString());

        } catch (Exception e) {
            return new QuantumRunnerResult(-1, "", e.getMessage());
        } finally {
            if (tempFile != null && tempFile.exists()) {
                try {
                    Files.delete(tempFile.toPath());
                } catch (Exception ignored) {}
            }
        }
    }
}
