package com.example.limitless.service;

import com.example.limitless.dto.StatementResponse;
import com.example.limitless.dto.StatementRow;
import com.example.limitless.dto.StatementSection;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/**
 * Turns a statement into one self-contained, printable HTML page (no external files).
 * The same markup is used for the print view, the saved file, and the email body.
 */
final class StatementHtml {

    private StatementHtml() {}

    private static final String CSS = """
            body{font-family:Georgia,'Times New Roman',serif;color:#111;margin:0;padding:24px;background:#fff}
            .sheet{max-width:760px;margin:0 auto}
            h1,h2,h3{text-align:center;margin:2px 0}
            h1{font-size:20px} h2{font-size:17px;font-weight:normal} h3{font-size:14px;font-weight:normal;color:#444;margin-bottom:18px}
            table{width:100%;border-collapse:collapse;font-size:14px}
            th{text-align:right;border-bottom:2px solid #111;padding:6px 8px;font-size:13px}
            th.name{text-align:left}
            td{padding:4px 8px;vertical-align:top}
            td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
            tr.section td{font-weight:bold;padding-top:14px;border-bottom:1px solid #999}
            tr.sub td{font-style:italic;padding-top:8px}
            tr.indent td.name{padding-left:28px}
            tr.total td{font-weight:bold;border-top:1px solid #111}
            tr.grand td{font-weight:bold;border-top:1px solid #111;border-bottom:3px double #111}
            .flag{margin-top:16px;padding:8px 12px;border:1px solid #b00020;color:#b00020;font-size:13px}
            .note{margin:0 0 18px 0;white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px}
            .foot{margin-top:24px;text-align:center;color:#666;font-size:12px}
            @media print{body{padding:0}.flag{border-color:#000;color:#000}}
            """;

    static String render(StatementResponse r, String company) {
        return page(r, company, null, null);
    }

    static String renderForEmail(StatementResponse r, String company, String note, String sender) {
        return page(r, company, note, sender);
    }

    private static String page(StatementResponse r, String company, String note, String sender) {
        boolean tb = r.type().equals("trial-balance");
        boolean bs = r.type().equals("balance-sheet");
        StringBuilder sb = new StringBuilder(4096);
        sb.append("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">")
                .append("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">")
                .append("<title>").append(esc(company)).append(" - ").append(esc(r.title())).append("</title>")
                .append("<style>").append(CSS).append("</style></head><body><div class=\"sheet\">");
        if (note != null && !note.isBlank()) {
            sb.append("<p class=\"note\">").append(esc(note)).append("</p>");
        }
        sb.append("<h1>").append(esc(company)).append("</h1><h2>").append(esc(r.title())).append("</h2><h3>")
                .append(esc(periodText(r))).append("</h3>");
        sb.append("<table><thead><tr><th class=\"name\">Account</th>");
        if (tb) sb.append("<th>Debit</th><th>Credit</th>"); else sb.append("<th>Amount</th>");
        sb.append("</tr></thead><tbody>");

        for (StatementSection sec : r.sections()) {
            boolean single = r.sections().size() == 1;
            if (!single) {
                sb.append("<tr class=\"section\"><td colspan=\"").append(tb ? 3 : 2).append("\">")
                        .append(esc(sec.title())).append("</td></tr>");
            }
            String lastSub = null;
            for (StatementRow row : sec.rows()) {
                if (bs && row.subcategory() != null && !row.subcategory().equals(lastSub)) {
                    // a subheading that only repeats the section title adds nothing
                    if (!row.subcategory().equalsIgnoreCase(sec.title())) {
                        sb.append("<tr class=\"sub\"><td colspan=\"2\">").append(esc(row.subcategory())).append("</td></tr>");
                    }
                    lastSub = row.subcategory();
                }
                boolean last = row == sec.rows().get(sec.rows().size() - 1);
                boolean computed = row.accountId() == null && r.type().equals("retained-earnings");
                sb.append("<tr class=\"").append(bs ? "indent" : "")
                        .append(computed && last ? " grand" : "").append("\"><td class=\"name\">");
                if (row.accountNumber() != null) sb.append(esc(row.accountNumber())).append(" &middot; ");
                sb.append(esc(row.name())).append("</td>");
                if (tb) {
                    sb.append("<td class=\"num\">").append(money(row.debit())).append("</td>")
                            .append("<td class=\"num\">").append(money(row.credit())).append("</td>");
                } else {
                    sb.append("<td class=\"num\">").append(money(row.amount())).append("</td>");
                }
                sb.append("</tr>");
            }
            if (sec.total() != null && !r.type().equals("retained-earnings")) {
                sb.append("<tr class=\"total\"><td class=\"name\">Total ").append(esc(sec.title())).append("</td>")
                        .append("<td class=\"num\">").append(money(sec.total())).append("</td></tr>");
            }
        }
        if (tb) {
            sb.append("<tr class=\"grand\"><td class=\"name\">Totals</td><td class=\"num\">")
                    .append(money(r.totals().get("total_debits"))).append("</td><td class=\"num\">")
                    .append(money(r.totals().get("total_credits"))).append("</td></tr>");
        } else if (r.type().equals("income-statement")) {
            sb.append("<tr class=\"grand\"><td class=\"name\">Net income (loss)</td><td class=\"num\">")
                    .append(money(r.totals().get("net_income"))).append("</td></tr>");
        } else if (bs) {
            sb.append("<tr class=\"grand\"><td class=\"name\">Total liabilities &amp; stockholders' equity</td>")
                    .append("<td class=\"num\">").append(money(r.totals().get("total_liabilities_and_equity")))
                    .append("</td></tr>");
        }
        sb.append("</tbody></table>");

        if (!r.balanced()) {
            sb.append("<div class=\"flag\">").append(tb ? "Out of balance: total debits do not equal total credits."
                    : "Out of balance: total assets do not equal total liabilities and equity.").append("</div>");
        }
        sb.append("<div class=\"foot\">Generated ").append(esc(r.generatedAt().toString().replace('T', ' ')
                .substring(0, 16)));
        if (sender != null && !sender.isBlank()) sb.append(" by ").append(esc(sender));
        sb.append("</div></div></body></html>");
        return sb.toString();
    }

    private static String periodText(StatementResponse r) {
        boolean asOf = r.type().equals("trial-balance") || r.type().equals("balance-sheet");
        if (asOf) return "As of " + r.to();
        return r.from() == null ? "Through " + r.to() : "For the period " + r.from() + " to " + r.to();
    }

    /** 1,234.50 and (1,234.50) for negatives; empty for null. */
    static String money(BigDecimal v) {
        if (v == null) return "";
        DecimalFormat f = new DecimalFormat("#,##0.00", DecimalFormatSymbols.getInstance(Locale.US));
        String s = f.format(v.abs());
        return v.signum() < 0 ? "(" + s + ")" : s;
    }

    private static String esc(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(s.length() + 8);
        for (char c : s.toCharArray()) {
            switch (c) {
                case '&' -> sb.append("&amp;");
                case '<' -> sb.append("&lt;");
                case '>' -> sb.append("&gt;");
                case '"' -> sb.append("&quot;");
                case '\'' -> sb.append("&#39;");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }
}
