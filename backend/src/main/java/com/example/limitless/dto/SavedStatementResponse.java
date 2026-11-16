package com.example.limitless.dto;

import com.example.limitless.entity.SavedStatement;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record SavedStatementResponse(
        @JsonProperty("id") Integer id,
        @JsonProperty("statement_type") String statementType,
        @JsonProperty("period_start") LocalDate periodStart,
        @JsonProperty("period_end") LocalDate periodEnd,
        @JsonProperty("generated_by") Integer generatedBy,
        @JsonProperty("generated_by_name") String generatedByName,
        @JsonProperty("generated_at") LocalDateTime generatedAt) {

    public static SavedStatementResponse from(SavedStatement s) {
        String first = s.getGeneratedBy().getFirstName() == null ? "" : s.getGeneratedBy().getFirstName();
        String last = s.getGeneratedBy().getLastName() == null ? "" : s.getGeneratedBy().getLastName();
        return new SavedStatementResponse(s.getId(), s.getStatementType().name(), s.getPeriodStart(),
                s.getPeriodEnd(), s.getGeneratedBy().getId(), (first + " " + last).trim(), s.getGeneratedAt());
    }
}
