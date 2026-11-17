BEGIN;
LOCK TABLE "Player" IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE "WalletLedger" (
 id BIGSERIAL PRIMARY KEY,
 "playerId" TEXT NOT NULL,
 source TEXT NOT NULL,
 kind TEXT NOT NULL,
 "actorId" TEXT,
 reference TEXT,
 before JSONB,
 after JSONB NOT NULL,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "WalletLedger_player_id" ON "WalletLedger"("playerId",id DESC);
CREATE INDEX "WalletLedger_source_id" ON "WalletLedger"(source,id DESC);
CREATE FUNCTION wallet_audit_snapshot(value JSONB) RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_build_object(
 'wallet', COALESCE(value->'munny','0'::jsonb),
 'bankMicros', COALESCE(value#>'{finance,bank,micros}','"0"'::jsonb),
 'reserved', COALESCE(value#>'{finance,reserved}','0'::jsonb),
 'liability', COALESCE(value#>'{finance,liability}','0'::jsonb)
 );
$$;
INSERT INTO "WalletLedger" ("playerId",source,kind,before,after)
 SELECT id,'system','baseline',NULL,wallet_audit_snapshot(state) FROM "Player";
CREATE FUNCTION wallet_audit_record() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 previous JSONB;
 following JSONB;
 context JSONB;
BEGIN
 following := wallet_audit_snapshot(NEW.state);
 IF TG_OP='UPDATE' THEN previous := wallet_audit_snapshot(OLD.state); END IF;
 IF previous IS NOT DISTINCT FROM following THEN RETURN NEW; END IF;
 context := COALESCE(NULLIF(current_setting('sorarng.wallet_audit',true),''),'{}')::jsonb;
 INSERT INTO "WalletLedger" ("playerId",source,kind,"actorId",reference,before,after)
 VALUES (NEW.id,COALESCE(context->>'source','system'),
 COALESCE(context->>'kind',CASE WHEN TG_OP='INSERT' THEN 'account.create' ELSE 'unattributed' END),
 context->>'actor',context->>'reference',previous,following);
 RETURN NEW;
END;
$$;
CREATE TRIGGER "Player_wallet_audit" AFTER INSERT OR UPDATE OF state ON "Player"
 FOR EACH ROW EXECUTE FUNCTION wallet_audit_record();
CREATE FUNCTION wallet_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Financial audit entries cannot be changed or deleted';
END;
$$;
CREATE TRIGGER "WalletLedger_immutable" BEFORE UPDATE OR DELETE ON "WalletLedger"
 FOR EACH ROW EXECUTE FUNCTION wallet_audit_immutable();
COMMIT;
