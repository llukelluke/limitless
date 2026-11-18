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
     * Closing entries are left out: statements show the pre-closing view, otherwise a period with a closing
     * entry would report zero net income. (Balance sheet totals are the same either way.)
     * Each row is {Integer accountId, JournalEntryLine.Side side, BigDecimal total}.
     */
    @Query("select l.account.id, l.side, sum(l.amount) from JournalEntryLine l "
            + "where l.entry.status = :status and l.entry.entryDate >= :from and l.entry.entryDate <= :to "
            + "and (l.entry.entryType is null "
            + "or l.entry.entryType <> com.example.limitless.entity.JournalEntry.JournalEntryType.CLOSING) "
            + "group by l.account.id, l.side")
    List<Object[]> totals(@Param("from") LocalDate from,
                          @Param("to") LocalDate to,
                          @Param("status") JournalEntry.JournalStatus status);
}
