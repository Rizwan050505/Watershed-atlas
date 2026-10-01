import type { FeatureCollection, Observation, Summary } from '../types';

export const DEMO_WATERSHED_ID = '2d3d415b-573d-4c5b-88d4-57ba0f47e901';

export const demoWatersheds: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    id: DEMO_WATERSHED_ID,
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[[[77.610, 14.660], [77.676, 14.660], [77.676, 14.718], [77.610, 14.718], [77.610, 14.660]]]],
    },
    properties: {
      name: 'Illustrative Sample Watershed',
      admin_area: 'Sample district, India',
      source: 'Synthetic development fixture',
      data_origin: 'illustrative',
      area_sq_km: 38.4,
      label: 'Illustrative only',
      official_boundary: false,
    },
  }],
};

export const demoInterventions: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: '6b7945b7-795c-4103-9c23-4530d3cb8b01',
      geometry: { type: 'Point', coordinates: [77.628, 14.681] },
      properties: { name: 'Sample recharge work A', intervention_type: 'water_conservation', watershed_id: DEMO_WATERSHED_ID, data_origin: 'illustrative' },
    },
    {
      type: 'Feature',
      id: '6b7945b7-795c-4103-9c23-4530d3cb8b02',
      geometry: { type: 'Point', coordinates: [77.657, 14.700] },
      properties: { name: 'Sample vegetation plot B', intervention_type: 'vegetation', watershed_id: DEMO_WATERSHED_ID, data_origin: 'illustrative' },
    },
  ],
};

export const demoObservations: Observation[] = [
  {
    id: '50caf90f-a3d5-46b6-9be2-9fbd62277501',
    watershed_id: DEMO_WATERSHED_ID,
    intervention_id: '6b7945b7-795c-4103-9c23-4530d3cb8b01',
    intervention_name: 'Sample recharge work A',
    category: 'Water conservation',
    description: 'Illustrative observation marker. No photo attached.',
    captured_at: null,
    longitude: 77.630,
    latitude: 14.684,
    has_image: false,
    quality_flags: ['illustrative', 'no_image_attached'],
    review_status: 'pending',
    data_origin: 'illustrative',
  },
  {
    id: '50caf90f-a3d5-46b6-9be2-9fbd62277502',
    watershed_id: DEMO_WATERSHED_ID,
    intervention_id: '6b7945b7-795c-4103-9c23-4530d3cb8b02',
    intervention_name: 'Sample vegetation plot B',
    category: 'Vegetation',
    description: 'Illustrative observation marker. No photo attached.',
    captured_at: null,
    longitude: 77.658,
    latitude: 14.698,
    has_image: false,
    quality_flags: ['illustrative', 'no_image_attached'],
    review_status: 'in_review',
    data_origin: 'illustrative',
  },
  {
    id: '50caf90f-a3d5-46b6-9be2-9fbd62277503',
    watershed_id: DEMO_WATERSHED_ID,
    intervention_id: null,
    category: 'Land condition',
    description: 'Illustrative observation marker. No photo attached.',
    captured_at: null,
    longitude: 77.644,
    latitude: 14.711,
    has_image: false,
    quality_flags: ['illustrative', 'no_image_attached'],
    review_status: 'approved',
    data_origin: 'illustrative',
  },
];

export const demoSummary: Summary = {
  watershed_count: 1,
  intervention_count: 2,
  observation_count: 3,
  photo_count: 0,
  pending_count: 1,
  illustrative_count: 3,
};
