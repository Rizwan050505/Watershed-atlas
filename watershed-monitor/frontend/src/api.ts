import { demoInterventions, demoObservations, demoSummary, demoWatersheds } from './data/demo';
import type { FeatureCollection, Observation, Summary } from './types';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export interface WorkspaceData {
  watersheds: FeatureCollection;
  interventions: FeatureCollection;
  observations: Observation[];
  summary: Summary;
  live: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'analyst' | 'reviewer' | 'field_staff';
}

export interface ReviewEvent {
  id: string;
  actor: string;
  previous_status: Observation['review_status'] | null;
  new_status: Observation['review_status'];
  comment: string;
  created_at: string;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, credentials: 'include' });
  } catch (cause) {
    if (cause instanceof TypeError) {
      const apiHost = baseUrl ? new URL(baseUrl, window.location.origin).host : window.location.host;
      throw new ApiError(`Cannot reach the watershed API at ${apiHost}. Start the local PostGIS/API services (docker compose up -d database api), then retry.`, 0);
    }
    throw cause;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.detail || `Request failed (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}

export function getCurrentUser() {
  return request<SessionUser>('/api/auth/me');
}

export function signIn(email: string, password: string) {
  return request<SessionUser>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export function registerAccount(displayName: string, email: string, password: string) {
  return request<SessionUser>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: displayName, email, password }),
  });
}

export function signOut() {
  return request<{ status: string }>('/api/auth/logout', { method: 'POST' });
}

export async function loadWorkspace(): Promise<WorkspaceData> {
  const [watersheds, interventions, observations, summary] = await Promise.all([
    request<FeatureCollection>('/api/watersheds'),
    request<FeatureCollection>('/api/interventions'),
    request<Observation[]>('/api/observations'),
    request<Summary>('/api/summary'),
  ]);
  return { watersheds, interventions, observations, summary, live: true };
}

export function loadDemoWorkspace(): WorkspaceData {
  return {
    watersheds: demoWatersheds,
    interventions: demoInterventions,
    observations: demoObservations,
    summary: demoSummary,
    live: false,
  };
}

export async function uploadObservation(file: File, values: { category: string; description: string; watershedId: string; latitude?: string; longitude?: string }) {
  const body = new FormData();
  body.append('file', file);
  body.append('category', values.category);
  body.append('description', values.description);
  body.append('watershed_id', values.watershedId);
  if (values.latitude) body.append('latitude', values.latitude);
  if (values.longitude) body.append('longitude', values.longitude);
  return request<{ id: string; quality_flags: string[]; has_image: boolean }>('/api/observations', {
    method: 'POST',
    body,
  });
}

export async function importWatershed(file: File, values: { name: string; adminArea: string; source: string }) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Boundary GeoJSON must be 10 MB or smaller');
  let document: unknown;
  try {
    document = JSON.parse(await file.text());
  } catch {
    throw new Error('The selected file is not valid JSON');
  }

  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('GeoJSON must contain a JSON object');
  }
  const object = document as Record<string, unknown>;
  let geometry: Record<string, unknown> | null = null;
  if (object.type === 'FeatureCollection' && Array.isArray(object.features)) {
    const features = object.features as Array<Record<string, unknown>>;
    if (features.length !== 1) throw new Error('Export one watershed polygon per GeoJSON file');
    const feature = features[0];
    if (!feature || typeof feature !== 'object') throw new Error('The GeoJSON feature is malformed');
    geometry = feature.geometry as Record<string, unknown> | null;
  } else if (object.type === 'Feature') {
    geometry = object.geometry as Record<string, unknown> | null;
  } else {
    geometry = object;
  }
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(String(geometry.type))) {
    throw new Error('Choose a GeoJSON Polygon or MultiPolygon boundary');
  }

  return request<{ id: string; name: string; pilot_confirmed: boolean }>('/api/watersheds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: values.name, admin_area: values.adminArea, source: values.source, geometry }),
  });
}

export async function updateReview(id: string, status: Observation['review_status'], comment = '') {
  return request<{ id: string; review_status: Observation['review_status'] }>(`/api/observations/${id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, comment }),
  });
}

export function loadReviewHistory(id: string) {
  return request<ReviewEvent[]>(`/api/observations/${id}/review-history`);
}

export function imageUrl(path: string) {
  return `${baseUrl}${path}`;
}
