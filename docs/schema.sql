-- ══════════════════════════════════════════════════════════════════════
-- ATS-UMN Presence System v2.0 — Schema PostgreSQL / Supabase
-- Instituto Politécnico da Huíla (IPH) | Universidade Mandume ya Ndemufayo
-- Lubango, Angola
--
-- Executar este ficheiro no SQL Editor do Supabase para criar
-- todas as tabelas, índices, vistas e políticas de segurança.
-- ══════════════════════════════════════════════════════════════════════

-- ── Leituras dos sensores IoT ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS readings (
    id              BIGSERIAL PRIMARY KEY,
    zone_id         TEXT      NOT NULL,
    count           INTEGER   NOT NULL CHECK (count >= 0),
    occupancy_pct   NUMERIC(5,1),
    temperature     NUMERIC(4,1),
    humidity        NUMERIC(4,1),
    co2_ppm         INTEGER,
    noise_db        NUMERIC(4,1),
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readings_zone    ON readings(zone_id);
CREATE INDEX IF NOT EXISTS idx_readings_zone_ts ON readings(zone_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_ts      ON readings(recorded_at DESC);

-- ── Alertas automáticos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id          TEXT PRIMARY KEY,
    zone_id     TEXT        NOT NULL,
    zone_name   TEXT,
    message     TEXT        NOT NULL,
    severity    TEXT        NOT NULL CHECK (severity IN ('info','warning','danger')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(created_at DESC);

-- ── Incidentes de segurança ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
    id              TEXT PRIMARY KEY,
    zone_id         TEXT        NOT NULL,
    zone_name       TEXT,
    incident_type   TEXT,
    message         TEXT,
    severity        TEXT DEFAULT 'info',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_ts ON incidents(created_at DESC);

-- ── Log de actuadores ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actuator_log (
    id          BIGSERIAL PRIMARY KEY,
    zone_id     TEXT        NOT NULL,
    actuator    TEXT        NOT NULL,
    command     TEXT        NOT NULL,
    reason      TEXT,
    mqtt_topic  TEXT,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actuator_ts ON actuator_log(sent_at DESC);

-- ── Vistas analíticas ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW hourly_patterns AS
SELECT
    zone_id,
    EXTRACT(HOUR FROM recorded_at AT TIME ZONE 'Africa/Luanda')::INT AS hour,
    ROUND(AVG(occupancy_pct)::NUMERIC, 1) AS avg_pct,
    ROUND(MAX(occupancy_pct)::NUMERIC, 1) AS peak_pct,
    ROUND(AVG(temperature)::NUMERIC, 1)   AS avg_temp,
    ROUND(AVG(co2_ppm)::NUMERIC, 0)       AS avg_co2,
    COUNT(*)                               AS total_readings
FROM readings
WHERE recorded_at >= now() - INTERVAL '7 days'
GROUP BY zone_id, EXTRACT(HOUR FROM recorded_at AT TIME ZONE 'Africa/Luanda')
ORDER BY zone_id, hour;

CREATE OR REPLACE VIEW zone_latest AS
SELECT DISTINCT ON (zone_id)
    zone_id, count, occupancy_pct, temperature, humidity, co2_ppm, noise_db, recorded_at
FROM readings
ORDER BY zone_id, recorded_at DESC;

CREATE OR REPLACE VIEW daily_stats AS
SELECT
    zone_id,
    DATE(recorded_at AT TIME ZONE 'Africa/Luanda')        AS day,
    ROUND(AVG(occupancy_pct)::NUMERIC, 1) AS avg_occupancy,
    ROUND(MAX(occupancy_pct)::NUMERIC, 1) AS peak_occupancy,
    MAX(count)                             AS peak_count,
    COUNT(*)                               AS total_readings
FROM readings
GROUP BY zone_id, DATE(recorded_at AT TIME ZONE 'Africa/Luanda')
ORDER BY day DESC, zone_id;

-- ── Row Level Security (RLS) ──────────────────────────────────────────
ALTER TABLE readings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE actuator_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_readings"   ON readings     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_alerts"     ON alerts       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_incidents"  ON incidents    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_actuator"   ON actuator_log FOR ALL TO anon USING (true) WITH CHECK (true);
