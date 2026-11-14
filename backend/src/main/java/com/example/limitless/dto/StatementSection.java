package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;

/** A titled group of rows (for example "Assets" or "Expenses") with its total. */
public record StatementSection(
        @JsonProperty("title") String title,
        @JsonProperty("rows") List<StatementRow> rows,
        @JsonProperty("total") BigDecimal total) {}
