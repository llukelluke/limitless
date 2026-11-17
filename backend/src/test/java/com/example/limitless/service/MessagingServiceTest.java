package com.example.limitless.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.limitless.dto.EmailSendRequest;
import com.example.limitless.dto.RecipientResponse;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

/** Sprint 4: any role can email any active user, and files can be attached (journal attachment rules). */
@ExtendWith(MockitoExtension.class)
class MessagingServiceTest {

    @Mock UserRepository users;
    @Mock EmailService email;
    @Mock ErrorMessageService msgs;

    MessagingService service;
    User admin, manager, accountant, accountant2, suspended, pending;

    @BeforeEach
    void setUp() {
        lenient().when(msgs.get(anyString(), any(Object[].class))).thenAnswer(call -> call.getArgument(0));
        lenient().when(msgs.get(anyString())).thenAnswer(call -> call.getArgument(0));
        service = new MessagingService(users, email, msgs, new AttachmentService("./target/test-uploads", msgs));
        admin = user(1, User.UserRole.ADMINISTRATOR, User.UserStatus.ACTIVATED);
        manager = user(2, User.UserRole.MANAGER, User.UserStatus.ACTIVATED);
        accountant = user(3, User.UserRole.ACCOUNTANT, User.UserStatus.ACTIVATED);
        accountant2 = user(4, User.UserRole.ACCOUNTANT, User.UserStatus.ACTIVATED);
        suspended = user(5, User.UserRole.MANAGER, User.UserStatus.SUSPENDED);
        pending = user(6, User.UserRole.ACCOUNTANT, User.UserStatus.PENDING);
        pending.setUsername(null);
        List<User> all = List.of(admin, manager, accountant, accountant2, suspended, pending);
        lenient().when(users.findAll()).thenReturn(all);
        for (User u : all) lenient().when(users.findById(u.getId())).thenReturn(Optional.of(u));
    }

    private static User user(int id, User.UserRole role, User.UserStatus status) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        u.setStatus(status);
        u.setUsername("user" + id);
        u.setFirstName("First" + id);
        u.setLastName("Last" + id);
        u.setEmailAddress("user" + id + "@example.com");
        return u;
    }

    private static EmailSendRequest to(User u) {
        return new EmailSendRequest(u.getId(), "Subject", "Body");
    }

    @Test
    @DisplayName("Recipients: every active user of every role except the sender")
    void recipientsAreEveryActiveUser() {
        List<Integer> ids = service.recipients(accountant).stream().map(RecipientResponse::id).toList();
        assertThat(ids).containsExactlyInAnyOrder(1, 2, 4);
    }

    @Test
    @DisplayName("An accountant can email another accountant (same role)")
    void sameRoleAllowed() {
        service.send(accountant, to(accountant2), null);
        verify(email).send(eq("user4@example.com"), eq("Subject"), anyString(), eq(List.of()));
    }

    @Test
    @DisplayName("Non-admins cannot email suspended or pending users; admins can email suspended but not pending")
    void inactiveRecipients() {
        assertThatThrownBy(() -> service.send(accountant, to(suspended), null)).isInstanceOf(UserException.class).hasMessage("EML_002");
        assertThatThrownBy(() -> service.send(accountant, to(pending), null)).isInstanceOf(UserException.class).hasMessage("EML_002");
        assertThatThrownBy(() -> service.send(admin, to(pending), null)).isInstanceOf(UserException.class).hasMessage("EML_002");
        service.send(admin, to(suspended), null);
        verify(email).send(eq("user5@example.com"), anyString(), anyString(), anyList());
    }

    @Test
    @DisplayName("Missing subject or unknown recipient is rejected")
    void badRequests() {
        assertThatThrownBy(() -> service.send(manager, new EmailSendRequest(3, " ", "Body"), null)).hasMessage("EML_001");
        when(users.findById(99)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.send(manager, new EmailSendRequest(99, "S", "B"), null)).hasMessage("EML_003");
        verify(email, never()).send(anyString(), anyString(), anyString(), anyList());
    }

    @Test
    @DisplayName("Allowed attachments are sent with the email under their file names")
    @SuppressWarnings("unchecked")
    void attachmentsSent() {
        var pdf = new MockMultipartFile("files", "report.pdf", "application/pdf", "%PDF".getBytes());
        var png = new MockMultipartFile("files", "chart.png", "image/png", new byte[] {1, 2});
        service.send(manager, to(accountant), List.of(pdf, png));
        ArgumentCaptor<List<EmailService.Attachment>> sent = ArgumentCaptor.forClass(List.class);
        verify(email).send(eq("user3@example.com"), eq("Subject"), anyString(), sent.capture());
        assertThat(sent.getValue()).extracting(EmailService.Attachment::filename).containsExactly("report.pdf", "chart.png");
        assertThat(sent.getValue().get(0).content()).isEqualTo("%PDF".getBytes());
    }

    @Test
    @DisplayName("A disallowed, empty or oversized attachment stops the email")
    void badAttachments() {
        var exe = new MockMultipartFile("files", "setup.exe", "application/octet-stream", new byte[] {1});
        var empty = new MockMultipartFile("files", "empty.pdf", "application/pdf", new byte[0]);
        var big = new MockMultipartFile("files", "big.pdf", "application/pdf", new byte[10 * 1024 * 1024 + 1]);
        assertThatThrownBy(() -> service.send(manager, to(accountant), List.of(exe))).hasMessage("ATT_001");
        assertThatThrownBy(() -> service.send(manager, to(accountant), List.of(empty))).hasMessage("ATT_002");
        assertThatThrownBy(() -> service.send(manager, to(accountant), List.of(big))).hasMessage("ATT_003");
        verify(email, never()).send(anyString(), anyString(), anyString(), anyList());
    }
}
