package com.example.limitless.controller;

import com.example.limitless.dto.EmailSendRequest;
import com.example.limitless.dto.RecipientResponse;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.UserRepository;
import com.example.limitless.service.MessagingService;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Email from the chart-of-accounts page. Separate from the admin-only /api/users/{id}/send-email. */
@RestController
@RequestMapping("/api/email")
public class EmailController {

    private final MessagingService messaging;
    private final UserRepository users;

    public EmailController(MessagingService messaging, UserRepository users) {
        this.messaging = messaging;
        this.users = users;
    }

    /** Who the logged-in user is allowed to email (fills the "To" dropdown). */
    @GetMapping("/recipients")
    public List<RecipientResponse> recipients(Authentication auth) {
        return messaging.recipients(sender(auth));
    }

    @PostMapping
    public Map<String, String> send(@RequestBody EmailSendRequest req, Authentication auth) {
        messaging.send(sender(auth), req);
        return Map.of("message", "Email sent.");
    }

    private User sender(Authentication auth) {
        return users.findByUsername(auth.getName())
                .orElseThrow(() -> new UserException(HttpStatus.UNAUTHORIZED, "Logged-in user not found."));
    }
}
