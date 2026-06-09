package edu.uclm.qute.controller;

import edu.uclm.qute.model.TestExecutionRequest;
import edu.uclm.qute.service.TestExecutionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/tests")
public class TestExecutionController {

    @Autowired
    private TestExecutionService executionService;

    @PostMapping("/run-deterministic")
    public ResponseEntity<?> runDeterministic(@RequestBody TestExecutionRequest request) {
        try {
            Map<String, Object> result = executionService.runDeterministic(request);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/run-stochastic")
    public ResponseEntity<?> runStochastic(@RequestBody TestExecutionRequest request) {
        try {
            Map<String, Object> result = executionService.runStochastic(request);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
