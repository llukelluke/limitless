package com.example.limitless.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "journal_entries")
public class JournalEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @ManyToOne
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "entry_date")
    private LocalDate entryDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type")
    private JournalEntryType entryType;

    @Enumerated(EnumType.STRING)
    private JournalStatus status;

    @Column(length = 255)
    private String description;

    @Column(length = 255)
    private String comment;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "entry", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<JournalEntryLines> lines = new ArrayList<>();

    @OneToMany(mappedBy = "entry", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<JournalAttachments> attachments = new ArrayList<>();

    public enum JournalEntryType {REGULAR, ADJUSTING}

    public enum JournalStatus {DRAFT, SUBMITTED, APPROVED, REJECTED}
}
