drop policy "Users can manage their own OT requests" on "public"."ot_requests";

alter table "public"."daily_report_items" drop constraint "daily_report_items_end_user_id_fkey";

alter table "public"."daily_report_items" drop constraint "daily_report_items_project_id_fkey";


  create table "public"."leave_requests" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "leave_type" text not null,
    "start_date" date not null,
    "end_date" date not null,
    "days" integer generated always as (((end_date - start_date) + 1)) stored,
    "reason" text not null,
    "status" text not null default 'pending'::text,
    "approved_by" uuid,
    "reject_reason" text,
    "actioned_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "period_label" text
      );


alter table "public"."leave_requests" enable row level security;


  create table "public"."onsite_session_members" (
    "id" uuid not null default gen_random_uuid(),
    "session_id" uuid not null,
    "user_id" uuid not null,
    "role" text not null default 'member'::text,
    "checkout_type" text default 'pending'::text,
    "early_checkout_at" timestamp with time zone,
    "early_checkout_note" text,
    "joined_at" timestamp with time zone default now()
      );



  create table "public"."onsite_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "leader_id" uuid not null,
    "site_name" text not null,
    "project_id" uuid,
    "status" text not null default 'open'::text,
    "group_check_in" timestamp with time zone,
    "group_check_out" timestamp with time zone,
    "session_code" text,
    "session_date" date not null default CURRENT_DATE,
    "created_at" timestamp with time zone default now(),
    "closed_at" timestamp with time zone
      );



  create table "public"."push_subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "subscription" jsonb not null,
    "user_agent" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."push_subscriptions" enable row level security;

alter table "public"."daily_time_logs" add column "auto_checked_out" boolean default false;

alter table "public"."daily_time_logs" add column "daily_allowance" boolean;

alter table "public"."daily_time_logs" add column "day_type" text not null default 'workday'::text;

alter table "public"."daily_time_logs" add column "holiday_name" text;

alter table "public"."daily_time_logs" add column "onsite_session_id" uuid;

alter table "public"."daily_time_logs" add column "ot_intent" boolean default false;

alter table "public"."daily_time_logs" add column "pay_multiplier" numeric(3,1) not null default 1.0;

alter table "public"."ot_requests" drop column "task_detail";

alter table "public"."ot_requests" add column "actioned_at" timestamp with time zone;

alter table "public"."ot_requests" add column "hours" numeric(5,2);

alter table "public"."ot_requests" add column "project_id" uuid;

alter table "public"."ot_requests" add column "reason" text not null;

alter table "public"."ot_requests" add column "reject_reason" text;

alter table "public"."ot_requests" alter column "created_at" set default now();

alter table "public"."ot_requests" alter column "status" set not null;

alter table "public"."profiles" add column "avatar_url" text;

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);

CREATE INDEX idx_leave_requests_user_id ON public.leave_requests USING btree (user_id);

CREATE INDEX idx_onsite_session_members_session ON public.onsite_session_members USING btree (session_id);

CREATE INDEX idx_onsite_session_members_user ON public.onsite_session_members USING btree (user_id);

CREATE INDEX idx_onsite_sessions_leader_date ON public.onsite_sessions USING btree (leader_id, session_date);

CREATE INDEX idx_onsite_sessions_status ON public.onsite_sessions USING btree (status);

CREATE INDEX idx_ot_requests_date ON public.ot_requests USING btree (request_date);

CREATE INDEX idx_ot_requests_status ON public.ot_requests USING btree (status);

CREATE INDEX idx_ot_requests_user_id ON public.ot_requests USING btree (user_id);

CREATE UNIQUE INDEX idx_push_sub_user_endpoint ON public.push_subscriptions USING btree (user_id, ((subscription ->> 'endpoint'::text)));

CREATE UNIQUE INDEX leave_requests_pkey ON public.leave_requests USING btree (id);

CREATE UNIQUE INDEX onsite_session_members_pkey ON public.onsite_session_members USING btree (id);

