package com.example.limitless.repository;

import com.example.limitless.entity.JournalEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface JournalEntryRepository extends JpaRepository<JournalEntry, Integer>,
        JpaSpecificationExecutor<JournalEntry> {
    long countByStatus(JournalEntry.JournalStatus status);
}
