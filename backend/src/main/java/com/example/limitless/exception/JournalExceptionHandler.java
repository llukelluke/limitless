package com.example.limitless.exception;

import com.example.limitless.service.ErrorMessageService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/** Separate from GlobalExceptionHandler so that file stays untouched. */
@RestControllerAdvice
public class JournalExceptionHandler {

    private final ErrorMessageService messages;

    public JournalExceptionHandler(ErrorMessageService messages) {
        this.messages = messages;
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(ValidationException e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "Bad Request");
        body.put("message", e.getMessage());
        body.put("errors", e.getIssues());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleTooLarge(MaxUploadSizeExceededException e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "Payload Too Large");
        body.put("message", messages.get("ATT_003"));
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(body);
    }
}
