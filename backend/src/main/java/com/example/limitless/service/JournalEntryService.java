package com.example.limitless.service;

import com.example.limitless.dto.*;
import com.example.limitless.entity.*;
import com.example.limitless.exception.UserException;
import com.example.limitless.exception.ValidationException;
import com.example.limitless.exception.ValidationIssue;
import com.example.limitless.repository.AccountRepository;
import com.example.limitless.repository.JournalEntryRepository;
import com.example.limitless.repository.UserRepository;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.*;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Sprint 3 journalizing: draft -> submit -> approve/reject, with validation,
 * posting to accounts on approval, attachments, notifications, and event logging.
 */
@Service
public class JournalEntryService {

    private static final String TABLE = "journal_entries";

    private final JournalEntryRepository entries;
    private final AccountRepository accounts;
    private final UserRepository users;
    private final EventLogService events;
    private final ErrorMessageService msgs;
    private final EmailService email;
    private final AttachmentService attachmentService;

    public JournalEntryService(JournalEntryRepository entries, AccountRepository accounts, UserRepository users,
                               EventLogService events, ErrorMessageService msgs, EmailService email,
                               AttachmentService attachmentService) {
        this.entries = entries;
        this.accounts = accounts;
        this.users = users;
        this.events = events;
        this.msgs = msgs;
        this.email = email;
        this.attachmentService = attachmentService;
    }

    // =====================================================================
    // Drafts
    // =====================================================================

    @Transactional
    public JournalEntryResponse create(JournalEntryRequest req, User actor) {
        throwIfAny(validate(req, false));
        JournalEntry e = new JournalEntry();
        e.setCreatedBy(actor);
        e.setStatus(JournalEntry.JournalStatus.DRAFT);
        e.setCreatedAt(LocalDateTime.now());
        apply(e, req);
        JournalEntry saved = entries.save(e);
        events.recordJson(TABLE, saved.getId(), EventLog.actionType.ADD,
                null, snapshot(saved), actor);
        return toResponse(saved);
    }

    @Transactional
    public JournalEntryResponse update(Integer id, JournalEntryRequest req, User actor) {
        JournalEntry e = findOwnedDraft(id, actor);
        throwIfAny(validate(req, false));
        String before = snapshot(e);
        apply(e, req);
        JournalEntry saved = entries.save(e);
        events.recordJson(TABLE, saved.getId(), EventLog.actionType.MODIFY,
                before, snapshot(saved), actor);
        return toResponse(saved);
    }

    /** "Cancel or reset": removes a draft (and its files). Submitted entries can never be deleted. */
    @Transactional
    public void cancel(Integer id, User actor) {
        JournalEntry e = findOwnedDraft(id, actor);
        String before = snapshot(e);
        e.getAttachments().forEach(attachmentService::deleteFile);
        entries.delete(e);
        events.recordJson(TABLE, id, EventLog.actionType.DEACTIVATE,
                before, null, actor);
    }

    // =====================================================================
    // Submit / approve / reject
    // =====================================================================

    @Transactional
    public JournalEntryResponse submit(Integer id, User actor) {
        JournalEntry e = findOwnedDraft(id, actor);
        throwIfAny(validate(toRequest(e), true)); // no submitting an entry that contains an error
        String before = snapshot(e);
        e.setStatus(JournalEntry.JournalStatus.SUBMITTED);
        JournalEntry saved = entries.save(e);
        events.recordJson(TABLE, saved.getId(), EventLog.actionType.MODIFY,
                before, snapshot(saved), actor);
        notifyManagers(saved, actor);
        return toResponse(saved);
    }

