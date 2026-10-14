package com.example.limitless.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Sends email through Resend's HTTP API (works on Railway, which blocks SMTP
 * on most plans). If RESEND_API_KEY is not set, it just logs the email like
 * before, so local dev still works with no setup.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final String apiKey;
    private final String from;
    private final String overrideTo;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public EmailService(@Value("${email.resend-api-key:}") String apiKey,
                        @Value("${email.from:Limitless <onboarding@resend.dev>}") String from,
                        @Value("${email.override-to:}") String overrideTo) {
        this.apiKey = apiKey;
        this.from = from;
        this.overrideTo = overrideTo;
    }

    public void send(String to, String subject, String body) {
        if (apiKey == null || apiKey.isBlank()) {
            log.info("\n=== EMAIL (not sent, no API key) ===\nTo: {}\nSubject: {}\n\n{}\n=============", to, subject, body);
            return;
        }
        // Demo mode: send everything to one inbox, noting the real recipient
        if (overrideTo != null && !overrideTo.isBlank()) {
            subject = "[to: " + to + "] " + subject;
            to = overrideTo;
        }
        String json = "{\"from\":" + q(from) + ",\"to\":[" + q(to) + "],\"subject\":" + q(subject)
                + ",\"text\":" + q(body) + "}";
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.resend.com/emails"))
                    .timeout(Duration.ofSeconds(15))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() >= 300) {
                log.error("Email to {} failed: {} {}", to, res.statusCode(), res.body());
            } else {
                log.info("Email sent to {} ({})", to, subject);
            }
        } catch (Exception e) {
            // Never let an email failure break the request that triggered it
            log.error("Email to {} failed", to, e);
        }
    }

    /** Minimal JSON string quoting. */
    private static String q(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (char c : (s == null ? "" : s).toCharArray()) {
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        return sb.append('"').toString();
    }
}