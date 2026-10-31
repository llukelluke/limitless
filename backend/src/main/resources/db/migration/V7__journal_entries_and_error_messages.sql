-- Sprint 3: journalizing + ledger support

-- Drafts and pending entries have no reviewer yet, so reviewed_by can't be NOT NULL.
ALTER TABLE journal_entries MODIFY COLUMN reviewed_by INTEGER NULL;

-- Ledger "description" column comes from the entry's description.
ALTER TABLE journal_entries ADD COLUMN description VARCHAR(255) NULL;

-- Keep the user's original file name for display/download; file_path holds the stored name.
ALTER TABLE journal_attachments ADD COLUMN original_name VARCHAR(255) NULL;

-- Error messages for journalizing, attachments, email, and ledger (Sprint 3 requires them in a table).
-- {line}, {debits}, etc. are placeholders filled in by ErrorMessageService.
INSERT IGNORE INTO error_messages (error_code, message) VALUES
                                                            ('ACC_001', 'Account doesn''t exist.'),
                                                            ('JRN_001', 'A journal entry date is required.'),
                                                            ('JRN_002', 'Entry type must be REGULAR or ADJUSTING.'),
                                                            ('JRN_003', 'A journal entry must have at least one debit.'),
                                                            ('JRN_004', 'A journal entry must have at least one credit.'),
                                                            ('JRN_005', 'Total debits ({debits}) must equal total credits ({credits}). The difference is {difference}.'),
                                                            ('JRN_006', 'Line {line}: select an account.'),
                                                            ('JRN_007', 'Line {line}: this account is not in the chart of accounts.'),
                                                            ('JRN_008', 'Line {line}: account "{account}" is deactivated and cannot be used.'),
                                                            ('JRN_009', 'Line {line}: choose DEBIT or CREDIT.'),
                                                            ('JRN_010', 'Line {line}: enter an amount.'),
                                                            ('JRN_011', 'Line {line}: the amount must be greater than zero.'),
                                                            ('JRN_012', 'Line {line}: amounts can have at most two decimal places.'),
                                                            ('JRN_013', 'Journal entry doesn''t exist.'),
                                                            ('JRN_014', 'Only a draft journal entry can be changed, cancelled, or submitted.'),
                                                            ('JRN_015', 'You can only change your own draft journal entries.'),
                                                            ('JRN_016', 'Only a journal entry that is pending approval can be approved or rejected.'),
                                                            ('JRN_017', 'A reason is required when rejecting a journal entry.'),
                                                            ('JRN_018', 'Add at least one debit line and one credit line.'),
                                                            ('JRN_019', 'The description cannot be longer than 255 characters.'),
                                                            ('JRN_020', 'Status must be DRAFT, PENDING, APPROVED, or REJECTED.'),
                                                            ('ATT_001', 'Attachments must be PDF, Word, Excel, CSV, JPG, or PNG files.'),
                                                            ('ATT_002', 'The attached file is empty.'),
                                                            ('ATT_003', 'The attached file is larger than 10 MB.'),
                                                            ('ATT_004', 'Attachment doesn''t exist.'),
                                                            ('EML_001', 'Recipient, subject, and message are all required.'),
                                                            ('EML_002', 'You cannot send email to this user.'),
                                                            ('EML_003', 'Recipient doesn''t exist.');
