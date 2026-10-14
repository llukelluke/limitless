package com.example.limitless.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "accounts")
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(unique = true, length = 255, nullable = false)
    private String name;

    @Column(unique = true, nullable = false)
    private Integer number;

    @Column(length = 255)
    private String description;

    @Enumerated(EnumType.STRING)
    private normalSide side;

    @Column(length = 255)
    private String category;

    @Column(length = 255)
    private String subcategory;

    @Column(name = "initial_balance", precision = 15, scale = 2)
    private BigDecimal initialBalance;

    @Column(precision = 15, scale = 2)
    private BigDecimal debit;

    @Column(precision = 15, scale = 2)
    private BigDecimal credit;

    @Column(precision = 15, scale = 2)
    private BigDecimal balance;

    @Column(name = "added_at")
    private LocalDate addedAt;

    @Column(name = "account_order")
    private Integer accountOrder;

    @Enumerated(EnumType.STRING)
    private accountStatement statement;

    @Column(length = 255)
    private String comment;

    @Column(name = "is_active")
    private Boolean isActive = true;

    public enum normalSide {LEFT, RIGHT}

    public enum accountStatement {INCOME_STATEMENT, BALANCE_SHEET, RETAINED_EARNINGS, TRIAL_BALANCE}
}
