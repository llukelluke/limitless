package com.example.limitless.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.limitless.TestUsers;
import com.example.limitless.entity.EventLog;
import com.example.limitless.entity.User;
import com.example.limitless.repository.EventLogRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

/** Sprint 2: every change stores the user, time, and before/after images of the record. */
@ExtendWith(MockitoExtension.class)
class EventLogServiceTest {

    @Mock
    EventLogRepository eventLogRepository;

    EventLogService eventLogService;
    User admin;

    @BeforeEach
    void setUp() {
        eventLogService = new EventLogService(eventLogRepository, JsonMapper.builder().build());
        admin = TestUsers.active(1, "sadmin1026", "Admin123!");
        lenient().when(eventLogRepository.save(any(EventLog.class))).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    @DisplayName("TC-LOG-01 (P): a modification stores user, time and JSON before/after images")
    void recordsImages() {
        EventLog event = eventLogService.record("accounts", 5, EventLog.actionType.MODIFY,
                Map.of("name", "Cash"), Map.of("name", "Petty Cash"), admin);

        assertThat(event.getTableName()).isEqualTo("accounts");
        assertThat(event.getRecordId()).isEqualTo(5);
        assertThat(event.getUser()).isSameAs(admin);
        assertThat(event.getChangedAt()).isNotNull();
        assertThat(event.getBefore_image()).isEqualTo("{\"name\":\"Cash\"}");
        assertThat(event.getAfter_image()).isEqualTo("{\"name\":\"Petty Cash\"}");
        verify(eventLogRepository).save(event);
    }

    @Test
    @DisplayName("TC-LOG-01 (P): an addition has no before image")
    void addHasNoBefore() {
        EventLog event = eventLogService.record("accounts", 6, EventLog.actionType.ADD, null, Map.of("name", "Cash"), admin);
        assertThat(event.getBefore_image()).isNull();
        assertThat(event.getAfter_image()).contains("Cash");
    }

    @Test
    @DisplayName("TC-LOG-02 (P): the log can be narrowed to one record")
    void listForRecord() {
        when(eventLogRepository.findByTableNameAndRecordIdOrderByChangedAtDescIdDesc("accounts", 5)).thenReturn(List.of());
        assertThat(eventLogService.list("accounts", 5)).isEmpty();
        verify(eventLogRepository).findByTableNameAndRecordIdOrderByChangedAtDescIdDesc("accounts", 5);
    }
}
