CREATE TABLE public.skins (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, nickname text, image_url text, weapon_type text NOT NULL DEFAULT 'M4A1', season text NOT NULL DEFAULT 'Misc', rarity text NOT NULL DEFAULT 'Common', value numeric NOT NULL DEFAULT 0, demand numeric DEFAULT 0, notes text, kt_value numeric, sv_value numeric, kt_sv_demand numeric, amount_unboxed text, section text NOT NULL DEFAULT 'main', trend text, kt_trend text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT skins_weapon_name_unique UNIQUE (weapon_type, name));
CREATE TABLE public.skin_value_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), skin_id uuid NOT NULL REFERENCES public.skins(id) ON DELETE CASCADE, value numeric NOT NULL, changed_at timestamptz NOT NULL DEFAULT now());
CREATE TYPE public.app_role AS ENUM ('editor','admin');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, role));
CREATE TABLE public.profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, username text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT username_len CHECK (char_length(username) BETWEEN 3 AND 24), CONSTRAINT username_chars CHECK (username ~ '^[a-zA-Z0-9_]+$'));
CREATE TABLE public.contact_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, username text NOT NULL, subject text NOT NULL, body text NOT NULL, status text NOT NULL DEFAULT 'new', reply text, replied_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.game_saves (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, game_key text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, game_key));
CREATE TABLE public.daily_scores (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, username text NOT NULL, game_date date NOT NULL, score integer NOT NULL CHECK (score >= 0 AND score <= 1000000), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, game_date));
CREATE TABLE public.sync_state (id text PRIMARY KEY, last_synced_at timestamptz, main_count int DEFAULT 0, exotics_count int DEFAULT 0, last_error text);
INSERT INTO public.sync_state (id) VALUES ('sheet') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE OR REPLACE FUNCTION public.email_for_username(_username text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT u.email FROM public.profiles p JOIN auth.users u ON u.id = p.user_id WHERE lower(p.username) = lower(_username) LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE uname text; BEGIN uname := coalesce(nullif(new.raw_user_meta_data->>'username',''),split_part(new.email,'@',1),'user'); uname := regexp_replace(lower(uname),'[^a-z0-9_]','_','g'); uname := left(greatest(uname,'user'),24); IF EXISTS (SELECT 1 FROM public.profiles WHERE username=uname) THEN uname := left(uname,17)||'_'||substr(new.id::text,1,6); END IF; INSERT INTO public.profiles(user_id,username) VALUES(new.id,uname) ON CONFLICT(user_id) DO NOTHING; RETURN new; END; $$;
CREATE OR REPLACE FUNCTION public.log_skin_value_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN IF (tg_op='INSERT') THEN INSERT INTO public.skin_value_history(skin_id,value) VALUES(new.id,new.value); ELSIF (tg_op='UPDATE') THEN new.updated_at=now(); IF new.value IS DISTINCT FROM old.value THEN INSERT INTO public.skin_value_history(skin_id,value) VALUES(new.id,new.value); END IF; END IF; RETURN new; END; $$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER trg_skins_value_history AFTER INSERT ON public.skins FOR EACH ROW EXECUTE FUNCTION public.log_skin_value_change();
CREATE TRIGGER trg_skins_value_history_update BEFORE UPDATE ON public.skins FOR EACH ROW EXECUTE FUNCTION public.log_skin_value_change();
CREATE TRIGGER update_game_saves_updated_at BEFORE UPDATE ON public.game_saves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.skins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_value_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read skins" ON public.skins FOR SELECT TO public USING (true);
CREATE POLICY "editors insert skins" ON public.skins FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(),'editor'::public.app_role));
CREATE POLICY "editors update skins" ON public.skins FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'editor'::public.app_role));
CREATE POLICY "editors delete skins" ON public.skins FOR DELETE TO authenticated USING (private.has_role(auth.uid(),'editor'::public.app_role));
CREATE POLICY "public read history" ON public.skin_value_history FOR SELECT TO public USING (true);
CREATE POLICY "editors insert history" ON public.skin_value_history FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(),'editor'::public.app_role));
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner can insert profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "owner can update profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY "admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "admins grant roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "admins revoke roles" ON public.user_roles FOR DELETE TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "authors read own messages" ON public.contact_messages FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY "admins read all messages" ON public.contact_messages FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "authors insert own messages" ON public.contact_messages FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND username=(SELECT p.username FROM public.profiles p WHERE p.user_id=auth.uid()));
CREATE POLICY "admins update messages" ON public.contact_messages FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Users manage their own game saves" ON public.game_saves FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Anyone can read daily scores" ON public.daily_scores FOR SELECT USING (true);
CREATE POLICY "Users insert their own daily score" ON public.daily_scores FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Users update their own daily score" ON public.daily_scores FOR UPDATE TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "sync_state readable by all" ON public.sync_state FOR SELECT TO anon,authenticated USING (true);

GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT ON public.skins TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.skins TO authenticated;
GRANT SELECT ON public.skin_value_history TO anon,authenticated;
GRANT INSERT ON public.skin_value_history TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT,UPDATE ON public.profiles TO authenticated;
GRANT SELECT,INSERT ON public.user_roles TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.contact_messages TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.game_saves TO authenticated;
GRANT SELECT ON public.daily_scores TO anon;
GRANT SELECT,INSERT,UPDATE ON public.daily_scores TO authenticated;
GRANT SELECT ON public.sync_state TO anon,authenticated;
GRANT ALL ON public.sync_state TO service_role;
GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO service_role;
GRANT USAGE ON SCHEMA private TO authenticated,anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid,public.app_role) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_skins_rarity ON public.skins(rarity);
CREATE INDEX IF NOT EXISTS idx_skins_weapon ON public.skins(weapon_type);
CREATE INDEX IF NOT EXISTS idx_skins_season ON public.skins(season);
CREATE INDEX IF NOT EXISTS idx_skins_section ON public.skins(section);
CREATE INDEX IF NOT EXISTS idx_history_skin ON public.skin_value_history(skin_id,changed_at DESC);
CREATE INDEX IF NOT EXISTS daily_scores_date_score_idx ON public.daily_scores(game_date,score DESC);

INSERT INTO storage.buckets (id,name,public) VALUES ('skin-images','skin-images',true) ON CONFLICT (id) DO UPDATE SET public=true;
CREATE POLICY "skin images public read" ON storage.objects FOR SELECT TO public USING (bucket_id='skin-images');
CREATE POLICY "skin images editors insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='skin-images' AND private.has_role(auth.uid(),'editor'::public.app_role));
CREATE POLICY "skin images editors update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='skin-images' AND private.has_role(auth.uid(),'editor'::public.app_role));
CREATE POLICY "skin images editors delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='skin-images' AND private.has_role(auth.uid(),'editor'::public.app_role));

CREATE OR REPLACE VIEW public.value_history WITH (security_invoker=on) AS SELECT * FROM public.skin_value_history;
GRANT SELECT ON public.value_history TO anon,authenticated;

-- Allow anonymous callers to look up an email by username (needed for client-side login-by-username)
GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO anon, authenticated;

-- Allow editors to update sync_state (needed for client-side sheet sync without service role)
CREATE POLICY "editors update sync_state" ON public.sync_state FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
GRANT UPDATE ON public.sync_state TO authenticated;
