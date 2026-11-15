package com.example.limitless.service;

import com.example.limitless.dto.StatementEmailRequest;
import com.example.limitless.dto.StatementResponse;
import com.example.limitless.dto.StatementRow;
import com.example.limitless.dto.StatementSection;
import com.example.limitless.entity.Account;
import com.example.limitless.entity.JournalEntry;
import com.example.limitless.entity.SavedStatement;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.AccountRepository;
import com.example.limitless.repository.SavedStatementRepository;
import com.example.limitless.repository.StatementQueryRepository;
import com.example.limitless.repository.UserRepository;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Builds the four financial statements straight from APPROVED journal entry lines, so an approved entry shows up
 * in the statements immediately, and any date or date range can be reported on.
 *
 * Dates: pass date=D (everything up to and including D, from the start of the books) or from=A&to=B.
 *   Trial balance and balance sheet are "as of" the end date.
 *   Income statement and retained earnings statement cover the period. With only date=D they cover everything up to D.
 * Revenue and expense accounts count by their journal activity in the period (their initial balance is included
 * only when the period starts at the beginning of the books).
 */
@Service
public class StatementService {

    private static final LocalDate MIN = LocalDate.of(1900, 1, 1);
    private static final LocalDate MAX = LocalDate.of(9999, 12, 31);
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2);

    public enum Type {
        TRIAL_BALANCE("trial-balance", "Trial Balance"),
        INCOME_STATEMENT("income-statement", "Income Statement"),
        BALANCE_SHEET("balance-sheet", "Balance Sheet"),
        RETAINED_EARNINGS("retained-earnings", "Statement of Retained Earnings");

        final String slug;
        final String title;

        Type(String slug, String title) {
            this.slug = slug;
            this.title = title;
        }

        public String slug() { return slug; }
    }

    private record Period(LocalDate start, LocalDate end) {}

    private final AccountRepository accounts;
    private final StatementQueryRepository lines;
    private final SavedStatementRepository saved;
    private final UserRepository users;
    private final EmailService email;
    private final ErrorMessageService msgs;
    private final String uploadsDir;
    private final String company;

    public StatementService(AccountRepository accounts, StatementQueryRepository lines,
                            SavedStatementRepository saved, UserRepository users, EmailService email,
                            ErrorMessageService msgs,
                            @Value("${uploads.dir:./uploads}") String uploadsDir,
                            @Value("${statements.company-name:Limitless}") String company) {
        this.accounts = accounts;
        this.lines = lines;
        this.saved = saved;
        this.users = users;
        this.email = email;
        this.msgs = msgs;
        this.uploadsDir = uploadsDir;
        this.company = company;
    }

    // =====================================================================
    // Generate
    // =====================================================================

    @Transactional(readOnly = true)
    public StatementResponse generate(String typeSlug, LocalDate date, LocalDate from, LocalDate to) {
        Type type = parseType(typeSlug);
        Period p = period(date, from, to);
        List<Account> all = sortedAccounts();
        return switch (type) {
            case TRIAL_BALANCE -> trialBalance(all, p);
            case INCOME_STATEMENT -> incomeStatement(all, p);
            case BALANCE_SHEET -> balanceSheet(all, p);
            case RETAINED_EARNINGS -> retainedEarnings(all, p);
        };
    }

    @Transactional(readOnly = true)
    public String html(String typeSlug, LocalDate date, LocalDate from, LocalDate to) {
        return StatementHtml.render(generate(typeSlug, date, from, to), company);
    }

    // ---------- Trial balance ----------

    private StatementResponse trialBalance(List<Account> all, Period p) {
        Map<Integer, BigDecimal[]> s = sums(MIN, p.end());
        List<StatementRow> rows = new ArrayList<>();
        BigDecimal debits = ZERO, credits = ZERO;
        for (Account a : all) {
            BigDecimal b = init(a).add(net(a, get(s, a)));
            if (b.signum() == 0) continue;
            // A normal balance goes in the account's own column; an abnormal one goes in the other.
            boolean debitColumn = left(a) == (b.signum() > 0);
            BigDecimal abs = b.abs();
            rows.add(row(a, debitColumn ? abs : null, debitColumn ? null : abs, null));
            if (debitColumn) debits = debits.add(abs); else credits = credits.add(abs);
        }
        Map<String, BigDecimal> totals = new LinkedHashMap<>();
        totals.put("total_debits", debits);
        totals.put("total_credits", credits);
        return response(Type.TRIAL_BALANCE, null, p.end(),
                List.of(new StatementSection("Accounts", rows, null)), totals, debits.compareTo(credits) == 0);
    }

    // ---------- Income statement ----------

    private StatementResponse incomeStatement(List<Account> all, Period p) {
        Map<Integer, BigDecimal[]> s = sums(p.start() == null ? MIN : p.start(), p.end());
        boolean withInitial = p.start() == null;
        List<StatementRow> revenues = new ArrayList<>(), expenses = new ArrayList<>();
        BigDecimal totalRev = ZERO, totalExp = ZERO;
        for (Account a : all) {
            boolean rev = category(a, "Revenue"), exp = category(a, "Expense");
            if (!rev && !exp) continue;
            BigDecimal amt = net(a, get(s, a)).add(withInitial ? init(a) : ZERO);
            if (amt.signum() == 0) continue;
            if (rev) { revenues.add(row(a, null, null, amt)); totalRev = totalRev.add(amt); }
            else { expenses.add(row(a, null, null, amt)); totalExp = totalExp.add(amt); }
        }
        BigDecimal ni = totalRev.subtract(totalExp);
        Map<String, BigDecimal> totals = new LinkedHashMap<>();
        totals.put("total_revenues", totalRev);
        totals.put("total_expenses", totalExp);
        totals.put("net_income", ni);
        return response(Type.INCOME_STATEMENT, p.start(), p.end(),
                List.of(new StatementSection("Revenues", revenues, totalRev),
                        new StatementSection("Expenses", expenses, totalExp)),
                totals, true);
    }

    // ---------- Retained earnings statement ----------

    private StatementResponse retainedEarnings(List<Account> all, Period p) {
        BigDecimal beginning;
        Map<Integer, BigDecimal[]> sp;
        BigDecimal ni;
        if (p.start() == null) {
            // From the beginning of the books: only the opening balances come before the period.
            beginning = ZERO;
            for (Account a : all) {
                if (isRetained(a)) beginning = beginning.add(init(a));
                else if (isDividend(a)) beginning = beginning.subtract(init(a));
            }
            sp = sums(MIN, p.end());
            ni = netIncome(all, sp, true);
        } else {
            LocalDate before = p.start().minusDays(1);
            beginning = retainedAt(all, sums(MIN, before));
            sp = sums(p.start(), p.end());
            ni = netIncome(all, sp, false);
        }
        BigDecimal dividends = ZERO, other = ZERO;
        for (Account a : all) {
            if (isDividend(a)) dividends = dividends.add(net(a, get(sp, a)));
            else if (isRetained(a)) other = other.add(net(a, get(sp, a)));
        }
        BigDecimal ending = beginning.add(ni).subtract(dividends).add(other);

        List<StatementRow> rows = new ArrayList<>();
        rows.add(line("Beginning retained earnings", beginning));
        rows.add(line("Add: Net income", ni));
        rows.add(line("Less: Dividends", dividends));
        if (other.signum() != 0) rows.add(line("Other changes to retained earnings", other));
        rows.add(line("Ending retained earnings", ending));
        Map<String, BigDecimal> totals = new LinkedHashMap<>();
        totals.put("beginning_retained_earnings", beginning);
        totals.put("net_income", ni);
        totals.put("dividends", dividends);
        totals.put("other_changes", other);
        totals.put("ending_retained_earnings", ending);
        return response(Type.RETAINED_EARNINGS, p.start(), p.end(),
                List.of(new StatementSection("Retained Earnings", rows, ending)), totals, true);
    }

    // ---------- Balance sheet ----------

    private StatementResponse balanceSheet(List<Account> all, Period p) {
        Map<Integer, BigDecimal[]> s = sums(MIN, p.end());
        List<StatementRow> assets = new ArrayList<>(), liabilities = new ArrayList<>(), equity = new ArrayList<>();
        BigDecimal totalA = ZERO, totalL = ZERO, totalE = ZERO;
        Account retainedAccount = null;
        int retainedCount = 0;
        for (Account a : all) {
            BigDecimal b = init(a).add(net(a, get(s, a)));
            if (isRetained(a)) { retainedAccount = a; retainedCount++; continue; }
            if (isDividend(a)) continue; // folded into retained earnings below
            if (b.signum() == 0) continue;
            if (category(a, "Asset")) {
                BigDecimal v = left(a) ? b : b.negate(); // contra assets (accumulated depreciation) come out negative
                assets.add(row(a, null, null, v)); totalA = totalA.add(v);
            } else if (category(a, "Liability")) {
                BigDecimal v = left(a) ? b.negate() : b;
                liabilities.add(row(a, null, null, v)); totalL = totalL.add(v);
            } else if (category(a, "Equity")) {
                BigDecimal v = left(a) ? b.negate() : b;
                equity.add(row(a, null, null, v)); totalE = totalE.add(v);
            }
        }
        // Retained earnings = its account balance + net income to date - dividends (nothing is closed out).
        BigDecimal retained = retainedAt(all, s).add(ZERO);
        Integer rid = retainedCount == 1 ? retainedAccount.getId() : null;
        String rnum = retainedCount == 1 && retainedAccount.getNumber() != null
                ? String.valueOf(retainedAccount.getNumber()) : null;
        // Group it with the other equity rows: use the retained earnings account's own subcategory if there is one.
        String rsub = retainedCount == 1 && retainedAccount.getSubcategory() != null
                ? retainedAccount.getSubcategory()
                : equity.isEmpty() ? "Stockholders' Equity" : equity.get(equity.size() - 1).subcategory();
        equity.add(new StatementRow(rid, rnum, "Retained Earnings", rsub, null, null, retained));
        totalE = totalE.add(retained);

        BigDecimal totalLE = totalL.add(totalE);
        Map<String, BigDecimal> totals = new LinkedHashMap<>();
        totals.put("total_assets", totalA);
        totals.put("total_liabilities", totalL);
        totals.put("total_equity", totalE);
        totals.put("total_liabilities_and_equity", totalLE);
        return response(Type.BALANCE_SHEET, null, p.end(),
                List.of(new StatementSection("Assets", assets, totalA),
                        new StatementSection("Liabilities", liabilities, totalL),
                        new StatementSection("Stockholders' Equity", equity, totalE)),
                totals, totalA.compareTo(totalLE) == 0);
    }

    // =====================================================================
    // Save, list, read, email
    // =====================================================================

    @Transactional
    public SavedStatement save(String typeSlug, LocalDate date, LocalDate from, LocalDate to, User by) {
        StatementResponse r = generate(typeSlug, date, from, to);
        String html = StatementHtml.render(r, company);
        LocalDateTime now = LocalDateTime.now();
        String fileName = r.type() + "-" + now.format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmssSSS")) + ".html";
        try {
            Path dir = statementsDir();
            Files.createDirectories(dir);
            Files.writeString(dir.resolve(fileName), html, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UserException(HttpStatus.INTERNAL_SERVER_ERROR, msgs.get("STM_006"));
        }
        SavedStatement s = new SavedStatement();
        s.setStatementType(SavedStatement.Kind.valueOf(parseType(typeSlug).name()));
        s.setPeriodStart(r.from());
        s.setPeriodEnd(r.to());
        s.setGeneratedBy(by);
        s.setGeneratedAt(now);
        s.setFilePath(fileName);
        return saved.save(s);
    }

    @Transactional(readOnly = true)
    public List<SavedStatement> listSaved() {
        return saved.findAllByOrderByGeneratedAtDesc();
    }

    @Transactional(readOnly = true)
    public String savedHtml(Integer id) {
        SavedStatement s = saved.findById(id)
                .orElseThrow(() -> new UserException(HttpStatus.NOT_FOUND, msgs.get("STM_005")));
        Path dir = statementsDir();
        Path file = dir.resolve(s.getFilePath() == null ? "" : s.getFilePath()).normalize();
        try {
            if (!file.startsWith(dir) || !Files.isRegularFile(file)) {
                throw new UserException(HttpStatus.NOT_FOUND, msgs.get("STM_006"));
            }
            return Files.readString(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UserException(HttpStatus.NOT_FOUND, msgs.get("STM_006"));
        }
    }

    public void sendByEmail(String typeSlug, LocalDate date, LocalDate from, LocalDate to,
                            StatementEmailRequest req, User sender) {
        if (req == null || req.recipientUserId() == null) {
            throw new UserException(HttpStatus.BAD_REQUEST, msgs.get("STM_004"));
        }
        User to_ = users.findById(req.recipientUserId())
                .filter(u -> u.getStatus() == User.UserStatus.ACTIVATED)
                .orElseThrow(() -> new UserException(HttpStatus.NOT_FOUND, msgs.get("STM_004")));
        StatementResponse r = generate(typeSlug, date, from, to);
        String subject = req.subject() == null || req.subject().isBlank()
                ? company + " - " + r.title() + " (" + periodLabel(r) + ")" : req.subject().trim();
        String note = req.message() == null || req.message().isBlank() ? "" : req.message().trim();
        String html = StatementHtml.renderForEmail(r, company, note, fullName(sender));
        String text = (note.isEmpty() ? "" : note + "\n\n") + r.title() + " (" + periodLabel(r)
                + ") is attached as a formatted message. Open this email in an HTML-capable mail app to view it.";
        email.sendHtml(to_.getEmailAddress(), subject, html, text);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private Type parseType(String slug) {
        if (slug != null) {
            String s = slug.trim().toLowerCase(Locale.ROOT);
            for (Type t : Type.values()) if (t.slug.equals(s)) return t;
        }
        throw new UserException(HttpStatus.BAD_REQUEST, msgs.get("STM_003"));
    }

    private Period period(LocalDate date, LocalDate from, LocalDate to) {
        if (from != null && to != null) {
            if (from.isAfter(to)) throw new UserException(HttpStatus.BAD_REQUEST, msgs.get("STM_002"));
            return new Period(from, to);
        }
        if (from != null) throw new UserException(HttpStatus.BAD_REQUEST, msgs.get("STM_001"));
        LocalDate end = date != null ? date : to != null ? to : LocalDate.now();
        return new Period(null, end);
    }

    private List<Account> sortedAccounts() {
        List<Account> all = new ArrayList<>(accounts.findAll());
        all.sort(Comparator
                .comparing((Account a) -> a.getAccountOrder() == null ? Integer.MAX_VALUE : a.getAccountOrder())
                .thenComparing(a -> a.getNumber() == null ? Integer.MAX_VALUE : a.getNumber()));
        return all;
    }

    /** {debit total, credit total} per account for approved entries dated from..to. */
    private Map<Integer, BigDecimal[]> sums(LocalDate from, LocalDate to) {
        Map<Integer, BigDecimal[]> m = new HashMap<>();
        for (Object[] r : lines.totals(from == null ? MIN : from, to == null ? MAX : to,
                JournalEntry.JournalStatus.APPROVED)) {
            Integer id = (Integer) r[0];
            boolean debit = "DEBIT".equals(((Enum<?>) r[1]).name());
            BigDecimal amt = (BigDecimal) r[2];
            BigDecimal[] t = m.computeIfAbsent(id, k -> new BigDecimal[]{ZERO, ZERO});
            if (debit) t[0] = t[0].add(amt); else t[1] = t[1].add(amt);
        }
        return m;
    }

    /** Net income from journal activity in the sums; opening balances of revenue/expense accounts only if asked. */
    private BigDecimal netIncome(List<Account> all, Map<Integer, BigDecimal[]> s, boolean withInitial) {
        BigDecimal ni = ZERO;
        for (Account a : all) {
            boolean rev = category(a, "Revenue"), exp = category(a, "Expense");
            if (!rev && !exp) continue;
            BigDecimal amt = net(a, get(s, a)).add(withInitial ? init(a) : ZERO);
            ni = rev ? ni.add(amt) : ni.subtract(amt);
        }
        return ni;
    }

    /** Retained earnings as of the end of the sums, which must start at the beginning of the books. */
    private BigDecimal retainedAt(List<Account> all, Map<Integer, BigDecimal[]> s) {
        BigDecimal re = ZERO;
        for (Account a : all) {
            BigDecimal b = init(a).add(net(a, get(s, a)));
            if (isRetained(a)) re = re.add(b);
            else if (isDividend(a)) re = re.subtract(b);
        }
        return re.add(netIncome(all, s, true));
    }

    private static boolean left(Account a) {
        return a.getSide() != null && "LEFT".equals(a.getSide().name());
    }

    private static BigDecimal net(Account a, BigDecimal[] t) {
        return left(a) ? t[0].subtract(t[1]) : t[1].subtract(t[0]);
    }

    private static BigDecimal[] get(Map<Integer, BigDecimal[]> s, Account a) {
        BigDecimal[] t = s.get(a.getId());
        return t == null ? new BigDecimal[]{ZERO, ZERO} : t;
    }

    private static BigDecimal init(Account a) {
        return a.getInitialBalance() == null ? ZERO : a.getInitialBalance();
    }

    private static boolean category(Account a, String c) {
        return a.getCategory() != null && a.getCategory().trim().equalsIgnoreCase(c);
    }

    private static boolean isRetained(Account a) {
        return category(a, "Equity") && lower(a.getName()).contains("retained earnings");
    }

    private static boolean isDividend(Account a) {
        return category(a, "Equity") && lower(a.getName()).contains("dividend");
    }

    private static String lower(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT);
    }

    private static StatementRow row(Account a, BigDecimal debit, BigDecimal credit, BigDecimal amount) {
        return new StatementRow(a.getId(), a.getNumber() == null ? null : String.valueOf(a.getNumber()),
                a.getName(), a.getSubcategory(), debit, credit, amount);
    }

    private static StatementRow line(String name, BigDecimal amount) {
        return new StatementRow(null, null, name, null, null, null, amount);
    }

    private StatementResponse response(Type t, LocalDate from, LocalDate to, List<StatementSection> sections,
                                       Map<String, BigDecimal> totals, boolean balanced) {
        return new StatementResponse(t.slug, t.title, from, to, sections, totals, balanced, LocalDateTime.now());
    }

    private Path statementsDir() {
        return Path.of(uploadsDir, "statements").toAbsolutePath().normalize();
    }

    private static String periodLabel(StatementResponse r) {
        if (r.type().equals("trial-balance") || r.type().equals("balance-sheet")) return "as of " + r.to();
        return r.from() == null ? "through " + r.to() : r.from() + " to " + r.to();
    }

    private static String fullName(User u) {
        return ((u.getFirstName() == null ? "" : u.getFirstName()) + " "
                + (u.getLastName() == null ? "" : u.getLastName())).trim();
    }
}