    /** Posts the entry to the ledger: updates each affected account's debit, credit and balance. */
    @Transactional
    public JournalEntryResponse approve(Integer id, User manager) {
        JournalEntry e = find(id);
        requirePending(e);
        String beforeEntry = snapshot(e);

        Map<Integer, Account> touched = new LinkedHashMap<>();
        Map<Integer, String> beforeImages = new HashMap<>();
        for (JournalEntryLine line : e.getLines()) {
            Account a = line.getAccount();
            touched.putIfAbsent(a.getId(), a);
            beforeImages.putIfAbsent(a.getId(), AccountSnapshot.of(a));
            BigDecimal amt = line.getAmount();
            boolean debit = line.getSide() == JournalEntryLine.Side.DEBIT;
            if (debit) a.setDebit(nz(a.getDebit()).add(amt)); else a.setCredit(nz(a.getCredit()).add(amt));
            boolean increases = (a.getSide() == Account.normalSide.LEFT) == debit;
            a.setBalance(increases ? nz(a.getBalance()).add(amt) : nz(a.getBalance()).subtract(amt));
        }
        for (Account a : touched.values()) {
            accounts.save(a);
            events.recordJson("accounts", a.getId(), EventLog.actionType.MODIFY,
                    beforeImages.get(a.getId()), AccountSnapshot.of(a), manager);
        }

        e.setStatus(JournalEntry.JournalStatus.APPROVED);
        e.setReviewedBy(manager);
        e.setReviewedAt(LocalDateTime.now());
        JournalEntry saved = entries.save(e);
        events.recordJson(TABLE, saved.getId(), EventLog.actionType.MODIFY,
                beforeEntry, snapshot(saved), manager);
        notifyCreator(saved, "approved", null);
        return toResponse(saved);
    }

    @Transactional
    public JournalEntryResponse reject(Integer id, String comment, User manager) {
        JournalEntry e = find(id);
        requirePending(e);
        if (comment == null || comment.isBlank()) {
            throw new ValidationException(List.of(issue("JRN_017")));
        }
        String before = snapshot(e);
        e.setStatus(JournalEntry.JournalStatus.REJECTED);
        e.setComment(comment.trim());
        e.setReviewedBy(manager);
        e.setReviewedAt(LocalDateTime.now());
        JournalEntry saved = entries.save(e);
        events.recordJson(TABLE, saved.getId(), EventLog.actionType.MODIFY,
                before, snapshot(saved), manager);
        notifyCreator(saved, "rejected", saved.getComment());
        return toResponse(saved);
    }

    // =====================================================================
    // Attachments
    // =====================================================================

    @Transactional
    public AttachmentResponse addAttachment(Integer id, MultipartFile file, User actor) {
        JournalEntry e = findOwnedDraft(id, actor);
        String before = snapshot(e);
        JournalAttachment att = attachmentService.store(e, file);
        JournalEntry saved = entries.saveAndFlush(e);
        events.recordJson(TABLE, saved.getId(), EventLog.actionType.MODIFY,
                before, snapshot(saved), actor);
        // the new row now has an id; find it again
        JournalAttachment stored = saved.getAttachments().stream()
                .filter(a -> a.getFilePath().equals(att.getFilePath())).findFirst().orElse(att);
        return attachmentService.toResponse(stored);
    }

    @Transactional(readOnly = true)
    public AttachmentService.Download downloadAttachment(Integer id, Integer attachmentId, User actor) {
        JournalEntry e = findVisible(id, actor);
        JournalAttachment att = e.getAttachments().stream().filter(a -> a.getId().equals(attachmentId))
                .findFirst().orElseThrow(() -> new UserException(HttpStatus.NOT_FOUND, msgs.get("ATT_004")));
        return attachmentService.load(att);
    }

    @Transactional
    public void deleteAttachment(Integer id, Integer attachmentId, User actor) {
        JournalEntry e = findOwnedDraft(id, actor);
        JournalAttachment att = e.getAttachments().stream().filter(a -> a.getId().equals(attachmentId))
                .findFirst().orElseThrow(() -> new UserException(HttpStatus.NOT_FOUND, msgs.get("ATT_004")));
        String before = snapshot(e);
        e.getAttachments().remove(att);
        attachmentService.deleteFile(att);
        JournalEntry saved = entries.save(e);
        events.recordJson(TABLE, saved.getId(), EventLog.actionType.MODIFY,
                before, snapshot(saved), actor);
    }

    // =====================================================================
    // Viewing
    // =====================================================================

    @Transactional(readOnly = true)
    public JournalEntryResponse get(Integer id, User actor) {
        return toResponse(findVisible(id, actor));
    }

    @Transactional(readOnly = true)
    public long pendingCount() {
        return entries.countByStatus(JournalEntry.JournalStatus.SUBMITTED);
    }

