package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

public record JournalLineResponse(
        @JsonProperty("id") Integer id,
        @JsonProperty("account_id") Integer accountId,
        @JsonProperty("account_name") String accountName,
        @JsonProperty("account_number") String accountNumber,
        @JsonProperty("side") String side,
        @JsonProperty("amount") BigDecimal amount) {}