CREATE UNIQUE INDEX onsite_session_members_session_id_user_id_key ON public.onsite_session_members USING btree (session_id, user_id);

CREATE UNIQUE INDEX onsite_sessions_pkey ON public.onsite_sessions USING btree (id);

CREATE UNIQUE INDEX onsite_sessions_session_code_key ON public.onsite_sessions USING btree (session_code);

CREATE UNIQUE INDEX push_subscriptions_pkey ON public.push_subscriptions USING btree (id);

alter table "public"."leave_requests" add constraint "leave_requests_pkey" PRIMARY KEY using index "leave_requests_pkey";

alter table "public"."onsite_session_members" add constraint "onsite_session_members_pkey" PRIMARY KEY using index "onsite_session_members_pkey";

alter table "public"."onsite_sessions" add constraint "onsite_sessions_pkey" PRIMARY KEY using index "onsite_sessions_pkey";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY using index "push_subscriptions_pkey";

alter table "public"."daily_time_logs" add constraint "daily_time_logs_onsite_session_id_fkey" FOREIGN KEY (onsite_session_id) REFERENCES public.onsite_sessions(id) not valid;

alter table "public"."daily_time_logs" validate constraint "daily_time_logs_onsite_session_id_fkey";

alter table "public"."leave_requests" add constraint "leave_dates_valid" CHECK ((end_date >= start_date)) not valid;

alter table "public"."leave_requests" validate constraint "leave_dates_valid";

alter table "public"."leave_requests" add constraint "leave_requests_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id) not valid;

alter table "public"."leave_requests" validate constraint "leave_requests_approved_by_fkey";

alter table "public"."leave_requests" add constraint "leave_requests_leave_type_check" CHECK ((leave_type = ANY (ARRAY['sick'::text, 'personal'::text, 'vacation'::text, 'maternity'::text]))) not valid;

alter table "public"."leave_requests" validate constraint "leave_requests_leave_type_check";

alter table "public"."leave_requests" add constraint "leave_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."leave_requests" validate constraint "leave_requests_status_check";

alter table "public"."leave_requests" add constraint "leave_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."leave_requests" validate constraint "leave_requests_user_id_fkey";

alter table "public"."onsite_session_members" add constraint "onsite_session_members_checkout_type_check" CHECK ((checkout_type = ANY (ARRAY['pending'::text, 'group'::text, 'early'::text]))) not valid;

alter table "public"."onsite_session_members" validate constraint "onsite_session_members_checkout_type_check";

alter table "public"."onsite_session_members" add constraint "onsite_session_members_role_check" CHECK ((role = ANY (ARRAY['leader'::text, 'member'::text]))) not valid;

alter table "public"."onsite_session_members" validate constraint "onsite_session_members_role_check";

alter table "public"."onsite_session_members" add constraint "onsite_session_members_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.onsite_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."onsite_session_members" validate constraint "onsite_session_members_session_id_fkey";

alter table "public"."onsite_session_members" add constraint "onsite_session_members_session_id_user_id_key" UNIQUE using index "onsite_session_members_session_id_user_id_key";

alter table "public"."onsite_session_members" add constraint "onsite_session_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."onsite_session_members" validate constraint "onsite_session_members_user_id_fkey";

