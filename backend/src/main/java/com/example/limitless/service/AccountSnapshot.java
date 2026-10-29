package com.example.limitless.service;

import com.example.limitless.entity.Account;

final class AccountSnapshot {
    private AccountSnapshot() {}

    static String of(Account a) {
        return "{"
                + "\"id\":" + a.getId()
                + ",\"user_id\":" + a.getUser()
                + ",\"name\":" + JsonUtil.q(a.getName())
                + ",\"account_number\":" + a.getNumber()
                + ",\"description\":" + JsonUtil.q(a.getDescription())
                + ",\"normal_side\":" + JsonUtil.q(a.getSide() == null ? null : a.getSide().name())
                + ",\"category\":" + JsonUtil.q(a.getCategory())
                + ",\"subcategory\":" + JsonUtil.q(a.getSubcategory())
                + ",\"initial_balance\":" + a.getInitialBalance()
                + ",\"debit\":" + a.getDebit()
                + ",\"credit\":" + a.getCredit()
                + ",\"balance\":" + a.getBalance()
                + ",\"added_at\":" + JsonUtil.q(a.getAddedAt() == null ? null : a.getAddedAt().toString())
                + ",\"account_order\":" + a.getAccountOrder()
                + ",\"statement\":" + JsonUtil.q(a.getStatement() == null ? null : a.getStatement().toString())
                + ",\"comment\":" + JsonUtil.q(a.getComment())
                + ",\"active\":" + a.getIsActive()
                + "}";
    }
}
