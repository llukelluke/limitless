package com.example.limitless.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "journal_entry_lines")
public class JournalEntryLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "journal_entry_id", nullable = false)
    private JournalEntry entry;

    @ManyToOne
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Enumerated(EnumType.STRING)
    private Side side;

    @Column(precision = 15, scale = 2)
    private BigDecimal amount;

    public JournalEntryLine(JournalEntry journalEntryID, Account account, Side side, BigDecimal amount){
        this.entry = journalEntryID;
        this.account = account;
        this.side = side;
        this.amount = amount;
    }

    public enum Side{DEBIT, CREDIT}
}
