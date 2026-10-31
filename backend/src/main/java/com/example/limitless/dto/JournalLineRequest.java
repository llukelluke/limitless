package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

public record JournalLineRequest(
        @JsonProperty("account_id") Integer accountId,
        @JsonProperty("side") String side,
        @JsonProperty("amount") BigDecimal amount) {}
