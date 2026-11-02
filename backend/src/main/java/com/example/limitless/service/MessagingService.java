package com.example.limitless.service;

import com.example.limitless.dto.EmailSendRequest;
import com.example.limitless.dto.RecipientResponse;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.repository.UserRepository;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * "Send email from the account page" for every role.
 *   Administrator -> Manager, Accountant
 *   Accountant    -> Manager, Administrator
 *   Manager       -> Administrator, Accountant   (not specified in the sprint; chosen to mirror the others)
 */
@Service
public class MessagingService {

    private final UserRepository users;
    private final EmailService email;
    private final ErrorMessageService msgs;

    public MessagingService(UserRepository users, EmailService email, ErrorMessageService msgs) {
        this.users = users;
        this.email = email;
        this.msgs = msgs;
    }

    public List<RecipientResponse> recipients(User sender) {
        Set<User.UserRole> allowed = allowedTargets(sender.getRole());
        return allowed.stream()
                .flatMap(r -> users.findByRole(r).stream())
                .filter(u -> u.getStatus() == User.UserStatus.ACTIVATED && !u.getId().equals(sender.getId()))
                .map(u -> new RecipientResponse(u.getId(), name(u), u.getRole().name()))
                .toList();
    }

    public void send(User sender, EmailSendRequest req) {
        if (req == null || req.recipientUserId() == null || blank(req.subject()) || blank(req.body())) {
            throw new UserException(HttpStatus.BAD_REQUEST, msgs.get("EML_001"));
        }
        User to = users.findById(req.recipientUserId())
                .orElseThrow(() -> new UserException(HttpStatus.NOT_FOUND, msgs.get("EML_003")));
        if (!allowedTargets(sender.getRole()).contains(to.getRole()) || to.getStatus() != User.UserStatus.ACTIVATED) {
            throw new UserException(HttpStatus.FORBIDDEN, msgs.get("EML_002"));
        }
        String body = "From: " + name(sender) + " (" + sender.getRole().name() + ")\n\n" + req.body().trim();
        email.send(to.getEmailAddress(), req.subject().trim(), body);
    }

    private static Set<User.UserRole> allowedTargets(User.UserRole role) {
        return switch (role) {
            case ADMINISTRATOR -> EnumSet.of(User.UserRole.MANAGER, User.UserRole.ACCOUNTANT);
            case ACCOUNTANT -> EnumSet.of(User.UserRole.MANAGER, User.UserRole.ADMINISTRATOR);
            case MANAGER -> EnumSet.of(User.UserRole.ADMINISTRATOR, User.UserRole.ACCOUNTANT);
        };
    }

    private static String name(User u) {
        return ((u.getFirstName() == null ? "" : u.getFirstName()) + " " + (u.getLastName() == null ? "" : u.getLastName())).trim();
    }

    private static boolean blank(String s) { return s == null || s.isBlank(); }
}
