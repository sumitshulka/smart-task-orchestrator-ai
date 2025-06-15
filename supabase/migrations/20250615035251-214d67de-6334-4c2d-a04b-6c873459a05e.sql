
-- Add a UNIQUE constraint to the email column of the users table
-- This will prevent duplicate emails in the users table

ALTER TABLE public.users
ADD CONSTRAINT users_email_unique UNIQUE (email);

