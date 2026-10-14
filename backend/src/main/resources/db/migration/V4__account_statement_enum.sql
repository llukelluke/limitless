ALTER TABLE accounts
MODIFY COLUMN statement ENUM('Income Statement', 'Balance Sheet', 'Retained Earnings statement', 'Trial Balance');