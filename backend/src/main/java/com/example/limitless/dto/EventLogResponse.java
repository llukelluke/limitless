package com.example.limitless.dto;

import com.example.limitless.entity.EventLog;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

// Images are the JSON snapshots written by EventLogService; the client parses them.
public record EventLogResponse(
        Integer id,
        @JsonProperty("table_name") String tableName,
        @JsonProperty("record_id") Integer recordId,
        String action,
        @JsonProperty("user_id") Integer userId,
        String username,
        @JsonProperty("changed_at") LocalDateTime changedAt,
        @JsonProperty("before_image") String beforeImage,
        @JsonProperty("after_image") String afterImage) {

    public static EventLogResponse from(EventLog e) {
        return new EventLogResponse(
                e.getId(), e.getTableName(), e.getRecordId(),
                e.getAction() == null ? null : e.getAction().name(),
                e.getUser().getId(), e.getUser().getUsername(), e.getChangedAt(),
                e.getBefore_image(), e.getAfter_image());
    }
}