    /** Lists entries. status: DRAFT | PENDING | APPROVED | REJECTED. search: account name, amount, or date. */
    @Transactional(readOnly = true)
    public List<JournalEntryResponse> list(String status, LocalDate from, LocalDate to, String search, User actor) {
        JournalEntry.JournalStatus st = parseStatus(status);
        final Integer me = actor.getId();

        Specification<JournalEntry> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            // other people's drafts are private
            ps.add(cb.or(cb.notEqual(root.get("status"), JournalEntry.JournalStatus.DRAFT),
                    cb.equal(root.get("createdBy").get("id"), me)));
            if (st != null) ps.add(cb.equal(root.get("status"), st));
            if (from != null) ps.add(cb.greaterThanOrEqualTo(root.<LocalDate>get("entryDate"), from));
            if (to != null) ps.add(cb.lessThanOrEqualTo(root.<LocalDate>get("entryDate"), to));
            if (search != null && !search.isBlank()) {
                String s = search.trim();
                query.distinct(true);
                Join<JournalEntry, JournalEntryLine> l = root.join("lines", JoinType.LEFT);
                Join<JournalEntryLine, Account> a = l.join("account", JoinType.LEFT);
                List<Predicate> any = new ArrayList<>();
                any.add(cb.like(cb.lower(a.get("name")), "%" + s.toLowerCase(Locale.ROOT) + "%"));
                BigDecimal amount = tryAmount(s);
                if (amount != null) any.add(cb.equal(l.<BigDecimal>get("amount"), amount));
                LocalDate date = tryDate(s);
                if (date != null) any.add(cb.equal(root.<LocalDate>get("entryDate"), date));
                ps.add(cb.or(any.toArray(new Predicate[0])));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };

        Sort sort = Sort.by(Sort.Direction.DESC, "entryDate").and(Sort.by(Sort.Direction.DESC, "id"));
        return entries.findAll(spec, sort).stream().map(this::toResponse).toList();
    }

    // =====================================================================
    // Validation (also exposed as POST /api/journal-entries/validate)
    // =====================================================================

