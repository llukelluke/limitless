package com.example.limitless.controller;

import com.example.limitless.dto.LedgerResponse;
import com.example.limitless.service.LedgerService;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/accounts")
public class LedgerController {

    private final LedgerService ledgerService;

    public LedgerController(LedgerService ledgerService) {
        this.ledgerService = ledgerService;
    }

    /** All roles can read (covered by the GET /api/accounts/** rule). */
    @GetMapping("/{id}/ledger")
    public LedgerResponse ledger(@PathVariable Integer id,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                 @RequestParam(required = false) String search) {
        return ledgerService.ledger(id, from, to, search);
    }
}
