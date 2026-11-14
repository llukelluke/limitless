package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

/**
 * One line of a statement. account_id / account_number let the frontend link to the ledger; they are null for
 * computed lines such as "Net income". Trial balance rows use debit/credit; every other statement uses amount.
 */
public record StatementRow(
        @JsonProperty("account_id") Integer accountId,
        @JsonProperty("account_number") String accountNumber,
        @JsonProperty("name") String name,
        @JsonProperty("subcategory") String subcategory,
        @JsonProperty("debit") BigDecimal debit,
        @JsonProperty("credit") BigDecimal credit,
        @JsonProperty("amount") BigDecimal amount) {}
