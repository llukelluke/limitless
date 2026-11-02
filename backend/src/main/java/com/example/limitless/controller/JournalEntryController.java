package com.example.limitless.controller;

import com.example.limitless.dto.*;
import com.example.limitless.entity.User;
import com.example.limitless.exception.UserException;
import com.example.limitless.exception.ValidationIssue;
import com.example.limitless.repository.UserRepository;
import com.example.limitless.service.AttachmentService;
import com.example.limitless.service.JournalEntryService;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * Who can do what is enforced in SecurityConfig (see SecurityConfig-patch.txt):
 *   GET                    all roles
 *   approve / reject       MANAGER
 *   everything else        MANAGER or ACCOUNTANT
 */
@RestController
@RequestMapping("/api/journal-entries")
public class JournalEntryController {

    private final JournalEntryService service;
    private final UserRepository users;

    public JournalEntryController(JournalEntryService service, UserRepository users) {
        this.service = service;
        this.users = users;
    }

    @GetMapping
    public List<JournalEntryResponse> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String search,
            Authentication auth) {
        return service.list(status, from, to, search, actor(auth));
    }

    @GetMapping("/pending-count")
    public Map<String, Object> pendingCount() {
        return Map.of("count", service.pendingCount());
    }

    @GetMapping("/{id}")
    public JournalEntryResponse get(@PathVariable Integer id, Authentication auth) {
        return service.get(id, actor(auth));
    }

    @PostMapping
    public ResponseEntity<JournalEntryResponse> create(@RequestBody JournalEntryRequest req, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req, actor(auth)));
    }

    /** Dry run for live error display: returns every problem without saving anything. */
    @PostMapping("/validate")
    public Map<String, Object> validate(@RequestBody JournalEntryRequest req) {
        List<ValidationIssue> errors = service.validate(req, true);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("valid", errors.isEmpty());
        body.put("errors", errors);
        return body;
    }

    @PutMapping("/{id}")
    public JournalEntryResponse update(@PathVariable Integer id, @RequestBody JournalEntryRequest req,
                                       Authentication auth) {
        return service.update(id, req, actor(auth));
    }

    /** Cancel/reset a draft. Submitted entries cannot be deleted. */
    @DeleteMapping("/{id}")
    public Map<String, String> cancel(@PathVariable Integer id, Authentication auth) {
        service.cancel(id, actor(auth));
        return Map.of("message", "Journal entry cancelled.");
    }

    @PostMapping("/{id}/submit")
    public JournalEntryResponse submit(@PathVariable Integer id, Authentication auth) {
        return service.submit(id, actor(auth));
    }

    @PutMapping("/{id}/approve")
    public JournalEntryResponse approve(@PathVariable Integer id, Authentication auth) {
        return service.approve(id, actor(auth));
    }

    @PutMapping("/{id}/reject")
    public JournalEntryResponse reject(@PathVariable Integer id, @RequestBody RejectRequest req, Authentication auth) {
        return service.reject(id, req == null ? null : req.comment(), actor(auth));
    }

    // ---------- attachments ----------

    @PostMapping(path = "/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentResponse> upload(@PathVariable Integer id,
                                                     @RequestParam("file") MultipartFile file,
                                                     Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addAttachment(id, file, actor(auth)));
    }

    @GetMapping("/{id}/attachments/{attachmentId}")
    public ResponseEntity<org.springframework.core.io.Resource> download(@PathVariable Integer id,
                                                                         @PathVariable Integer attachmentId,
                                                                         Authentication auth) {
        AttachmentService.Download d = service.downloadAttachment(id, attachmentId, actor(auth));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(d.filename()).build().toString())
                .contentType(MediaType.parseMediaType(d.contentType()))
                .body(d.resource());
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    public Map<String, String> deleteAttachment(@PathVariable Integer id, @PathVariable Integer attachmentId,
                                                Authentication auth) {
        service.deleteAttachment(id, attachmentId, actor(auth));
        return Map.of("message", "Attachment removed.");
    }

    private User actor(Authentication auth) {
        return users.findByUsername(auth.getName())
                .orElseThrow(() -> new UserException(HttpStatus.UNAUTHORIZED, "Logged-in user not found."));
    }
}
