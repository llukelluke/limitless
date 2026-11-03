package com.example.limitless.controller;

import com.example.limitless.dto.*;
import com.example.limitless.service.UserService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public List<UserResponse> getAll() {
        return userService.getAllUsers().stream().map(UserResponse::from).toList();
    }

    @GetMapping("/{id}")
    public UserResponse getOne(@PathVariable Integer id) {
        return UserResponse.from(userService.getUserById(id));
    }

    @PostMapping
    public ResponseEntity<CreateUserResponse> create(@RequestBody CreateUserRequest req,
                                                     Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userService.createUser(req, auth.getName()));
    }

    @PutMapping("/{id}")
    public UserResponse update(@PathVariable Integer id, @RequestBody UpdateUserRequest req) {
        return UserResponse.from(userService.updateUser(id, req));
    }

    @PutMapping("/{id}/activate")
    public UserResponse activate(@PathVariable Integer id) {
        return UserResponse.from(userService.activateUser(id));
    }

    @PutMapping("/{id}/deactivate")
    public UserResponse deactivate(@PathVariable Integer id) {
        return UserResponse.from(userService.deactivateUser(id));
    }

    @PutMapping("/{id}/suspend")
    public UserResponse suspend(@PathVariable Integer id, @RequestBody SuspendRequest req) {
        return UserResponse.from(userService.suspendUser(id, req));
    }

    /** Issues a new 24-hour temporary password, e.g. after the previous one expired. Shown to the admin once. */
    @PostMapping("/{id}/temporary-password")
    public java.util.Map<String, String> temporaryPassword(@PathVariable Integer id) {
        return java.util.Map.of("temporary_password", userService.issueTemporaryPassword(id));
    }

    // Reports
    @GetMapping("/reports/all")
    public List<UserResponse> reportAll() {
        return userService.getAllUsers().stream().map(UserResponse::from).toList();
    }

    @GetMapping("/reports/expired-passwords")
    public List<UserResponse> reportExpiredPasswords() {
        return userService.getUsersWithExpiredPasswords().stream().map(UserResponse::from).toList();
    }
}