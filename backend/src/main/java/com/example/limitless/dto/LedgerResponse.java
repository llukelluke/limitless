package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;

public record LedgerResponse(
        @JsonProperty("account_id") Integer accountId,
        @JsonProperty("account_name") String accountName,
        @JsonProperty("account_number") String accountNumber,
        @JsonProperty("normal_side") String normalSide,
        @JsonProperty("initial_balance") BigDecimal initialBalance,
        @JsonProperty("opening_balance") BigDecimal openingBalance,
        @JsonProperty("rows") List<LedgerRow> rows,
        @JsonProperty("ending_balance") BigDecimal endingBalance) {}
