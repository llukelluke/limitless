package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record JournalEntryResponse(
        @JsonProperty("id") Integer id,
        @JsonProperty("entry_date") LocalDate entryDate,
        @JsonProperty("entry_type") String entryType,
        @JsonProperty("status") String status,
        @JsonProperty("description") String description,
        @JsonProperty("comment") String comment,
        @JsonProperty("created_by") Integer createdBy,
        @JsonProperty("created_by_name") String createdByName,
        @JsonProperty("reviewed_by") Integer reviewedBy,
        @JsonProperty("reviewed_by_name") String reviewedByName,
        @JsonProperty("reviewed_at") LocalDateTime reviewedAt,
        @JsonProperty("created_at") LocalDateTime createdAt,
        @JsonProperty("total_debits") BigDecimal totalDebits,
        @JsonProperty("total_credits") BigDecimal totalCredits,
        @JsonProperty("lines") List<JournalLineResponse> lines,
        @JsonProperty("attachments") List<AttachmentResponse> attachments) {}
