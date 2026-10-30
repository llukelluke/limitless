package com.example.limitless.service;

import com.example.limitless.dto.AttachmentResponse;
import com.example.limitless.entity.JournalAttachments;
import com.example.limitless.entity.JournalEntry;
import com.example.limitless.exception.UserException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** Stores source documents on disk (uploads.dir). Rows live in journal_attachments. */
@Service
public class AttachmentService {

    private static final long MAX_BYTES = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED = Set.of("pdf", "doc", "docx", "xls", "xlsx", "csv", "jpg", "jpeg", "png");
    private static final Map<String, String> CONTENT_TYPES = Map.of(
            "pdf", "application/pdf",
            "doc", "application/msword",
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xls", "application/vnd.ms-excel",
            "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "csv", "text/csv",
            "jpg", "image/jpeg",
            "jpeg", "image/jpeg",
            "png", "image/png");

    public record Download(Resource resource, String filename, String contentType) {}

    private final Path baseDir;
    private final ErrorMessageService messages;

    public AttachmentService(@Value("${uploads.dir:./uploads}") String dir, ErrorMessageService messages) {
        this.baseDir = Paths.get(dir).toAbsolutePath().normalize();
        this.messages = messages;
    }

    /** Validates and stores the file, adds the row to the entry (caller saves the entry). */
    public JournalAttachments store(JournalEntry entry, MultipartFile file) {
        if (file == null || file.isEmpty()) throw new UserException(HttpStatus.BAD_REQUEST, messages.get("ATT_002"));
        if (file.getSize() > MAX_BYTES) throw new UserException(HttpStatus.PAYLOAD_TOO_LARGE, messages.get("ATT_003"));

        String original = cleanName(file.getOriginalFilename());
        String ext = extension(original);
        if (!ALLOWED.contains(ext)) throw new UserException(HttpStatus.BAD_REQUEST, messages.get("ATT_001"));

        String relative = entry.getId() + "/" + UUID.randomUUID() + "." + ext;
        Path target = baseDir.resolve(relative).normalize();
        if (!target.startsWith(baseDir)) throw new UserException(HttpStatus.BAD_REQUEST, messages.get("ATT_001"));
        try {
            Files.createDirectories(target.getParent());
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new UserException(HttpStatus.INTERNAL_SERVER_ERROR, "The file could not be saved.");
        }
        JournalAttachments att = new JournalAttachments(entry, relative, ext, original);
        entry.getAttachments().add(att);
        return att;
    }

    public Download load(JournalAttachments att) {
        Path p = baseDir.resolve(att.getFilePath()).normalize();
        if (!p.startsWith(baseDir) || !Files.exists(p)) {
            throw new UserException(HttpStatus.NOT_FOUND, messages.get("ATT_004"));
        }
        String type = CONTENT_TYPES.getOrDefault(att.getFileType(), "application/octet-stream");
        return new Download(new FileSystemResource(p), att.getOriginalName(), type);
    }

    public void deleteFile(JournalAttachments att) {
        try {
            Path p = baseDir.resolve(att.getFilePath()).normalize();
            if (p.startsWith(baseDir)) Files.deleteIfExists(p);
        } catch (IOException ignored) {
            // a leftover file is harmless; the row is what matters
        }
    }

    public AttachmentResponse toResponse(JournalAttachments a) {
        return new AttachmentResponse(a.getId(), a.getOriginalName(), a.getFileType(), a.getUploadedAt());
    }

    private static String cleanName(String name) {
        if (name == null || name.isBlank()) return "file";
        String n = name.replaceAll("[\\\\/]+", "_").replaceAll("[\\p{Cntrl}\"]", "");
        return n.length() > 200 ? n.substring(n.length() - 200) : n;
    }

    private static String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
