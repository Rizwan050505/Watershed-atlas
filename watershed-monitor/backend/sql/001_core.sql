CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS watersheds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    admin_area text,
    source text NOT NULL DEFAULT 'unrecorded',
    data_origin text NOT NULL DEFAULT 'field',
    geom geometry(MultiPolygon, 4326) NOT NULL,
    properties jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watersheds_geom_gix ON watersheds USING gist (geom);

CREATE TABLE IF NOT EXISTS interventions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    watershed_id uuid NOT NULL REFERENCES watersheds(id) ON DELETE CASCADE,
    name text NOT NULL,
    intervention_type text NOT NULL,
    status text NOT NULL DEFAULT 'unreviewed',
    source text NOT NULL DEFAULT 'unrecorded',
    data_origin text NOT NULL DEFAULT 'field',
    geom geometry(Geometry, 4326) NOT NULL,
    properties jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interventions_geom_gix ON interventions USING gist (geom);
CREATE INDEX IF NOT EXISTS interventions_watershed_idx ON interventions (watershed_id);

CREATE TABLE IF NOT EXISTS observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    watershed_id uuid REFERENCES watersheds(id) ON DELETE SET NULL,
    intervention_id uuid REFERENCES interventions(id) ON DELETE SET NULL,
    category text NOT NULL,
    description text NOT NULL DEFAULT '',
    captured_at timestamptz,
    geom geometry(Point, 4326),
    image_key text,
    image_sha256 char(64),
    media_type text,
    image_size_bytes bigint,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    quality_flags text[] NOT NULL DEFAULT '{}',
    review_status text NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'in_review', 'approved', 'needs_changes')),
    data_origin text NOT NULL DEFAULT 'field',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS observations_geom_gix ON observations USING gist (geom);
CREATE INDEX IF NOT EXISTS observations_watershed_idx ON observations (watershed_id);
CREATE INDEX IF NOT EXISTS observations_status_idx ON observations (review_status);

CREATE TABLE IF NOT EXISTS satellite_scenes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    scene_id text NOT NULL,
    acquired_at timestamptz NOT NULL,
    resolution_m numeric,
    bands text[] NOT NULL DEFAULT '{}',
    quality_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    license_note text,
    data_origin text NOT NULL DEFAULT 'external',
    footprint geometry(MultiPolygon, 4326),
    file_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, scene_id)
);
CREATE INDEX IF NOT EXISTS satellite_scenes_footprint_gix ON satellite_scenes USING gist (footprint);

CREATE TABLE IF NOT EXISTS analysis_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    watershed_id uuid NOT NULL REFERENCES watersheds(id) ON DELETE CASCADE,
    indicator text NOT NULL,
    method_version text NOT NULL,
    input_scene_ids uuid[] NOT NULL DEFAULT '{}',
    parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
    result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    output_key text,
    review_status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id uuid REFERENCES observations(id) ON DELETE CASCADE,
    analysis_run_id uuid REFERENCES analysis_runs(id) ON DELETE CASCADE,
    actor text NOT NULL DEFAULT 'local-development-user',
    previous_status text,
    new_status text NOT NULL,
    comment text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (observation_id IS NOT NULL OR analysis_run_id IS NOT NULL)
);

-- Synthetic geometry and records for local UI development only. No item below
-- represents an official boundary, field observation, intervention, or image.
INSERT INTO watersheds (id, name, admin_area, source, data_origin, geom, properties)
VALUES (
  '2d3d415b-573d-4c5b-88d4-57ba0f47e901',
  'Illustrative Sample Watershed',
  'Sample district, India',
  'Synthetic development fixture',
  'illustrative',
  ST_Multi(ST_GeomFromText('POLYGON((77.610 14.660,77.676 14.660,77.676 14.718,77.610 14.718,77.610 14.660))',4326)),
  '{"label":"Illustrative only","official_boundary":false}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO interventions (id, watershed_id, name, intervention_type, source, data_origin, geom, properties)
VALUES
 ('6b7945b7-795c-4103-9c23-4530d3cb8b01','2d3d415b-573d-4c5b-88d4-57ba0f47e901','Sample recharge work A','water_conservation','Synthetic development fixture','illustrative',ST_SetSRID(ST_MakePoint(77.628,14.681),4326),'{"official_record":false}'),
 ('6b7945b7-795c-4103-9c23-4530d3cb8b02','2d3d415b-573d-4c5b-88d4-57ba0f47e901','Sample vegetation plot B','vegetation','Synthetic development fixture','illustrative',ST_SetSRID(ST_MakePoint(77.657,14.700),4326),'{"official_record":false}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO observations (id, watershed_id, intervention_id, category, description, captured_at, geom, quality_flags, review_status, data_origin, metadata)
VALUES
 ('50caf90f-a3d5-46b6-9be2-9fbd62277501','2d3d415b-573d-4c5b-88d4-57ba0f47e901','6b7945b7-795c-4103-9c23-4530d3cb8b01','Water conservation','Illustrative observation marker. No photo attached.',NULL,ST_SetSRID(ST_MakePoint(77.630,14.684),4326),ARRAY['illustrative','no_image_attached'],'pending','illustrative','{"official_observation":false}'::jsonb),
 ('50caf90f-a3d5-46b6-9be2-9fbd62277502','2d3d415b-573d-4c5b-88d4-57ba0f47e901','6b7945b7-795c-4103-9c23-4530d3cb8b02','Vegetation','Illustrative observation marker. No photo attached.',NULL,ST_SetSRID(ST_MakePoint(77.658,14.698),4326),ARRAY['illustrative','no_image_attached'],'in_review','illustrative','{"official_observation":false}'::jsonb),
 ('50caf90f-a3d5-46b6-9be2-9fbd62277503','2d3d415b-573d-4c5b-88d4-57ba0f47e901',NULL,'Land condition','Illustrative observation marker. No photo attached.',NULL,ST_SetSRID(ST_MakePoint(77.644,14.711),4326),ARRAY['illustrative','no_image_attached'],'approved','illustrative','{"official_observation":false}'::jsonb)
ON CONFLICT (id) DO NOTHING;

