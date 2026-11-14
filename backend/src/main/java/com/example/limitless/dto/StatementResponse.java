package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Any of the four statements. "from" is null when the statement runs from the beginning of the books.
 * "balanced" is true when the statement's own check holds (debits = credits, or assets = liabilities + equity);
 * it is always true for the income statement and retained earnings statement.
 */
public record StatementResponse(
        @JsonProperty("type") String type,
        @JsonProperty("title") String title,
        @JsonProperty("from") LocalDate from,
        @JsonProperty("to") LocalDate to,
        @JsonProperty("sections") List<StatementSection> sections,
        @JsonProperty("totals") Map<String, BigDecimal> totals,
        @JsonProperty("balanced") boolean balanced,
        @JsonProperty("generated_at") LocalDateTime generatedAt) {}
