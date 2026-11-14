package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Body for POST /api/statements/{type}/email. subject and message are optional. */
public record StatementEmailRequest(
        @JsonProperty("recipient_user_id") Integer recipientUserId,
        @JsonProperty("subject") String subject,
        @JsonProperty("message") String message) {}
