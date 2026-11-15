package com.example.limitless.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "saved_statements")
public class SavedStatements {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "generated_by", nullable = false)
    private User generatedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "statement_Type")
    private StatementType statementType;

    @Column(name = "period_start")
    private LocalDate periodStart;

    @Column(name = "period_end")
    private LocalDate periodEnd;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;

    @Column(name = "file_path", length = 255)
    private String filePath;

    public enum StatementType {TRIAL_BALANCE, INCOME_STATEMENT, BALANCE_SHEET, RETAINED_EARNINGS};
}
