-- Sprint 4: financial statements

-- saved_statements.statement_type was an ENUM without the retained earnings statement.
-- A plain VARCHAR avoids another enum mismatch; the app maps it with @Enumerated(STRING).
ALTER TABLE saved_statements MODIFY COLUMN statement_type VARCHAR(30) NOT NULL;
ALTER TABLE saved_statements MODIFY COLUMN file_path VARCHAR(500) NULL;

-- Error messages for the statements module (kept in the table, like the other modules).
INSERT IGNORE INTO error_messages (error_code, message) VALUES
                                                            ('STM_001', 'Enter a date, or both a from date and a to date.'),
                                                            ('STM_002', 'The from date must be on or before the to date.'),
                                                            ('STM_003', 'Statement type must be trial-balance, income-statement, balance-sheet, or retained-earnings.'),
                                                            ('STM_004', 'Choose an active user to send the statement to.'),
                                                            ('STM_005', 'Saved statement doesn''t exist.'),
                                                            ('STM_006', 'The statement file could not be saved or found.');
