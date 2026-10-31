package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record RejectRequest(@JsonProperty("comment") String comment) {}
