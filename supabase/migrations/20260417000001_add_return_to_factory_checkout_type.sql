-- Migration: Allow 'return_to_factory' as a valid checkout_type
-- Existing constraint only allows: 'pending', 'group', 'early'

ALTER TABLE "public"."onsite_session_members"
  DROP CONSTRAINT IF EXISTS "onsite_session_members_checkout_type_check";

ALTER TABLE "public"."onsite_session_members"
  ADD CONSTRAINT "onsite_session_members_checkout_type_check"
    CHECK (checkout_type = ANY (ARRAY[
      'pending'::text,
      'group'::text,
      'early'::text,
      'return_to_factory'::text
    ]));
