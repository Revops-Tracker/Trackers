-- Rule questions on the RTB Review Panel (public.bad_data_review).
--
-- Deploy this migration BEFORE the bad-data-review edge function that inserts
-- item_type = 'rule_question' and writes the answer column. Existing bad_data and
-- medium_confidence rows stay valid: answer is null, and their statuses stay
-- pending, ticked, or crossed. Nothing here writes to HubSpot.
--
-- The queue is small, so the replacement checks are added already valid.
-- That takes a brief lock on this table only.

alter table public.bad_data_review
  add column if not exists answer text;

comment on column public.bad_data_review.answer is
  'Free-text reviewer answer for item_type = rule_question. Null on every bad_data and medium_confidence row, and null while a rule question is still pending.';

alter table public.bad_data_review drop constraint if exists bad_data_review_item_type_check;
alter table public.bad_data_review
  add constraint bad_data_review_item_type_check
  check (item_type = any (array['bad_data'::text, 'medium_confidence'::text, 'rule_question'::text]));

alter table public.bad_data_review drop constraint if exists bad_data_review_status_check;
alter table public.bad_data_review
  add constraint bad_data_review_status_check
  check (status = any (array['pending'::text, 'ticked'::text, 'crossed'::text, 'answered'::text]));

-- A rule question is not a lead: it needs the question (reason) and a bot-supplied
-- dedupe key rule:<slug>. contact_id and linkedin_url stay optional and unused.
alter table public.bad_data_review drop constraint if exists bad_data_review_rule_required;
alter table public.bad_data_review
  add constraint bad_data_review_rule_required
  check (
    item_type <> 'rule_question'::text
    or (
      lead_key is not null
      and reason is not null
      and btrim(reason) <> ''
      and lead_key ~ '^rule:[A-Za-z0-9][A-Za-z0-9_.:-]{0,194}$'
    )
  );

-- answered belongs only to a rule question, and only together with a non-blank answer.
-- bad_data and medium_confidence stay on pending / ticked / crossed with no answer,
-- so a confirmed medium row is still status = ticked.
alter table public.bad_data_review drop constraint if exists bad_data_review_type_status_check;
alter table public.bad_data_review
  add constraint bad_data_review_type_status_check
  check (
    (
      item_type = any (array['bad_data'::text, 'medium_confidence'::text])
      and status = any (array['pending'::text, 'ticked'::text, 'crossed'::text])
      and answer is null
    )
    or (
      item_type = 'rule_question'::text
      and (
        (status = 'pending'::text and answer is null)
        or (
          status = 'answered'::text
          and answer is not null
          and btrim(answer) <> ''
        )
      )
    )
  );

-- One pending question per lead_key. Decided questions can be posted again.
-- Separate from bad_data_review_pending_lead_uq, which stays medium_confidence only.
create unique index if not exists bad_data_review_pending_rule_uq
  on public.bad_data_review (lead_key)
  where status = 'pending'
    and item_type = 'rule_question'
    and lead_key is not null;

-- New column follows the table grants. anon and authenticated stay locked out;
-- the edge function uses the service role. RLS is already on, with no policies.
revoke all on table public.bad_data_review from anon, authenticated;
