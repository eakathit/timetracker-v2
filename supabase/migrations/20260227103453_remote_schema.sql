


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (new.id, '', '', 'employee');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."daily_report_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "end_user_id" "uuid",
    "project_id" "uuid",
    "detail_id" "uuid",
    "period_type" "text" DEFAULT 'fixed'::"text" NOT NULL,
    "period_start" time without time zone,
    "period_end" time without time zone,
    "period_label" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."daily_report_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "report_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."daily_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_time_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "work_type" "text" NOT NULL,
    "first_check_in" timestamp with time zone,
    "last_check_out" timestamp with time zone,
    "timeline_events" "jsonb" DEFAULT '[]'::"jsonb",
    "allowances" "jsonb",
    "ot_hours" numeric(5,2) DEFAULT 0,
    "regular_hours" numeric(5,2) DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_time_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."end_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "color" "text" DEFAULT 'bg-sky-500'::"text"
);


ALTER TABLE "public"."end_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "holiday_date" "date" NOT NULL,
    "name" "text" NOT NULL,
    "holiday_type" "text" DEFAULT 'national'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ot_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "request_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "task_detail" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."ot_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "department" "text",
    "role" "text" DEFAULT 'user'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_no" "text" NOT NULL,
    "name" "text",
    "end_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "value_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."work_details" OWNER TO "postgres";


ALTER TABLE ONLY "public"."daily_report_items"
    ADD CONSTRAINT "daily_report_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_reports"
    ADD CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_reports"
    ADD CONSTRAINT "daily_reports_user_id_report_date_key" UNIQUE ("user_id", "report_date");



ALTER TABLE ONLY "public"."daily_time_logs"
    ADD CONSTRAINT "daily_time_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."end_users"
    ADD CONSTRAINT "end_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_holiday_date_key" UNIQUE ("holiday_date");



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ot_requests"
    ADD CONSTRAINT "ot_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_details"
    ADD CONSTRAINT "work_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_details"
    ADD CONSTRAINT "work_details_value_key_key" UNIQUE ("value_key");



CREATE UNIQUE INDEX "idx_user_daily_log" ON "public"."daily_time_logs" USING "btree" ("user_id", "log_date");



ALTER TABLE ONLY "public"."daily_report_items"
    ADD CONSTRAINT "daily_report_items_detail_id_fkey" FOREIGN KEY ("detail_id") REFERENCES "public"."work_details"("id");



ALTER TABLE ONLY "public"."daily_report_items"
    ADD CONSTRAINT "daily_report_items_end_user_id_fkey" FOREIGN KEY ("end_user_id") REFERENCES "public"."end_users"("id");



ALTER TABLE ONLY "public"."daily_report_items"
    ADD CONSTRAINT "daily_report_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."daily_report_items"
    ADD CONSTRAINT "daily_report_items_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."daily_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_time_logs"
    ADD CONSTRAINT "daily_time_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."daily_reports"
    ADD CONSTRAINT "fk_report_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ot_requests"
    ADD CONSTRAINT "ot_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ot_requests"
    ADD CONSTRAINT "ot_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_end_user_id_fkey" FOREIGN KEY ("end_user_id") REFERENCES "public"."end_users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can update all profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND ("profiles_1"."role" = 'admin'::"text")))));



CREATE POLICY "Allow all actions on daily_report_items" ON "public"."daily_report_items" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all actions on daily_reports" ON "public"."daily_reports" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all actions on end_users" ON "public"."end_users" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all actions on projects" ON "public"."projects" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all actions on work_details" ON "public"."work_details" USING (true) WITH CHECK (true);



CREATE POLICY "Allow read for end_users" ON "public"."end_users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read for projects" ON "public"."projects" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read for work_details" ON "public"."work_details" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Calendar" ON "public"."holidays" FOR INSERT WITH CHECK (true);



CREATE POLICY "Profiles are viewable by authenticated users" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can manage own profile" ON "public"."profiles" TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage own report items" ON "public"."daily_report_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."daily_reports" "dr"
  WHERE (("dr"."id" = "daily_report_items"."report_id") AND ("dr"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."daily_reports" "dr"
  WHERE (("dr"."id" = "daily_report_items"."report_id") AND ("dr"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage own reports" ON "public"."daily_reports" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own OT requests" ON "public"."ot_requests" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own logs" ON "public"."daily_time_logs" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."daily_report_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_time_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."end_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ot_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_details" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


















GRANT ALL ON TABLE "public"."daily_report_items" TO "anon";
GRANT ALL ON TABLE "public"."daily_report_items" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_report_items" TO "service_role";



GRANT ALL ON TABLE "public"."daily_reports" TO "anon";
GRANT ALL ON TABLE "public"."daily_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_reports" TO "service_role";



GRANT ALL ON TABLE "public"."daily_time_logs" TO "anon";
GRANT ALL ON TABLE "public"."daily_time_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_time_logs" TO "service_role";



GRANT ALL ON TABLE "public"."end_users" TO "anon";
GRANT ALL ON TABLE "public"."end_users" TO "authenticated";
GRANT ALL ON TABLE "public"."end_users" TO "service_role";



GRANT ALL ON TABLE "public"."holidays" TO "anon";
GRANT ALL ON TABLE "public"."holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."holidays" TO "service_role";



GRANT ALL ON TABLE "public"."ot_requests" TO "anon";
GRANT ALL ON TABLE "public"."ot_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."ot_requests" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."work_details" TO "anon";
GRANT ALL ON TABLE "public"."work_details" TO "authenticated";
GRANT ALL ON TABLE "public"."work_details" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































