package com.campus.tracking.controller;

import com.campus.tracking.security.AccessScope;
import com.campus.tracking.service.AssistantService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// The campus assistant. Any signed-in user; answers are limited to what their role may already see.
@RestController
@RequestMapping("/api/assistant")
public class AssistantController {

    @Data
    public static class AskRequest {
        @NotBlank(message = "Ask a question")
        @Size(max = 300, message = "Keep the question under 300 characters")
        private String message;
    }

    @Autowired
    private AssistantService assistant;

    @Autowired
    private AccessScope scope;

    @PostMapping
    public AssistantService.Reply ask(@Valid @RequestBody AskRequest request) {
        return assistant.answer(scope.caller(), request.getMessage());
    }
}
