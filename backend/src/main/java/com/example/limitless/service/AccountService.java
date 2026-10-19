package com.example.limitless.service;

import com.example.limitless.dto.AccountRequest;
import com.example.limitless.dto.AccountResponse;
import com.example.limitless.entity.Account;
import com.example.limitless.entity.EventLog;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.AccountRepository;
import com.example.limitless.repository.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountService {

    static final String TABLE = "accounts";

    // Account numbers start with the digit of their category (1 assets … 5 expenses).
    static final Map<String, Character> CATEGORY_PREFIX = Map.of(
            "Asset", '1', "Liability", '2', "Equity", '3', "Revenue", '4', "Expense", '5');

    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final EventLogService eventLogService;

    public AccountService(AccountRepository accountRepository, UserRepository userRepository,
                          EventLogService eventLogService) {
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
        this.eventLogService = eventLogService;
    }

    // ---------- Reads ----------

    @Transactional(readOnly = true)
    public List<Account> getAllAccounts() {
        return accountRepository.findAllByOrderByNumberAsc();
    }

    @Transactional(readOnly = true)
    public Account getAccountById(Integer id) {
        return accountRepository.findById(id)
                .orElseThrow(() -> new UserException(HttpStatus.NOT_FOUND, "Account doesn't exist."));
    }

    // ---------- Create / update ----------

    @Transactional
    public Account createAccount(AccountRequest req, String username) {
        User user = currentUser(username);
        Account account = new Account();
        apply(account, req);
        if (accountRepository.existsByNameIgnoreCase(account.getName())) {
            throw new UserException(HttpStatus.CONFLICT, "An account with this name already exists.");
        }
        if (accountRepository.existsByNumber(account.getNumber())) {
            throw new UserException(HttpStatus.CONFLICT, "An account with this number already exists.");
        }
        account.setDebit(BigDecimal.ZERO.setScale(2));
        account.setCredit(BigDecimal.ZERO.setScale(2));
        account.setBalance(computeBalance(account));
        account.setAddedAt(LocalDateTime.now());
        account.setUser(user);
        account.setIsActive(true);

        Account saved = accountRepository.save(account);
        eventLogService.record(TABLE, saved.getId(), EventLog.actionType.ADD, null, AccountResponse.from(saved), user);
        return saved;
    }

    @Transactional
    public Account updateAccount(Integer id, AccountRequest req, String username) {
        User user = currentUser(username);
        Account account = getAccountById(id);
        AccountResponse before = AccountResponse.from(account);

        // Validate on a copy first: the duplicate queries would auto-flush changes made to the managed entity
        Account candidate = new Account();
        apply(candidate, req);
        if (accountRepository.existsByNameIgnoreCaseAndIdNot(candidate.getName(), id)) {
            throw new UserException(HttpStatus.CONFLICT, "An account with this name already exists.");
        }
        if (accountRepository.existsByNumberAndIdNot(candidate.getNumber(), id)) {
            throw new UserException(HttpStatus.CONFLICT, "An account with this number already exists.");
        }
        apply(account, req);
        account.setBalance(computeBalance(account));

        Account saved = accountRepository.save(account);
        eventLogService.record(TABLE, id, EventLog.actionType.MODIFY, before, AccountResponse.from(saved), user);
        return saved;
    }

    @Transactional
    public Account deactivateAccount(Integer id, String username) {
        User user = currentUser(username);
        Account account = getAccountById(id);
        if (account.getBalance() != null && account.getBalance().signum() > 0) {
            throw new UserException(HttpStatus.BAD_REQUEST,
                    "Accounts with a balance greater than zero cannot be deactivated.");
        }
        AccountResponse before = AccountResponse.from(account);
        account.setIsActive(false);
        Account saved = accountRepository.save(account);
        eventLogService.record(TABLE, id, EventLog.actionType.DEACTIVATE, before, AccountResponse.from(saved), user);
        return saved;
    }

    // ---------- Helpers ----------

    // Validates every field and copies it onto the account. Debit, credit and balance are not client-editable.
    void apply(Account account, AccountRequest req) {
        if (isBlank(req.name()) || isBlank(req.number()) || isBlank(req.category()) || isBlank(req.subcategory())
                || isBlank(req.normalSide()) || isBlank(req.statement()) || isBlank(req.order())) {
            throw new UserException(HttpStatus.BAD_REQUEST,
                    "Name, number, category, subcategory, normal side, order and statement are required.");
        }
        String number = req.number().trim();
        if (!number.matches("\\d{1,9}")) {
            throw new UserException(HttpStatus.BAD_REQUEST, "Account number must contain digits only.");
        }
        String category = req.category().trim();
        Character prefix = CATEGORY_PREFIX.get(category);
        if (prefix == null) {
            throw new UserException(HttpStatus.BAD_REQUEST, "Unknown account category.");
        }
        if (number.charAt(0) != prefix) {
            throw new UserException(HttpStatus.BAD_REQUEST,
                    category + " account numbers must start with " + prefix + ".");
        }
        String order = req.order().trim();
        if (!order.matches("\\d{1,4}")) {
            throw new UserException(HttpStatus.BAD_REQUEST, "Order must be a whole number.");
        }

        account.setName(req.name().trim());
        account.setNumber(Integer.valueOf(number));
        account.setDescription(trimToNull(req.description()));
        account.setSide(parseEnum(Account.normalSide.class, req.normalSide(), "Unknown normal side."));
        account.setCategory(category);
        account.setSubcategory(req.subcategory().trim());
        account.setInitialBalance(parseMoney(req.initialBalance()));
        account.setAccountOrder(Integer.valueOf(order));
        account.setStatement(parseEnum(Account.accountStatement.class, req.statement(), "Unknown statement."));
        account.setComment(trimToNull(req.comment()));
    }

    // Blank means 0.00; commas are allowed ("1,250.00"); more than two decimals is rejected.
    static BigDecimal parseMoney(String text) {
        if (isBlank(text)) return BigDecimal.ZERO.setScale(2);
        String plain = text.trim().replace(",", "");
        if (!plain.matches("-?\\d{1,13}(\\.\\d{1,2})?")) {
            throw new UserException(HttpStatus.BAD_REQUEST,
                    "Monetary values must be numbers with at most two decimal places.");
        }
        return new BigDecimal(plain).setScale(2);
    }

    // Debit-normal (LEFT) accounts grow with debits, credit-normal (RIGHT) accounts with credits.
    static BigDecimal computeBalance(Account a) {
        BigDecimal net = a.getSide() == Account.normalSide.LEFT
                ? a.getDebit().subtract(a.getCredit())
                : a.getCredit().subtract(a.getDebit());
        return a.getInitialBalance().add(net);
    }

    private User currentUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UserException(HttpStatus.UNAUTHORIZED, "User doesn't exist."));
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String value, String message) {
        try {
            return Enum.valueOf(type, value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new UserException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private static String trimToNull(String s) {
        return isBlank(s) ? null : s.trim();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
