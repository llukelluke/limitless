package com.example.limitless.service;

import com.example.limitless.dto.LedgerResponse;
import com.example.limitless.dto.LedgerRow;
import com.example.limitless.entity.Account;
import com.example.limitless.entity.JournalEntry;
import com.example.limitless.entity.JournalEntryLine;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.AccountRepository;
import com.example.limitless.repository.JournalEntryLineRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Builds an account's ledger from its approved journal-entry lines, with a running balance. */
@Service
public class LedgerService {

    private final AccountRepository accounts;
    private final JournalEntryLineRepository lines;
    private final ErrorMessageService msgs;

    public LedgerService(AccountRepository accounts, JournalEntryLineRepository lines, ErrorMessageService msgs) {
        this.accounts = accounts;
        this.lines = lines;
        this.msgs = msgs;
    }

    /**
     * The balance is always computed over the whole history so it stays correct when a date filter
     * hides earlier rows. opening_balance is the balance just before the first visible row.
     * search matches an amount, a description, or a post reference (journal entry id).
     */
    @Transactional(readOnly = true)
    public LedgerResponse ledger(Integer accountId, LocalDate from, LocalDate to, String search) {
        Account account = accounts.findById(accountId)
                .orElseThrow(() -> new UserException(HttpStatus.NOT_FOUND, msgs.get("ACC_001")));

        BigDecimal running = account.getInitialBalance() == null ? BigDecimal.ZERO.setScale(2) : account.getInitialBalance();
        BigDecimal opening = running;
        boolean leftNormal = account.getSide() == Account.Side.LEFT;

        BigDecimal searchAmount = parseAmount(search);
        String needle = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);

        List<LedgerRow> rows = new ArrayList<>();
        for (JournalEntryLine l : lines.findPostedLines(accountId, JournalEntry.JournalStatus.APPROVED)) {
            boolean debit = l.getSide() == JournalEntryLine.Side.DEBIT;
            boolean increases = leftNormal == debit;
            running = increases ? running.add(l.getAmount()) : running.subtract(l.getAmount());

            LocalDate date = l.getEntry().getEntryDate();
            if (from != null && date != null && date.isBefore(from)) {
                opening = running; // rows before the range still move the opening balance
                continue;
            }
            if (to != null && date != null && date.isAfter(to)) continue;

            if (!needle.isEmpty()) {
                String desc = l.getEntry().getDescription() == null ? "" : l.getEntry().getDescription().toLowerCase(Locale.ROOT);
                boolean match = desc.contains(needle)
                        || String.valueOf(l.getEntry().getId()).equals(needle)
                        || (searchAmount != null && l.getAmount().compareTo(searchAmount) == 0);
                if (!match) continue;
            }
            rows.add(new LedgerRow(date, l.getEntry().getDescription(), l.getEntry().getId(),
                    debit ? l.getAmount() : null, debit ? null : l.getAmount(), running));
        }

        BigDecimal ending = rows.isEmpty() ? opening : rows.get(rows.size() - 1).balance();
        return new LedgerResponse(account.getId(), account.getName(), String.valueOf(account.getNumber()),
                account.getSide() == null ? null : account.getSide().name(), account.getInitialBalance(),
                opening, rows, ending);
    }

    private static BigDecimal parseAmount(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return new BigDecimal(s.replace(",", "").replace("$", "").trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
