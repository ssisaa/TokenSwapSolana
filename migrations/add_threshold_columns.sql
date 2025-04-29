-- Add stake_threshold and unstake_threshold columns to admin_settings table
ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS stake_threshold DECIMAL DEFAULT 10.0 NOT NULL,
ADD COLUMN IF NOT EXISTS unstake_threshold DECIMAL DEFAULT 10.0 NOT NULL;