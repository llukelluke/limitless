package com.example.limitless.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.limitless.TestUsers;
import com.example.limitless.dto.AccountRequest;
import com.example.limitless.dto.AccountResponse;
import com.example.limitless.entity.Account;
import com.example.limitless.entity.EventLog;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.AccountRepository;
import com.example.limitless.repository.UserRepository;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

/** Sprint 2: admin adds, edits and deactivates chart of accounts entries; every change is logged. */
@ExtendWith(MockitoExtension.class)
class AccountServiceTest {

    @Mock
    AccountRepository accountRepository;
    @Mock
    UserRepository userRepository;
    @Mock
    EventLogService eventLogService;

    AccountService accountService;
    User admin;

    @BeforeEach
    void setUp() {
        accountService = new AccountService(accountRepository, userRepository, eventLogService);
        admin = TestUsers.active(1, "sadmin1026", "Admin123!");
        lenient().when(userRepository.findByUsername("sadmin1026")).thenReturn(Optional.of(admin));
        lenient().when(accountRepository.save(any(Account.class))).thenAnswer(call -> {
            Account a = call.getArgument(0);
            if (a.getId() == null) a.setId(10);
            return a;
        });
    }

    private AccountRequest request(String name, String number, String category, String side, String initial) {
        return new AccountRequest(name, number, "desc", side, category, "Current Assets", initial, "1",
                "BALANCE_SHEET", null);
    }

    private void assertAccountError(Runnable call, HttpStatus status, String message) {
        assertThatThrownBy(call::run)
                .isInstanceOf(UserException.class)
                .hasMessage(message)
                .extracting(e -> ((UserException) e).getStatus()).isEqualTo(status);
    }

    private Account existing(BigDecimal balance) {
        Account a = new Account();
        a.setId(5);
        accountService.apply(a, request("Cash", "101", "Asset", "LEFT", balance.toPlainString()));
        a.setDebit(BigDecimal.ZERO.setScale(2));
        a.setCredit(BigDecimal.ZERO.setScale(2));
        a.setBalance(balance);
        a.setUser(admin);
        when(accountRepository.findById(5)).thenReturn(Optional.of(a));
        return a;
    }

    @Test
    @DisplayName("TC-ACC-01 (P): admin adds an account; balance starts at the initial balance and an ADD event is logged")
    void createAccount() {
        Account saved = accountService.createAccount(request("Cash", "101", "Asset", "LEFT", "1,250.5"), "sadmin1026");

        assertThat(saved.getNumber()).isEqualTo(101);
        assertThat(saved.getInitialBalance()).isEqualByComparingTo("1250.50");
        assertThat(saved.getBalance()).isEqualByComparingTo("1250.50");
        assertThat(saved.getInitialBalance().scale()).isEqualTo(2);
        assertThat(saved.getUser()).isSameAs(admin);
        assertThat(saved.getAddedAt()).isNotNull();
        verify(eventLogService).record(eq("accounts"), eq(10), eq(EventLog.actionType.ADD), isNull(),
                any(AccountResponse.class), eq(admin));
    }

    @Test
    @DisplayName("TC-ACC-02 (N): duplicate account names and numbers are rejected")
    void duplicates() {
        when(accountRepository.existsByNameIgnoreCase("Cash")).thenReturn(true);
        assertAccountError(() -> accountService.createAccount(request("Cash", "101", "Asset", "LEFT", "0"), "sadmin1026"),
                HttpStatus.CONFLICT, "An account with this name already exists.");

        when(accountRepository.existsByNumber(102)).thenReturn(true);
        assertAccountError(() -> accountService.createAccount(request("Petty", "102", "Asset", "LEFT", "0"), "sadmin1026"),
                HttpStatus.CONFLICT, "An account with this number already exists.");
        verify(accountRepository, never()).save(any());
    }

    @Test
    @DisplayName("TC-ACC-03 (N): account numbers reject decimals, letters and the wrong starting digit")
    void numberRules() {
        String digits = "Account number must contain digits only.";
        assertAccountError(() -> accountService.createAccount(request("Cash", "10.1", "Asset", "LEFT", "0"), "sadmin1026"),
                HttpStatus.BAD_REQUEST, digits);
        assertAccountError(() -> accountService.createAccount(request("Cash", "10a", "Asset", "LEFT", "0"), "sadmin1026"),
                HttpStatus.BAD_REQUEST, digits);
        assertAccountError(() -> accountService.createAccount(request("Cash", "201", "Asset", "LEFT", "0"), "sadmin1026"),
                HttpStatus.BAD_REQUEST, "Asset account numbers must start with 1.");
    }

    @Test
    @DisplayName("TC-ACC-04 (N): money with more than two decimals or letters is rejected")
    void moneyRules() {
        String message = "Monetary values must be numbers with at most two decimal places.";
        assertAccountError(() -> accountService.createAccount(request("Cash", "101", "Asset", "LEFT", "1.234"), "sadmin1026"),
                HttpStatus.BAD_REQUEST, message);
        assertAccountError(() -> accountService.createAccount(request("Cash", "101", "Asset", "LEFT", "abc"), "sadmin1026"),
                HttpStatus.BAD_REQUEST, message);
    }

