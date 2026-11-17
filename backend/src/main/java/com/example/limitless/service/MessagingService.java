package com.example.limitless.service;

import com.example.limitless.dto.EmailSendRequest;
import com.example.limitless.dto.RecipientResponse;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.UserRepository;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * In-app email for every role: anyone can email any active user, whatever either person's role.
 * Administrators can also reach suspended or deactivated users (as on the old admin-only endpoint).
 * Files can be attached; they follow the journal attachment rules.
 */
@Service
public class MessagingService {

    private final UserRepository users;
    private final EmailService email;
    private final ErrorMessageService msgs;

    private final AttachmentService attachments;

    public MessagingService(UserRepository users, EmailService email, ErrorMessageService msgs, AttachmentService attachments) {
        this.users = users;
        this.email = email;
        this.msgs = msgs;
        this.attachments = attachments;
    }

    public List<RecipientResponse> recipients(User sender) {
        return users.findAll().stream()
                .filter(u -> u.getStatus() == User.UserStatus.ACTIVATED && !u.getId().equals(sender.getId()))
                .map(u -> new RecipientResponse(u.getId(), name(u), u.getRole().name()))
                .toList();
    }

    public void send(User sender, EmailSendRequest req, List<MultipartFile> files) {
        if (req == null || req.recipientUserId() == null || blank(req.subject()) || blank(req.body())) {
            throw new UserException(HttpStatus.BAD_REQUEST, msgs.get("EML_001"));
        }
        User to = users.findById(req.recipientUserId())
                .orElseThrow(() -> new UserException(HttpStatus.NOT_FOUND, msgs.get("EML_003")));
        boolean reachable = sender.getRole() == User.UserRole.ADMINISTRATOR
                ? to.getUsername() != null
                : to.getStatus() == User.UserStatus.ACTIVATED;
        if (!reachable) throw new UserException(HttpStatus.FORBIDDEN, msgs.get("EML_002"));

        List<EmailService.Attachment> attached = new ArrayList<>();
        for (MultipartFile f : files == null ? List.<MultipartFile>of() : files) {
            String name = attachments.check(f);
            try {
                attached.add(new EmailService.Attachment(name, f.getBytes()));
            } catch (IOException e) {
                throw new UserException(HttpStatus.BAD_REQUEST, msgs.get("ATT_002"));
            }
        }
        String body = "From: " + name(sender) + " (" + sender.getRole().name() + ")\n\n" + req.body().trim();
        email.send(to.getEmailAddress(), req.subject().trim(), body, attached);
    }

    private static String name(User u) {
        return ((u.getFirstName() == null ? "" : u.getFirstName()) + " " + (u.getLastName() == null ? "" : u.getLastName())).trim();
    }

    private static boolean blank(String s) { return s == null || s.isBlank(); }
}
