-- Sprint 5: closing and reversing journal entries.

-- Like saved_statements.statement_type (V10): a VARCHAR avoids another enum mismatch; the app maps it with @Enumerated(STRING).
ALTER TABLE journal_entries MODIFY COLUMN entry_type VARCHAR(20) NULL;

UPDATE error_messages SET message = 'Entry type must be REGULAR, ADJUSTING, CLOSING, or REVERSING.' WHERE error_code = 'JRN_002';
