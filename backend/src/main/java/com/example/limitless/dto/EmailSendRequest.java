package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record EmailSendRequest(
        @JsonProperty("recipient_user_id") Integer recipientUserId,
        @JsonProperty("subject") String subject,
        @JsonProperty("body") String body) {}
