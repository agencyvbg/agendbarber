CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE tenants ADD CONSTRAINT tenant_identity CHECK (id = tenant_id);
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['plans','companies','users','units','barbers','clients','services','appointments','business_hours','schedule_blocks','commissions','payments','categories','financial_entries','suppliers','stock_products','stock_movements','notifications','refresh_tokens','audit_logs','reviews','uploads','subscription_events']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT',t,t||'_tenant_fk');
  END LOOP;
  FOREACH t IN ARRAY ARRAY['tenants','companies','users','units','barbers','clients','services','appointments','business_hours','schedule_blocks','commissions','payments','categories','financial_entries','suppliers','stock_products','stock_movements','notifications','refresh_tokens','audit_logs','reviews','uploads','subscription_events']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid OR current_setting(''app.is_master'', true) = ''true'') WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid OR current_setting(''app.is_master'', true) = ''true'')', t);
  END LOOP;
END $$;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans FORCE ROW LEVEL SECURITY;
CREATE POLICY plan_read ON plans FOR SELECT USING (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid);
CREATE POLICY plan_write ON plans FOR ALL USING (current_setting('app.is_master',true) = 'true') WITH CHECK (current_setting('app.is_master',true) = 'true');

ALTER TABLE users ADD CONSTRAINT master_system_tenant CHECK ((role = 'MASTER') = (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid));
ALTER TABLE services ADD CONSTRAINT service_values CHECK (price_cents >= 0 AND duration_minutes BETWEEN 5 AND 480);
ALTER TABLE barbers ADD CONSTRAINT barber_commission CHECK (commission_percent BETWEEN 0 AND 100 AND goal_cents >= 0);
ALTER TABLE appointments ADD CONSTRAINT appointment_values CHECK (ends_at > starts_at AND price_cents >= 0 AND commission_percent BETWEEN 0 AND 100);
ALTER TABLE appointments ADD CONSTRAINT appointment_no_overlap EXCLUDE USING gist
  (tenant_id WITH =, barber_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status NOT IN ('CANCELADO','NAO_COMPARECEU'));
ALTER TABLE schedule_blocks ADD CONSTRAINT block_interval CHECK (ends_at > starts_at);
ALTER TABLE business_hours ADD CONSTRAINT business_hour_values CHECK (weekday BETWEEN 0 AND 6 AND opens_at < closes_at);
ALTER TABLE commissions ADD CONSTRAINT commission_values CHECK (amount_cents >= 0 AND percent BETWEEN 0 AND 100);
ALTER TABLE payments ADD CONSTRAINT payment_values CHECK (amount_cents >= 0);
ALTER TABLE financial_entries ADD CONSTRAINT entry_values CHECK (amount_cents >= 0);
ALTER TABLE stock_products ADD CONSTRAINT stock_values CHECK (quantity >= 0 AND minimum >= 0 AND cost_cents >= 0 AND price_cents >= 0);
ALTER TABLE stock_movements ADD CONSTRAINT movement_nonzero CHECK (delta <> 0);
ALTER TABLE reviews ADD CONSTRAINT review_rating CHECK (rating BETWEEN 1 AND 5);

CREATE FUNCTION protect_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('schedule:' || NEW.tenant_id::text || ':' || NEW.barber_id::text,0));
  IF TG_TABLE_NAME = 'appointments' THEN
    IF NEW.status NOT IN ('CANCELADO','NAO_COMPARECEU') AND EXISTS (
      SELECT 1 FROM schedule_blocks b WHERE b.tenant_id = NEW.tenant_id AND b.barber_id = NEW.barber_id
      AND b.starts_at < NEW.ends_at AND b.ends_at > NEW.starts_at
    ) THEN RAISE EXCEPTION 'Appointment overlaps schedule block' USING ERRCODE = '23P01'; END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM appointments a WHERE a.tenant_id = NEW.tenant_id AND a.barber_id = NEW.barber_id
      AND a.status NOT IN ('CANCELADO','NAO_COMPARECEU') AND a.starts_at < NEW.ends_at AND a.ends_at > NEW.starts_at
    ) THEN RAISE EXCEPTION 'Block overlaps appointment' USING ERRCODE = '23P01'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointment_schedule_guard BEFORE INSERT OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION protect_schedule();
CREATE TRIGGER block_schedule_guard BEFORE INSERT OR UPDATE ON schedule_blocks FOR EACH ROW EXECUTE FUNCTION protect_schedule();

-- Database role created by infra/db/init.sh; migrations run under a separate owner.
GRANT USAGE ON SCHEMA public TO barberhub_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO barberhub_app;
REVOKE UPDATE, DELETE ON audit_logs FROM barberhub_app;
REVOKE ALL ON _prisma_migrations FROM barberhub_app;
