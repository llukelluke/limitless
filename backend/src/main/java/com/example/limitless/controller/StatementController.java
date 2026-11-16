package com.example.limitless.controller;

import com.example.limitless.dto.SavedStatementResponse;
import com.example.limitless.dto.StatementEmailRequest;
import com.example.limitless.dto.StatementResponse;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.UserRepository;
import com.example.limitless.service.StatementService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Financial statements (manager only, enforced in SecurityConfig).
 *   {type} = trial-balance | income-statement | balance-sheet | retained-earnings
 *   Dates: date=2026-04-30  (up to and including that day)   or   from=2026-04-01&to=2026-04-30
 */
@RestController
@RequestMapping("/api/statements")
public class StatementController {

    private final StatementService service;
    private final UserRepository users;

    public StatementController(StatementService service, UserRepository users) {
        this.service = service;
        this.users = users;
    }

    /** View: the statement as JSON for the frontend to render. */
    @GetMapping("/{type}")
    public StatementResponse generate(@PathVariable String type,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.generate(type, date, from, to);
    }

    /** Print: a clean, self-contained HTML page. Open it in a new tab and use the browser's print dialog. */
    @GetMapping(path = "/{type}/html", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> html(@PathVariable String type,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(service.html(type, date, from, to));
    }

    /** Save: stores the statement as it is right now and records who saved it. */
    @PostMapping("/{type}/save")
    public ResponseEntity<SavedStatementResponse> save(@PathVariable String type,
                                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                       Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(SavedStatementResponse.from(service.save(type, date, from, to, actor(auth))));
    }

    /** Email: sends the statement to another active user. */
    @PostMapping("/{type}/email")
    public Map<String, String> email(@PathVariable String type,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                     @RequestBody StatementEmailRequest req,
                                     Authentication auth) {
        service.sendByEmail(type, date, from, to, req, actor(auth));
        return Map.of("message", "Email sent.");
    }

    /** Saved statements, newest first. */
    @GetMapping("/saved")
    public List<SavedStatementResponse> saved() {
        return service.listSaved().stream().map(SavedStatementResponse::from).toList();
    }

    /** Open a saved statement (HTML). */
    @GetMapping(path = "/saved/{id}/html", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> savedHtml(@PathVariable Integer id) {
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(service.savedHtml(id));
    }

    private User actor(Authentication auth) {
        return users.findByUsername(auth.getName())
                .orElseThrow(() -> new UserException(HttpStatus.UNAUTHORIZED, "Logged-in user not found."));
    }
}
