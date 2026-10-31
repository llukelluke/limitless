package com.example.limitless.repository;

import com.example.limitless.entity.JournalEntry;
import com.example.limitless.entity.JournalEntryLine;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JournalEntryLineRepository extends JpaRepository<JournalEntryLine, Integer> {

    /** Every posted line for one account, oldest first. This is the ledger. */
    @Query("select l from JournalEntryLine l join fetch l.entry e "
            + "where l.account.id = :accountId and e.status = :status "
            + "order by e.entryDate asc, e.id asc, l.id asc")
    List<JournalEntryLine> findPostedLines(@Param("accountId") Integer accountId,
                                           @Param("status") JournalEntry.JournalStatus status);
}
