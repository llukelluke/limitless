package com.example.limitless.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "journal_attachments")
public class JournalAttachments {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "journal_entry_id", nullable = false)
    private JournalEntry journalEntryID;

    @Column(name = "file_path", length = 255)
    private String filePath;

    @Column(name = "file_type", length = 10)
    private String fileType;

    @Column(name = "original_name")
    private String originalName;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    public JournalAttachments(JournalEntry journalEntryID, String filePath, String fileType, String originalName) {
        this.journalEntryID = journalEntryID;
        this.filePath = filePath;
        this.fileType = fileType;
        this.originalName = originalName;
    }
}
