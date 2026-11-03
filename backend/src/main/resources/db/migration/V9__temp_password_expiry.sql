-- A temporary password (from an admin or an approved access request) stops working after this time.
-- NULL once the user sets their own password.
ALTER TABLE users ADD COLUMN temp_password_expires_at DATETIME NULL;
