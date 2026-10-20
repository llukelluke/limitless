package com.example.limitless.repository;

import com.example.limitless.entity.EventLog;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventLogRepository extends JpaRepository<EventLog, Integer> {

    List<EventLog> findAllByOrderByChangedAtDescIdDesc();

    List<EventLog> findByTableNameAndRecordIdOrderByChangedAtDescIdDesc(String tableName, Integer recordId);
}
