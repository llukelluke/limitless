package com.example.limitless.dto;

import com.example.limitless.entity.Account;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AccountResponse(
        Integer id,
        String name,
        Integer number,
        String description,
        @JsonProperty("normal_side") String normalSide,
        String category,
        String subcategory,
        @JsonProperty("initial_balance") BigDecimal initialBalance,
        BigDecimal debit,
        BigDecimal credit,
        BigDecimal balance,
        @JsonProperty("added_at") LocalDateTime addedAt,
        @JsonProperty("user_id") Integer userId,
        @JsonProperty("added_by") String addedBy,
        Integer order,
        String statement,
        String comment,
        boolean active) {

    public static AccountResponse from(Account a) {
        return new AccountResponse(
                a.getId(), a.getName(), a.getNumber(), a.getDescription(),
                a.getSide() == null ? null : a.getSide().name(),
                a.getCategory(), a.getSubcategory(),
                a.getInitialBalance(), a.getDebit(), a.getCredit(), a.getBalance(),
                a.getAddedAt(),
                a.getUser() == null ? null : a.getUser().getId(),
                a.getUser() == null ? null : a.getUser().getUsername(),
                a.getAccountOrder(),
                a.getStatement() == null ? null : a.getStatement().name(),
                a.getComment(),
                !Boolean.FALSE.equals(a.getIsActive()));
    }
}