    @Test
    @DisplayName("TC-ACC-06 (P): editing logs a MODIFY event with before and after images")
    void updateAccount() {
        existing(new BigDecimal("0.00"));
        when(accountRepository.existsByNameIgnoreCaseAndIdNot(anyString(), anyInt())).thenReturn(false);
        when(accountRepository.existsByNumberAndIdNot(anyInt(), anyInt())).thenReturn(false);

        Account saved = accountService.updateAccount(5, request("Cash on Hand", "101", "Asset", "LEFT", "300"), "sadmin1026");

        assertThat(saved.getName()).isEqualTo("Cash on Hand");
        assertThat(saved.getBalance()).isEqualByComparingTo("300.00");
        verify(eventLogService).record(eq("accounts"), eq(5), eq(EventLog.actionType.MODIFY),
                any(AccountResponse.class), any(AccountResponse.class), eq(admin));
    }

    @Test
    @DisplayName("TC-ACC-08 (N): accounts with a balance above zero cannot be deactivated")
    void deactivateWithBalance() {
        existing(new BigDecimal("10.00"));
        assertAccountError(() -> accountService.deactivateAccount(5, "sadmin1026"),
                HttpStatus.BAD_REQUEST, "Accounts with a balance greater than zero cannot be deactivated.");
        verify(accountRepository, never()).save(any());
    }

    @Test
    @DisplayName("TC-ACC-09 (P): a zero-balance account is deactivated and the change is logged")
    void deactivateZeroBalance() {
        existing(new BigDecimal("0.00"));
        Account saved = accountService.deactivateAccount(5, "sadmin1026");

        assertThat(saved.getIsActive()).isFalse();
        verify(eventLogService).record(eq("accounts"), eq(5), eq(EventLog.actionType.DEACTIVATE),
                any(AccountResponse.class), any(AccountResponse.class), eq(admin));
    }

    @Test
    @DisplayName("TC-ACC-01 (P): credit-normal balances grow with credits")
    void creditNormalBalance() {
        Account a = new Account();
        a.setSide(Account.normalSide.RIGHT);
        a.setInitialBalance(new BigDecimal("100.00"));
        a.setDebit(new BigDecimal("25.00"));
        a.setCredit(new BigDecimal("50.00"));
        assertThat(AccountService.computeBalance(a)).isEqualByComparingTo("125.00");
    }

    @Test
    @DisplayName("TC-ACC-07 (N): editing to a duplicate name or number is rejected and the account is left unchanged")
    void updateDuplicates() {
        Account account = existing(new BigDecimal("0.00"));
        when(accountRepository.existsByNameIgnoreCaseAndIdNot("Petty Cash", 5)).thenReturn(true);
        assertAccountError(() -> accountService.updateAccount(5, request("Petty Cash", "101", "Asset", "LEFT", "0"), "sadmin1026"),
                HttpStatus.CONFLICT, "An account with this name already exists.");
        // The managed entity must not be touched, or Hibernate flushes the duplicate into the database
        assertThat(account.getName()).isEqualTo("Cash");

        when(accountRepository.existsByNumberAndIdNot(102, 5)).thenReturn(true);
        assertAccountError(() -> accountService.updateAccount(5, request("Cash", "102", "Asset", "LEFT", "0"), "sadmin1026"),
                HttpStatus.CONFLICT, "An account with this number already exists.");
        assertThat(account.getNumber()).isEqualTo(101);
        verify(accountRepository, never()).save(any());
    }

    @Test
    @DisplayName("TC-ACC-04 (N): missing required fields are rejected")
    void missingFields() {
        String message = "Name, number, category, subcategory, normal side, order and statement are required.";
        assertAccountError(() -> accountService.createAccount(request("", "101", "Asset", "LEFT", "0"), "sadmin1026"),
                HttpStatus.BAD_REQUEST, message);
        assertAccountError(() -> accountService.createAccount(request("Cash", null, "Asset", "LEFT", "0"), "sadmin1026"),
                HttpStatus.BAD_REQUEST, message);
        assertAccountError(() -> accountService.createAccount(request("Cash", "101", "Asset", " ", "0"), "sadmin1026"),
                HttpStatus.BAD_REQUEST, message);
    }

    @Test
    @DisplayName("TC-ACC-05 (N): unknown category, normal side and statement are rejected")
    void unknownEnums() {
        assertAccountError(() -> accountService.createAccount(request("Cash", "101", "Cash", "LEFT", "0"), "sadmin1026"),
                HttpStatus.BAD_REQUEST, "Unknown account category.");
        assertAccountError(() -> accountService.createAccount(request("Cash", "101", "Asset", "UP", "0"), "sadmin1026"),
                HttpStatus.BAD_REQUEST, "Unknown normal side.");
        AccountRequest badStatement = new AccountRequest("Cash", "101", null, "LEFT", "Asset", "Current Assets", "0",
                "1", "CASH_FLOW", null);
        assertAccountError(() -> accountService.createAccount(badStatement, "sadmin1026"),
                HttpStatus.BAD_REQUEST, "Unknown statement.");
    }

    @Test
    @DisplayName("TC-ACC-01 (P): money accepts commas and is stored with two decimals")
    void moneyParsing() {
        assertThat(AccountService.parseMoney("1,234,567.8")).isEqualByComparingTo("1234567.80");
        assertThat(AccountService.parseMoney("1,234,567.8").scale()).isEqualTo(2);
        assertThat(AccountService.parseMoney("")).isEqualByComparingTo("0.00");
    }
}
