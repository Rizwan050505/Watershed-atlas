export type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'needs_changes';

export interface WatershedProperties {
  name: string;
  admin_area: string;
  source: string;
  data_origin: 'illustrative' | 'field' | 'external';
  area_sq_km?: number;
  label?: string;
  official_boundary?: boolean;
  pilot_confirmed?: boolean;
}

export interface SpatialFeature<P = Record<string, unknown>> {
  type: 'Feature';
  id: string;
  geometry: { type: string; coordinates: unknown };
  properties: P;
}

export interface FeatureCollection<P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: SpatialFeature<P>[];
}

export interface Observation {
  id: string;
  watershed_id: string | null;
  intervention_id: string | null;
  intervention_name?: string | null;
  category: string;
  description: string;
  captured_at: string | null;
  longitude: number | null;
  latitude: number | null;
  image_key?: string | null;
  has_image: boolean;
  image_url?: string | null;
  image_sha256?: string | null;
  media_type?: string | null;
  quality_flags: string[];
  review_status: ReviewStatus;
  data_origin: 'illustrative' | 'field' | 'external';
  metadata?: Record<string, unknown>;
}

export interface Summary {
  watershed_count: number;
  intervention_count: number;
  observation_count: number;
  photo_count: number;
  pending_count: number;
  illustrative_count: number;
}
