package com.example.limitless.exception;

import java.util.List;

public class ValidationException extends RuntimeException {
    private final List<ValidationIssue> issues;

    public ValidationException(List<ValidationIssue> issues) {
        super(issues.isEmpty() ? "Validation failed." : issues.get(0).message());
        this.issues = issues;
    }

    public List<ValidationIssue> getIssues() { return issues; }
}
