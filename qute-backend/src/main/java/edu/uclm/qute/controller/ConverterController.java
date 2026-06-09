package edu.uclm.qute.controller;

import edu.uclm.qute.model.ConvertRequest;
import edu.uclm.qute.service.ConverterService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/converter")
public class ConverterController {

    @Autowired
    private ConverterService converterService;

    @PostMapping("/convert")
    public ResponseEntity<?> convert(@RequestBody ConvertRequest request) {
        try {
            String code = converterService.convert(request.getQuirkJson(), request.getLanguage());
            return ResponseEntity.ok(Map.of("code", code));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
