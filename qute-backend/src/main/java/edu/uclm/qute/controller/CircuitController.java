package edu.uclm.qute.controller;

import edu.uclm.qute.service.CircuitService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/circuit")
public class CircuitController {

    @Autowired
    private CircuitService circuitService;

    @PostMapping("/validate")
    public ResponseEntity<?> validate(@RequestBody Map<String, String> request) {
        try {
            String code = request.get("code");
            Map<String, Object> result = circuitService.validate(code);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/draw")
    public ResponseEntity<?> draw(@RequestBody Map<String, String> request) {
        try {
            String code = request.get("code");
            Map<String, Object> result = circuitService.draw(code);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
