package com.example.limitless.service;

import com.example.limitless.repository.ErrorMessageRepository;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Looks up user-facing error text from the error_messages table (Sprint 3 requirement).
 * Placeholders like {line} are filled from name/value pairs:
 *   get("JRN_006", "line", 2)
 */
@Service
public class ErrorMessageService {

    private final ErrorMessageRepository repo;
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    public ErrorMessageService(ErrorMessageRepository repo) {
        this.repo = repo;
    }

    public String get(String code, Object... namesAndValues) {
        String text = cache.get(code);
        if (text == null) {
            text = repo.findByErrorCode(code).map(e -> e.getMessage()).orElse(null);
            if (text == null) return code; // never hide an error just because its row is missing
            cache.put(code, text);
        }
        for (int i = 0; i + 1 < namesAndValues.length; i += 2) {
            text = text.replace("{" + namesAndValues[i] + "}", String.valueOf(namesAndValues[i + 1]));
        }
        return text;
    }
}
