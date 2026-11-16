package com.example.limitless.repository;

import com.example.limitless.entity.JournalEntry;
import com.example.limitless.entity.JournalEntryLine;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Read-only totals the financial statements are built from. */
public interface StatementQueryRepository extends Repository<JournalEntryLine, Integer> {

    /**
     * Debit and credit totals per account for entries with the given status dated from..to (inclusive).
     * Each row is {Integer accountId, JournalEntryLine.Side side, BigDecimal total}.
     */
    @Query("select l.account.id, l.side, sum(l.amount) from JournalEntryLine l "
            + "where l.entry.status = :status and l.entry.entryDate >= :from and l.entry.entryDate <= :to "
            + "group by l.account.id, l.side")
    List<Object[]> totals(@Param("from") LocalDate from,
                          @Param("to") LocalDate to,
                          @Param("status") JournalEntry.JournalStatus status);
}
