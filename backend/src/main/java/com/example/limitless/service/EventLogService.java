package com.example.limitless.service;

import com.example.limitless.entity.EventLog;
import com.example.limitless.entity.User;
import com.example.limitless.repository.EventLogRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

// Before/after images of every changed record, stored as JSON snapshots of the API response.
@Service
public class EventLogService {

    private final EventLogRepository eventLogRepository;
    private final ObjectMapper objectMapper;

    public EventLogService(EventLogRepository eventLogRepository, ObjectMapper objectMapper) {
        this.eventLogRepository = eventLogRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public EventLog record(String table, Integer recordId, EventLog.actionType action,
                           Object before, Object after, User user) {
        EventLog event = new EventLog();
        event.setTableName(table);
        event.setRecordId(recordId);
        event.setAction(action);
        event.setBefore_image(before == null ? null : objectMapper.writeValueAsString(before));
        event.setAfter_image(after == null ? null : objectMapper.writeValueAsString(after));
        event.setUser(user);
        event.setChangedAt(LocalDateTime.now());
        return eventLogRepository.save(event);
    }
    /** For callers that already have the before/after images as JSON text. */
    @Transactional
    public EventLog recordJson(String table, Integer recordId, EventLog.actionType action,
                               String beforeJson, String afterJson, User user) {
        EventLog event = new EventLog();
        event.setTableName(table);
        event.setRecordId(recordId);
        event.setAction(action);
        event.setBefore_image(beforeJson);
        event.setAfter_image(afterJson);
        event.setUser(user);
        event.setChangedAt(LocalDateTime.now());
        return eventLogRepository.save(event);
    }
    @Transactional(readOnly = true)
    public List<EventLog> list(String table, Integer recordId) {
        if (table != null && recordId != null) {
            return eventLogRepository.findByTableNameAndRecordIdOrderByChangedAtDescIdDesc(table, recordId);
        }
        return eventLogRepository.findAllByOrderByChangedAtDescIdDesc();
    }
}
