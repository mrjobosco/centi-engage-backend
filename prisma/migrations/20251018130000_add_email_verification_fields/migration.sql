-- Add email verification fields to User model
-- This migration adds email verification tracking fields to support OTP verification

-- Add email verification columns to users table
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN verification_token_sent_at TIMESTAMP NULL;

-- Add index for email verification queries
CREATE INDEX idx_users_email_verified ON users(email_verified);

-- Update existing OAuth users to have verified emails (Google OAuth users should be pre-verified)
UPDATE users 
SET email_verified = TRUE, email_verified_at = NOW() 
WHERE google_id IS NOT NULL AND google_linked_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address via OTP or OAuth';
COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when the email was verified';
COMMENT ON COLUMN users.verification_token_sent_at IS 'Timestamp when the last OTP was sent for verification';