package com.example.limitless.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

public record AttachmentResponse(
        @JsonProperty("id") Integer id,
        @JsonProperty("original_name") String originalName,
        @JsonProperty("file_type") String fileType,
        @JsonProperty("uplaoded_at") LocalDateTime uploadedAt) {}
