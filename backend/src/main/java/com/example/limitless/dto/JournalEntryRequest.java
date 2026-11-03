package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.util.List;

public record JournalEntryRequest(
        @JsonProperty("entry_date") @JsonFormat(pattern = "yyyy-MM-dd") LocalDate entryDate,
        @JsonProperty("entry_type") String entryType,
        @JsonProperty("description") String description,
        @JsonProperty("lines") List<JournalLineRequest> lines) {}
