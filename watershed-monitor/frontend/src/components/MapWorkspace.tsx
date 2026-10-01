import { useEffect, useRef } from 'react';
import Feature from 'ol/Feature.js';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import OSM from 'ol/source/OSM.js';
import TileWMS from 'ol/source/TileWMS.js';
import VectorSource from 'ol/source/Vector.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import { defaults as defaultControls } from 'ol/control/defaults.js';
import type { FeatureCollection, Observation } from '../types';
import type { Language } from './LanguageSwitch';

interface Props {
  watersheds: FeatureCollection;
  interventions: FeatureCollection;
  observations: Observation[];
  selectedId: string | null;
  showInterventions: boolean;
  showObservations: boolean;
  showIsroLulc: boolean;
  language: Language;
  onSelect: (id: string) => void;
}

// Navigation reference for the user-selected pilot district. It is not a
// watershed boundary, field observation, or surveyed control point.
const INDORE_REFERENCE = [75.8577, 22.7196] as const;
const INDORE_START_ZOOM = 8.5;

export default function MapWorkspace({ watersheds, interventions, observations, selectedId, showInterventions, showObservations, showIsroLulc, language, onSelect }: Props) {
  const targetRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const boundarySourceRef = useRef<VectorSource | null>(null);
  const selectedRef = useRef(selectedId);
  const illustrativeBoundary = watersheds.features.every((feature) => feature.properties.data_origin === 'illustrative');
  const hi = language === 'hi';
  const tr = (en: string, hindi: string) => hi ? hindi : en;

  useEffect(() => {
    selectedRef.current = selectedId;
    mapRef.current?.render();
  }, [selectedId]);

  useEffect(() => {
    if (!targetRef.current) return;
    const boundarySource = new VectorSource();
    boundarySourceRef.current = boundarySource;
    const interventionSource = new VectorSource();
    const observationSource = new VectorSource();
    const pilotReferenceSource = new VectorSource();
    const format = new GeoJSON();
    boundarySource.addFeatures(format.readFeatures(JSON.parse(JSON.stringify(watersheds)), {
      dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857',
    }));
    interventionSource.addFeatures(format.readFeatures(JSON.parse(JSON.stringify(interventions)), {
      dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857',
    }));
    for (const observation of observations) {
      if (observation.longitude == null || observation.latitude == null) continue;
      const feature = new Feature(new Point(fromLonLat([observation.longitude, observation.latitude])));
      feature.setProperties({ observationId: observation.id, kind: 'observation' });
      observationSource.addFeature(feature);
    }
    if (illustrativeBoundary) {
      const reference = new Feature(new Point(fromLonLat([...INDORE_REFERENCE])));
      reference.set('kind', 'pilot-reference');
      pilotReferenceSource.addFeature(reference);
    }
    boundarySource.getFeatures().forEach((feature) => feature.set('kind', 'watershed'));
    interventionSource.getFeatures().forEach((feature) => feature.set('kind', 'intervention'));

    const map = new Map({
      target: targetRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        new TileLayer({
          source: new TileWMS({
            url: 'https://bhuvan-ras2.nrsc.gov.in/cgi-bin/LULC250K.exe',
            params: { SERVICE: 'WMS', VERSION: '1.1.1', LAYERS: 'LULC250K_1516', STYLES: '', FORMAT: 'image/png', TRANSPARENT: true },
            serverType: 'mapserver',
            transition: 0,
          }),
          visible: showIsroLulc,
          opacity: 0.64,
        }),
        new VectorLayer({
          source: boundarySource,
          style: new Style({
            fill: new Fill({ color: 'rgba(25, 112, 91, 0.10)' }),
            stroke: new Stroke({ color: '#1c7560', width: 2.5, lineDash: [8, 5] }),
          }),
        }),
        new VectorLayer({
          source: interventionSource,
          visible: showInterventions,
          style: new Style({
            image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#ffffff' }), stroke: new Stroke({ color: '#b77932', width: 3 }) }),
          }),
        }),
        new VectorLayer({
          source: observationSource,
          visible: showObservations,
          style: (feature) => {
            const selected = feature.get('observationId') === selectedRef.current;
            return new Style({
              image: new CircleStyle({
                radius: selected ? 10 : 8,
                fill: new Fill({ color: selected ? '#173a3b' : '#f7fbf8' }),
                stroke: new Stroke({ color: selected ? '#ffffff' : '#246b59', width: selected ? 3 : 2.5 }),
              }),
            });
          },
        }),
        new VectorLayer({
          source: pilotReferenceSource,
          style: new Style({
            image: new CircleStyle({ radius: 9, fill: new Fill({ color: '#fffdf8' }), stroke: new Stroke({ color: '#b77932', width: 4 }) }),
          }),
        }),
      ],
      view: new View({
        center: fromLonLat(illustrativeBoundary ? [...INDORE_REFERENCE] : [77.643, 14.690]),
        zoom: illustrativeBoundary ? INDORE_START_ZOOM : 12,
      }),
      controls: defaultControls({ zoom: false, rotate: false }),
    });
    mapRef.current = map;
    const fitWatershed = () => {
      if (illustrativeBoundary) return;
      const extent = boundarySource.getExtent();
      if (extent && extent.every(Number.isFinite)) {
        map.getView().fit(extent, { size: map.getSize() ?? undefined, padding: [60, 60, 60, 60], maxZoom: 14, duration: 450 });
      }
    };
    const firstLayout = window.requestAnimationFrame(() => {
      map.updateSize();
      fitWatershed();
    });
    const resizeObserver = new ResizeObserver(() => map.updateSize());
    resizeObserver.observe(targetRef.current);
    map.on('singleclick', (event) => {
      map.forEachFeatureAtPixel(event.pixel, (feature) => {
        if (feature.get('kind') === 'observation') {
          const id = feature.get('observationId');
          if (id) onSelect(String(id));
          return true;
        }
        return undefined;
      });
    });
    return () => {
      window.cancelAnimationFrame(firstLayout);
      resizeObserver.disconnect();
      map.setTarget(undefined);
      mapRef.current = null;
      boundarySourceRef.current = null;
    };
  }, [watersheds, interventions, observations, showInterventions, showObservations, showIsroLulc, onSelect, illustrativeBoundary]);

  function zoom(delta: number) {
    const view = mapRef.current?.getView();
    if (view) view.animate({ zoom: (view.getZoom() ?? 12) + delta, duration: 180 });
  }

  function resetExtent() {
    const map = mapRef.current;
    if (map && illustrativeBoundary) {
      map.getView().animate({ center: fromLonLat([...INDORE_REFERENCE]), zoom: INDORE_START_ZOOM, duration: 350 });
      return;
    }
    const source = boundarySourceRef.current;
    const extent = source?.getExtent();
    if (map && extent && extent.every(Number.isFinite)) {
      map.getView().fit(extent, { size: map.getSize() ?? undefined, padding: [60, 60, 60, 60], maxZoom: 14, duration: 450 });
    }
  }

  return (
    <div className="map-shell">
      <div ref={targetRef} className="map-canvas" role="img" aria-label={tr('Interactive watershed map', 'इंटरैक्टिव जलागम मानचित्र')} />
      <div className="map-label"><span className="map-label-dot" /> {illustrativeBoundary ? tr('Indore, Madhya Pradesh · approximate reference point', 'इंदौर, मध्य प्रदेश · अनुमानित संदर्भ बिंदु') : tr('Watershed boundary', 'जलागम सीमा')} {!illustrativeBoundary && <><span className="map-label-divider" /> {tr('Observation locations', 'अवलोकन स्थान')}</>}</div>
      <div className="map-controls" role="group" aria-label={tr('Map controls', 'मानचित्र नियंत्रण')}>
        <button type="button" onClick={() => zoom(1)} aria-label={tr('Zoom in', 'ज़ूम बढ़ाएँ')}>+</button>
        <button type="button" onClick={() => zoom(-1)} aria-label={tr('Zoom out', 'ज़ूम घटाएँ')}>−</button>
        <span />
        <button type="button" onClick={resetExtent} aria-label={illustrativeBoundary ? tr('Center Indore reference point', 'इंदौर संदर्भ बिंदु पर केंद्रित करें') : tr('Fit watershed', 'जलागम पर फ़ोकस करें')}>⌖</button>
      </div>
      <div className="map-scale-note">{illustrativeBoundary ? tr('Indore district selected · exact watershed and official boundary pending agency confirmation', 'इंदौर जिला चयनित · सटीक जलागम और आधिकारिक सीमा एजेंसी की पुष्टि के लिए लंबित') : tr('Imported candidate · verify its source', 'आयातित उम्मीदवार · स्रोत सत्यापित करें')}{showIsroLulc ? ' · NRSC/ISRO LULC 2015–16' : ''}</div>
    </div>
  );
}
