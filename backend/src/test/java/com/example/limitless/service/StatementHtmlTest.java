package com.example.limitless.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.limitless.dto.StatementResponse;
import com.example.limitless.dto.StatementRow;
import com.example.limitless.dto.StatementSection;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Sprint 4: printed and saved statements link each account to its ledger; emailed ones do not. */
class StatementHtmlTest {

    private static final StatementResponse INCOME = new StatementResponse("income-statement", "Income Statement",
            LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30),
            List.of(new StatementSection("Revenue", List.of(
                    new StatementRow(7, "4001", "Service Revenue", "Revenue", null, null, new BigDecimal("800.00"))),
                    new BigDecimal("800.00"))),
            Map.of("net_income", new BigDecimal("800.00")), true, LocalDateTime.now());

    @Test
    @DisplayName("Printed / saved statement: account links to /accounts/{id}/ledger")
    void printedHasLedgerLinks() {
        assertThat(StatementHtml.render(INCOME, "Limitless"))
                .contains("<a href=\"/accounts/7/ledger\">4001 &middot; Service Revenue</a>");
    }

    @Test
    @DisplayName("Emailed statement: no links (they would not resolve outside the app)")
    void emailHasNoLinks() {
        String html = StatementHtml.renderForEmail(INCOME, "Limitless", "Note", "Morgan Lee");
        assertThat(html).contains("Service Revenue").doesNotContain("<a href");
    }

    @Test
    @DisplayName("Computed lines such as net income are never links")
    void computedLinesAreNotLinks() {
        assertThat(StatementHtml.render(INCOME, "Limitless")).doesNotContain("<a href=\"/accounts/null");
    }
}
