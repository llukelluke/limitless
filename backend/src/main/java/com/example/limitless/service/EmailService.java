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
import java.util.List;
import java.util.Base64;

/**
 * Sends email through Resend's HTTP API (works on Railway, which blocks SMTP
 * on most plans). If email.resend-api-key is not set, it just logs the email,
 * so local dev still works with no setup.
 *
 * Sprint 4: added sendHtml(...) for emailing financial statements. send(...) is unchanged.
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

    public record Attachment(String filename, byte[] content) {}

    /** Plain-text email. */
    public void send(String to, String subject, String body) {
        send(to, subject, body, List.of());
    }

    /** Plain-text email with files attached. */
    public void send(String to, String subject, String body, List<Attachment> attachments) {
        StringBuilder json = new StringBuilder("\"text\":").append(q(body));
        if (!attachments.isEmpty()) {
            json.append(",\"attachments\":[");
            for (int i = 0; i < attachments.size(); i++) {
                Attachment a = attachments.get(i);
                if (i > 0) json.append(',');
                json.append("{\"filename\":").append(q(a.filename()))
                        .append(",\"content\":").append(q(Base64.getEncoder().encodeToString(a.content()))).append('}');
            }
            json.append(']');
        }
        String log = attachments.isEmpty() ? body
                : body + "\n\nAttachments: " + String.join(", ", attachments.stream().map(Attachment::filename).toList());
        deliver(to, subject, json.toString(), log);
    }

    /** HTML email with a plain-text fallback. */
    public void sendHtml(String to, String subject, String html, String text) {
        deliver(to, subject, "\"html\":" + q(html) + ",\"text\":" + q(text), text);
    }

    private void deliver(String to, String subject, String contentJson, String logBody) {
        if (apiKey == null || apiKey.isBlank()) {
            log.info("\n=== EMAIL (not sent, no API key) ===\nTo: {}\nSubject: {}\n\n{}\n=============", to, subject, logBody);
            return;
        }
        // Demo mode: send everything to one inbox, noting the real recipient
        if (overrideTo != null && !overrideTo.isBlank()) {
            subject = "[to: " + to + "] " + subject;
            to = overrideTo;
        }
        String json = "{\"from\":" + q(from) + ",\"to\":[" + q(to) + "],\"subject\":" + q(subject)
                + "," + contentJson + "}";
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
