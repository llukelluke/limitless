package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

// Number and money arrive as text so "1.5", "12a" or "1,000.555" can be rejected instead of silently coerced.
public record AccountRequest(
        String name,
        String number,
        String description,
        @JsonProperty("normal_side") String normalSide,
        String category,
        String subcategory,
        @JsonProperty("initial_balance") String initialBalance,
        String order,
        String statement,
        String comment) {
}