alter table "public"."onsite_sessions" add constraint "onsite_sessions_leader_id_fkey" FOREIGN KEY (leader_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."onsite_sessions" validate constraint "onsite_sessions_leader_id_fkey";

alter table "public"."onsite_sessions" add constraint "onsite_sessions_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) not valid;

alter table "public"."onsite_sessions" validate constraint "onsite_sessions_project_id_fkey";

alter table "public"."onsite_sessions" add constraint "onsite_sessions_session_code_key" UNIQUE using index "onsite_sessions_session_code_key";

alter table "public"."onsite_sessions" add constraint "onsite_sessions_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'checked_in'::text, 'closed'::text]))) not valid;

alter table "public"."onsite_sessions" validate constraint "onsite_sessions_status_check";

alter table "public"."ot_requests" add constraint "ot_requests_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL not valid;

alter table "public"."ot_requests" validate constraint "ot_requests_project_id_fkey";

alter table "public"."ot_requests" add constraint "ot_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."ot_requests" validate constraint "ot_requests_status_check";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."push_subscriptions" validate constraint "push_subscriptions_user_id_fkey";

alter table "public"."daily_report_items" add constraint "daily_report_items_end_user_id_fkey" FOREIGN KEY (end_user_id) REFERENCES public.end_users(id) ON DELETE SET NULL not valid;

alter table "public"."daily_report_items" validate constraint "daily_report_items_end_user_id_fkey";

alter table "public"."daily_report_items" add constraint "daily_report_items_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL not valid;

alter table "public"."daily_report_items" validate constraint "daily_report_items_project_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.generate_session_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- ตัดอักษรที่สับสน O,0,1,I
    code  TEXT := '';
    i     INT;
BEGIN
    FOR i IN 1..6 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;
    RETURN code;
END;
$function$
;

create or replace view "public"."leave_requests_with_profile" as  SELECT l.id,
    l.user_id,
    l.leave_type,
    l.start_date,
    l.end_date,
    l.days,
    l.reason,
    l.status,
    l.approved_by,
    l.reject_reason,
    l.actioned_at,
    l.created_at,
    l.period_label,
    p.first_name,
    p.last_name,
    p.department,
    ((p.first_name || ' '::text) || p.last_name) AS full_name,
    (u.raw_user_meta_data ->> 'avatar_url'::text) AS avatar_url
   FROM ((public.leave_requests l
     JOIN public.profiles p ON ((p.id = l.user_id)))
     JOIN auth.users u ON ((u.id = l.user_id)));


create or replace view "public"."ot_requests_with_profile" as  SELECT o.id,
    o.user_id,
    o.request_date,
    o.start_time,
    o.end_time,
    o.project_id,
    o.reason,
    o.status,
    o.approved_by,
    o.reject_reason,
    o.actioned_at,
    o.created_at,
    o.hours,
    p.first_name,
    p.last_name,
    p.department,
    ((p.first_name || ' '::text) || p.last_name) AS full_name,
    (u.raw_user_meta_data ->> 'avatar_url'::text) AS avatar_url,
    pr.project_no,
    pr.name AS project_name
   FROM (((public.ot_requests o
     JOIN public.profiles p ON ((p.id = o.user_id)))
     JOIN auth.users u ON ((u.id = o.user_id)))
     LEFT JOIN public.projects pr ON ((pr.id = o.project_id)));


create or replace view "public"."profiles_with_avatar" as  SELECT p.id,
    p.first_name,
    p.last_name,
    p.department,
    p.role,
    p.created_at,
    p.updated_at,
    (u.raw_user_meta_data ->> 'avatar_url'::text) AS avatar_url
   FROM (public.profiles p
     JOIN auth.users u ON ((u.id = p.id)));


CREATE OR REPLACE FUNCTION public.set_session_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    new_code TEXT;
    attempts INT := 0;
BEGIN
    LOOP
        new_code := public.generate_session_code();
        -- ตรวจว่า code ซ้ำไหม (เฉพาะวันนั้น)
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.onsite_sessions
            WHERE session_code = new_code
              AND session_date = NEW.session_date
        );
        attempts := attempts + 1;
        IF attempts > 10 THEN
            RAISE EXCEPTION 'Cannot generate unique session code after 10 attempts';
        END IF;
    END LOOP;

    NEW.session_code := new_code;
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."leave_requests" to "anon";

grant insert on table "public"."leave_requests" to "anon";

grant references on table "public"."leave_requests" to "anon";

grant select on table "public"."leave_requests" to "anon";

grant trigger on table "public"."leave_requests" to "anon";

grant truncate on table "public"."leave_requests" to "anon";

grant update on table "public"."leave_requests" to "anon";

