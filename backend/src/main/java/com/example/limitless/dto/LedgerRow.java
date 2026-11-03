package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.LocalDate;

/** debit/credit are null for the empty cell. post_reference is the journal entry id (link target). */
public record LedgerRow(
        @JsonProperty("entry_date") LocalDate entryDate,
        @JsonProperty("description") String description,
        @JsonProperty("post_reference") Integer postReference,
        @JsonProperty("debit") BigDecimal debit,
        @JsonProperty("credit") BigDecimal credit,
        @JsonProperty("balance") BigDecimal balance) {}
