-- Allow accounts with no password.
--
-- A user who signs in through Google never sets one, so the column cannot stay
-- NOT NULL. Dropping a NOT NULL constraint is not destructive and does not
-- rewrite the table — existing rows keep their hashes.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
