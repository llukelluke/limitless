package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record RecipientResponse(
        @JsonProperty("id") Integer id,
        @JsonProperty("name") String name,
        @JsonProperty("role") String role) {}