    /**
     * Returns every problem found. forSubmit=false only checks things that make a line impossible to
     * save; forSubmit=true adds the accounting rules (date, a debit and a credit, balanced).
     */
    @Transactional(readOnly = true)
    public List<ValidationIssue> validate(JournalEntryRequest req, boolean forSubmit) {
        List<ValidationIssue> out = new ArrayList<>();
        if (req == null) {
            out.add(issue("JRN_018"));
            return out;
        }
        if (forSubmit && req.entryDate() == null) out.add(issue("JRN_001"));
        if (req.entryType() != null && !req.entryType().isBlank() && parseType(req.entryType()) == null) {
            out.add(issue("JRN_002"));
        }
        if (req.description() != null && req.description().length() > 255) out.add(issue("JRN_019"));

        List<JournalLineRequest> lines = req.lines() == null ? List.of() : req.lines();
        if (lines.isEmpty()) {
            if (forSubmit) out.add(issue("JRN_018"));
            return out;
        }

        BigDecimal debits = BigDecimal.ZERO;
        BigDecimal credits = BigDecimal.ZERO;
        boolean anyDebit = false;
        boolean anyCredit = false;

        for (int i = 0; i < lines.size(); i++) {
            JournalLineRequest line = lines.get(i);
            int n = i + 1;

            JournalEntryLine.Side side = line == null ? null : parseSide(line.side());
            if (side == null) out.add(issue("JRN_009", "line", n));

            if (line == null || line.accountId() == null) {
                out.add(issue("JRN_006", "line", n));
            } else {
                Optional<Account> acct = accounts.findById(line.accountId());
                if (acct.isEmpty()) {
                    out.add(issue("JRN_007", "line", n));
                } else if (!Boolean.TRUE.equals(acct.get().getIsActive())) {
                    out.add(issue("JRN_008", "line", n, "account", acct.get().getName()));
                }
            }

            BigDecimal amt = line == null ? null : line.amount();
            boolean amountOk = false;
            if (amt == null) {
                out.add(issue("JRN_010", "line", n));
            } else if (amt.signum() <= 0) {
                out.add(issue("JRN_011", "line", n));
            } else if (amt.stripTrailingZeros().scale() > 2) {
                out.add(issue("JRN_012", "line", n));
            } else {
                amountOk = true;
            }

            if (side != null && amountOk) {
                if (side == JournalEntryLine.Side.DEBIT) { debits = debits.add(amt); anyDebit = true; }
                else { credits = credits.add(amt); anyCredit = true; }
            }
        }

        if (forSubmit) {
            if (!anyDebit) out.add(issue("JRN_003"));
            if (!anyCredit) out.add(issue("JRN_004"));
            if (anyDebit && anyCredit && debits.compareTo(credits) != 0) {
                out.add(issue("JRN_005", "debits", money(debits), "credits", money(credits),
                        "difference", money(debits.subtract(credits).abs())));
            }
        }
        return out;
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private void apply(JournalEntry e, JournalEntryRequest req) {
        e.setEntryDate(req.entryDate());
        JournalEntry.JournalEntryType type = req.entryType() == null || req.entryType().isBlank()
                ? JournalEntry.JournalEntryType.REGULAR : parseType(req.entryType());
        e.setEntryType(type);
        e.setDescription(req.description() == null || req.description().isBlank() ? null : req.description().trim());

        // Debits come before credits: insert all debit lines first, then credits (ids follow insert order).
        List<JournalEntryLine> debitsFirst = new ArrayList<>();
        List<JournalEntryLine> credits = new ArrayList<>();
        for (JournalLineRequest l : req.lines() == null ? List.<JournalLineRequest>of() : req.lines()) {
            Account acct = accounts.findById(l.accountId()).orElseThrow();
            JournalEntryLine.Side side = parseSide(l.side());
            JournalEntryLine line = new JournalEntryLine(e, acct, side, l.amount().setScale(2));
            (side == JournalEntryLine.Side.DEBIT ? debitsFirst : credits).add(line);
        }
        e.getLines().clear();
        e.getLines().addAll(debitsFirst);
        e.getLines().addAll(credits);
    }

    private JournalEntryRequest toRequest(JournalEntry e) {
        List<JournalLineRequest> lines = e.getLines().stream()
                .map(l -> new JournalLineRequest(l.getAccount().getId(), l.getSide().name(), l.getAmount())).toList();
        return new JournalEntryRequest(e.getEntryDate(), e.getEntryType() == null ? null : e.getEntryType().name(),
                e.getDescription(), lines);
    }

    private JournalEntry find(Integer id) {
        return entries.findById(id).orElseThrow(() -> new UserException(HttpStatus.NOT_FOUND, msgs.get("JRN_013")));
    }

    /** Anyone can see submitted/approved/rejected entries; drafts are visible to their creator only. */
    private JournalEntry findVisible(Integer id, User actor) {
        JournalEntry e = find(id);
        if (e.getStatus() == JournalEntry.JournalStatus.DRAFT && !e.getCreatedBy().getId().equals(actor.getId())) {
            throw new UserException(HttpStatus.NOT_FOUND, msgs.get("JRN_013"));
        }
        return e;
    }

    private JournalEntry findOwnedDraft(Integer id, User actor) {
        JournalEntry e = find(id);
        if (!e.getCreatedBy().getId().equals(actor.getId())) {
            throw new UserException(HttpStatus.FORBIDDEN, msgs.get("JRN_015"));
        }
        if (e.getStatus() != JournalEntry.JournalStatus.DRAFT) {
            throw new UserException(HttpStatus.CONFLICT, msgs.get("JRN_014"));
        }
        return e;
    }

    private void requirePending(JournalEntry e) {
        if (e.getStatus() != JournalEntry.JournalStatus.SUBMITTED) {
            throw new UserException(HttpStatus.CONFLICT, msgs.get("JRN_016"));
        }
    }

    private void throwIfAny(List<ValidationIssue> issues) {
        if (!issues.isEmpty()) throw new ValidationException(issues);
    }

    private ValidationIssue issue(String code, Object... params) {
        return new ValidationIssue(code, msgs.get(code, params));
    }

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO.setScale(2) : v; }

    private static String money(BigDecimal v) { return String.format(Locale.US, "%,.2f", v); }

    private JournalEntry.JournalStatus parseStatus(String s) {
        if (s == null || s.isBlank()) return null;
        String v = s.trim().toUpperCase(Locale.ROOT);
        if (v.equals("PENDING")) v = "SUBMITTED";
        try {
            return JournalEntry.JournalStatus.valueOf(v);
        } catch (IllegalArgumentException ex) {
            throw new UserException(HttpStatus.BAD_REQUEST, msgs.get("JRN_020"));
        }
    }

    private static JournalEntry.JournalEntryType parseType(String s) {
        try {
            return JournalEntry.JournalEntryType.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException ex) {
            return null;
        }
    }