grant delete on table "public"."leave_requests" to "authenticated";

grant insert on table "public"."leave_requests" to "authenticated";

grant references on table "public"."leave_requests" to "authenticated";

grant select on table "public"."leave_requests" to "authenticated";

grant trigger on table "public"."leave_requests" to "authenticated";

grant truncate on table "public"."leave_requests" to "authenticated";

grant update on table "public"."leave_requests" to "authenticated";

grant delete on table "public"."leave_requests" to "service_role";

grant insert on table "public"."leave_requests" to "service_role";

grant references on table "public"."leave_requests" to "service_role";

grant select on table "public"."leave_requests" to "service_role";

grant trigger on table "public"."leave_requests" to "service_role";

grant truncate on table "public"."leave_requests" to "service_role";

grant update on table "public"."leave_requests" to "service_role";

grant delete on table "public"."onsite_session_members" to "anon";

grant insert on table "public"."onsite_session_members" to "anon";

grant references on table "public"."onsite_session_members" to "anon";

grant select on table "public"."onsite_session_members" to "anon";

grant trigger on table "public"."onsite_session_members" to "anon";

grant truncate on table "public"."onsite_session_members" to "anon";

grant update on table "public"."onsite_session_members" to "anon";

grant delete on table "public"."onsite_session_members" to "authenticated";

grant insert on table "public"."onsite_session_members" to "authenticated";

grant references on table "public"."onsite_session_members" to "authenticated";

grant select on table "public"."onsite_session_members" to "authenticated";

grant trigger on table "public"."onsite_session_members" to "authenticated";

grant truncate on table "public"."onsite_session_members" to "authenticated";

grant update on table "public"."onsite_session_members" to "authenticated";

grant delete on table "public"."onsite_session_members" to "service_role";

grant insert on table "public"."onsite_session_members" to "service_role";

grant references on table "public"."onsite_session_members" to "service_role";

grant select on table "public"."onsite_session_members" to "service_role";

grant trigger on table "public"."onsite_session_members" to "service_role";

grant truncate on table "public"."onsite_session_members" to "service_role";

grant update on table "public"."onsite_session_members" to "service_role";

grant delete on table "public"."onsite_sessions" to "anon";

grant insert on table "public"."onsite_sessions" to "anon";

grant references on table "public"."onsite_sessions" to "anon";

grant select on table "public"."onsite_sessions" to "anon";

grant trigger on table "public"."onsite_sessions" to "anon";

grant truncate on table "public"."onsite_sessions" to "anon";

grant update on table "public"."onsite_sessions" to "anon";

grant delete on table "public"."onsite_sessions" to "authenticated";

grant insert on table "public"."onsite_sessions" to "authenticated";

grant references on table "public"."onsite_sessions" to "authenticated";

grant select on table "public"."onsite_sessions" to "authenticated";

grant trigger on table "public"."onsite_sessions" to "authenticated";

grant truncate on table "public"."onsite_sessions" to "authenticated";

grant update on table "public"."onsite_sessions" to "authenticated";

grant delete on table "public"."onsite_sessions" to "service_role";

grant insert on table "public"."onsite_sessions" to "service_role";

grant references on table "public"."onsite_sessions" to "service_role";

grant select on table "public"."onsite_sessions" to "service_role";

grant trigger on table "public"."onsite_sessions" to "service_role";

grant truncate on table "public"."onsite_sessions" to "service_role";

grant update on table "public"."onsite_sessions" to "service_role";

grant delete on table "public"."push_subscriptions" to "anon";

grant insert on table "public"."push_subscriptions" to "anon";

grant references on table "public"."push_subscriptions" to "anon";

grant select on table "public"."push_subscriptions" to "anon";

grant trigger on table "public"."push_subscriptions" to "anon";

grant truncate on table "public"."push_subscriptions" to "anon";

grant update on table "public"."push_subscriptions" to "anon";

grant delete on table "public"."push_subscriptions" to "authenticated";

