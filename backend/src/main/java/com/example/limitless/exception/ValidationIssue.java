package com.example.limitless.exception;

/** One problem found in a journal entry. The frontend shows each message in red. */
public record ValidationIssue(String code, String message) {}