    private static JournalEntryLine.Side parseSide(String s) {
        if (s == null) return null;
        try {
            return JournalEntryLine.Side.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static BigDecimal tryAmount(String s) {
        try {
            return new BigDecimal(s.replace(",", "").replace("$", "").trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static LocalDate tryDate(String s) {
        try {
            return LocalDate.parse(s.trim());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private void notifyManagers(JournalEntry e, User submitter) {
        BigDecimal total = e.getLines().stream().filter(l -> l.getSide() == JournalEntryLine.Side.DEBIT)
                .map(JournalEntryLine::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        String body = displayName(submitter) + " submitted journal entry #" + e.getId() + " dated " + e.getEntryDate()
                + " for $" + money(total) + " and it is waiting for your approval.";
        for (User m : users.findByRole(User.UserRole.MANAGER)) {
            if (m.getStatus() == User.UserStatus.ACTIVATED && m.getEmailAddress() != null) {
                email.send(m.getEmailAddress(), "Journal entry #" + e.getId() + " needs your approval", body);
            }
        }
    }

    private void notifyCreator(JournalEntry e, String outcome, String reason) {
        User u = e.getCreatedBy();
        if (u == null || u.getEmailAddress() == null) return;
        String body = "Your journal entry #" + e.getId() + " was " + outcome + "."
                + (reason == null ? "" : "\n\nReason: " + reason);
        email.send(u.getEmailAddress(), "Journal entry #" + e.getId() + " " + outcome, body);
    }

    private static String nameOf(User u) {
        return u == null ? null : displayName(u);
    }

    private static String displayName(User u) {
        return (u.getFirstName() == null ? "" : u.getFirstName() + " ") + (u.getLastName() == null ? "" : u.getLastName());
    }

    private JournalEntryResponse toResponse(JournalEntry e) {
        BigDecimal debits = BigDecimal.ZERO.setScale(2);
        BigDecimal credits = BigDecimal.ZERO.setScale(2);
        List<JournalLineResponse> lines = new ArrayList<>();
        for (JournalEntryLine l : e.getLines()) {
            if (l.getSide() == JournalEntryLine.Side.DEBIT) debits = debits.add(l.getAmount());
            else credits = credits.add(l.getAmount());
            lines.add(new JournalLineResponse(l.getId(), l.getAccount().getId(), l.getAccount().getName(),
                    String.valueOf(l.getAccount().getNumber()), l.getSide().name(), l.getAmount()));
        }
        List<AttachmentResponse> atts = e.getAttachments().stream().map(attachmentService::toResponse).toList();
        return new JournalEntryResponse(e.getId(), e.getEntryDate(),
                e.getEntryType() == null ? null : e.getEntryType().name(), e.getStatus().name(),
                e.getDescription(), e.getComment(), e.getCreatedBy().getId(), nameOf(e.getCreatedBy()),
                e.getReviewedBy() == null ? null : e.getReviewedBy().getId(), nameOf(e.getReviewedBy()),
                e.getReviewedAt(), e.getCreatedAt(),
                debits, credits, lines, atts);
    }

    private String snapshot(JournalEntry e) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"id\":").append(e.getId());
        sb.append(",\"created_by\":").append(e.getCreatedBy().getId());
        sb.append(",\"entry_date\":").append(JsonUtil.q(e.getEntryDate() == null ? null : e.getEntryDate().toString()));
        sb.append(",\"entry_type\":").append(JsonUtil.q(e.getEntryType() == null ? null : e.getEntryType().name()));
        sb.append(",\"status\":").append(JsonUtil.q(e.getStatus() == null ? null : e.getStatus().name()));
        sb.append(",\"description\":").append(JsonUtil.q(e.getDescription()));
        sb.append(",\"comment\":").append(JsonUtil.q(e.getComment()));
        sb.append(",\"reviewed_by\":").append(e.getReviewedBy() == null ? "null" : String.valueOf(e.getReviewedBy().getId()));
        sb.append(",\"lines\":[");
        for (int i = 0; i < e.getLines().size(); i++) {
            JournalEntryLine l = e.getLines().get(i);
            if (i > 0) sb.append(',');
            sb.append("{\"account_id\":").append(l.getAccount().getId())
                    .append(",\"account_name\":").append(JsonUtil.q(l.getAccount().getName()))
                    .append(",\"side\":").append(JsonUtil.q(l.getSide().name()))
                    .append(",\"amount\":").append(l.getAmount()).append('}');
        }
        sb.append("],\"attachments\":[");
        for (int i = 0; i < e.getAttachments().size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(JsonUtil.q(e.getAttachments().get(i).getOriginalName()));
        }
        return sb.append("]}").toString();
    }
}