grant insert on table "public"."push_subscriptions" to "authenticated";

grant references on table "public"."push_subscriptions" to "authenticated";

grant select on table "public"."push_subscriptions" to "authenticated";

grant trigger on table "public"."push_subscriptions" to "authenticated";

grant truncate on table "public"."push_subscriptions" to "authenticated";

grant update on table "public"."push_subscriptions" to "authenticated";

grant delete on table "public"."push_subscriptions" to "service_role";

grant insert on table "public"."push_subscriptions" to "service_role";

grant references on table "public"."push_subscriptions" to "service_role";

grant select on table "public"."push_subscriptions" to "service_role";

grant trigger on table "public"."push_subscriptions" to "service_role";

grant truncate on table "public"."push_subscriptions" to "service_role";

grant update on table "public"."push_subscriptions" to "service_role";


  create policy "Admins can read all logs"
  on "public"."daily_time_logs"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));



  create policy "allow_authenticated_insert"
  on "public"."daily_time_logs"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "allow_authenticated_select"
  on "public"."daily_time_logs"
  as permissive
  for select
  to authenticated
using (true);



  create policy "allow_authenticated_update"
  on "public"."daily_time_logs"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "Admins have full access to leave requests"
  on "public"."leave_requests"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));



  create policy "Managers can update dept leave requests"
  on "public"."leave_requests"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles mgr
  WHERE ((mgr.id = auth.uid()) AND (mgr.role = 'manager'::text) AND (mgr.department = ( SELECT emp.department
           FROM public.profiles emp
          WHERE (emp.id = leave_requests.user_id)))))))
with check (true);



  create policy "Managers can view dept leave requests"
  on "public"."leave_requests"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles mgr
  WHERE ((mgr.id = auth.uid()) AND (mgr.role = 'manager'::text) AND (mgr.department = ( SELECT emp.department
           FROM public.profiles emp
          WHERE (emp.id = leave_requests.user_id)))))));



  create policy "Users can create own leave requests"
  on "public"."leave_requests"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can delete own pending leave requests"
  on "public"."leave_requests"
  as permissive
  for delete
  to authenticated
using (((auth.uid() = user_id) AND (status = 'pending'::text)));



  create policy "Users can view own leave requests"
  on "public"."leave_requests"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "Admins have full access to OT requests"
  on "public"."ot_requests"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));



  create policy "Managers can update dept OT requests"
  on "public"."ot_requests"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles mgr
  WHERE ((mgr.id = auth.uid()) AND (mgr.role = 'manager'::text) AND (mgr.department = ( SELECT emp.department
           FROM public.profiles emp
          WHERE (emp.id = ot_requests.user_id)))))))
with check (true);



  create policy "Managers can view dept OT requests"
  on "public"."ot_requests"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles mgr
  WHERE ((mgr.id = auth.uid()) AND (mgr.role = 'manager'::text) AND (mgr.department = ( SELECT emp.department
           FROM public.profiles emp
          WHERE (emp.id = ot_requests.user_id)))))));



  create policy "Users can create own OT requests"
  on "public"."ot_requests"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can delete own pending OT requests"
  on "public"."ot_requests"
  as permissive
  for delete
  to authenticated
using (((auth.uid() = user_id) AND (status = 'pending'::text)));



  create policy "Users can view own OT requests"
  on "public"."ot_requests"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "Authenticated users can read all profiles"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Service role can read all subscriptions"
  on "public"."push_subscriptions"
  as permissive
  for select
  to service_role
using (true);



  create policy "Users manage own push subscriptions"
  on "public"."push_subscriptions"
  as permissive
  for all
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


CREATE TRIGGER trg_set_session_code BEFORE INSERT ON public.onsite_sessions FOR EACH ROW WHEN ((new.session_code IS NULL)) EXECUTE FUNCTION public.set_session_code();


  create policy "Avatar images are publicly accessible"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'avatars'::text));



  create policy "Users can delete their own avatar"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can update their own avatar"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can upload their own avatar"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



