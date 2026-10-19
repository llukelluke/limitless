package com.example.limitless.controller;

import com.example.limitless.dto.AccountRequest;
import com.example.limitless.dto.AccountResponse;
import com.example.limitless.dto.EventLogResponse;
import com.example.limitless.service.AccountService;
import com.example.limitless.service.EventLogService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

// Every role can read; SecurityConfig limits add/edit/deactivate to administrators.
@RestController
@RequestMapping("/api")
public class AccountController {

    private final AccountService accountService;
    private final EventLogService eventLogService;

    public AccountController(AccountService accountService, EventLogService eventLogService) {
        this.accountService = accountService;
        this.eventLogService = eventLogService;
    }

    @GetMapping("/accounts")
    public List<AccountResponse> getAll() {
        return accountService.getAllAccounts().stream().map(AccountResponse::from).toList();
    }

    @GetMapping("/accounts/{id}")
    public AccountResponse getOne(@PathVariable Integer id) {
        return AccountResponse.from(accountService.getAccountById(id));
    }

    @PostMapping("/accounts")
    public ResponseEntity<AccountResponse> create(@RequestBody AccountRequest req, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(AccountResponse.from(accountService.createAccount(req, auth.getName())));
    }

    @PutMapping("/accounts/{id}")
    public AccountResponse update(@PathVariable Integer id, @RequestBody AccountRequest req, Authentication auth) {
        return AccountResponse.from(accountService.updateAccount(id, req, auth.getName()));
    }

    @PutMapping("/accounts/{id}/deactivate")
    public AccountResponse deactivate(@PathVariable Integer id, Authentication auth) {
        return AccountResponse.from(accountService.deactivateAccount(id, auth.getName()));
    }

    // Optional ?table=accounts&record_id=5 narrows the log to one record.
    @GetMapping("/event-logs")
    public List<EventLogResponse> eventLogs(@RequestParam(required = false) String table,
                                            @RequestParam(name = "record_id", required = false) Integer recordId) {
        return eventLogService.list(table, recordId).stream().map(EventLogResponse::from).toList();
    }
}
