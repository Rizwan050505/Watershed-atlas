import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ApiError, getCurrentUser, imageUrl, importWatershed, loadReviewHistory, loadWorkspace, registerAccount, signIn, signOut, updateReview, uploadObservation } from './api';
import type { ReviewEvent, SessionUser, WorkspaceData } from './api';
import { demoWatersheds } from './data/demo';
import { Icon } from './components/Icon';
import { LoginScreen } from './components/LoginScreen';
import { PublicLanding } from './components/PublicLanding';
import { LanguageSwitch } from './components/LanguageSwitch';
import type { Language } from './components/LanguageSwitch';
import type { Observation, ReviewStatus } from './types';

const MapWorkspace = lazy(() => import('./components/MapWorkspace'));

const statusLabel: Record<ReviewStatus, string> = {
  pending: 'Pending review',
  in_review: 'In review',
  approved: 'Reviewed',
  needs_changes: 'Needs follow-up',
};
const qualityFlagLabels: Record<string, [string, string]> = {
  missing_gps: ['Location is missing', 'स्थान उपलब्ध नहीं है'],
  missing_capture_time: ['Capture time is missing', 'कैप्चर समय उपलब्ध नहीं है'],
  possible_duplicate: ['This image matches another upload', 'यह छवि किसी अन्य अपलोड से मेल खाती है'],
  illustrative: ['Synthetic demonstration record', 'काल्पनिक प्रदर्शन अभिलेख'],
  no_image_attached: ['No image is attached', 'कोई छवि संलग्न नहीं है'],
};

function observationDateLabel(observation: Observation, language: Language, compact = false): string {
  const hi = language === 'hi';
  if (observation.captured_at) {
    const captured = new Date(observation.captured_at);
    if (!Number.isNaN(captured.getTime())) {
      return compact
        ? captured.toLocaleDateString(hi ? 'hi-IN' : 'en-IN')
        : captured.toLocaleString(hi ? 'hi-IN' : 'en-IN');
    }
  }
  const exifDate = observation.metadata?.exif_date_original;
  if (typeof exifDate === 'string' && exifDate.trim()) {
    return compact
      ? `${hi ? 'EXIF समय' : 'EXIF time'} · ${exifDate.split(' ')[0]}`
      : `${exifDate} · ${hi ? 'EXIF समय; समय क्षेत्र दर्ज नहीं' : 'EXIF time; time zone not recorded'}`;
  }
  return hi ? 'तिथि उपलब्ध नहीं' : 'Date not supplied';
}

function QualityFlags({ observation, language }: { observation: Observation; language: Language }) {
  if (!observation.quality_flags?.length) return null;
  const hi = language === 'hi';
  return <div className="quality-flags" role="status">
    <strong>{hi ? 'डेटा गुणवत्ता जाँच' : 'Data quality checks'}</strong>
    <ul>{observation.quality_flags.map((flag) => <li key={flag}>{qualityFlagLabels[flag]?.[hi ? 1 : 0] ?? flag.replaceAll('_', ' ')}</li>)}</ul>
  </div>;
}

type ModuleId = 'overview' | 'spatial' | 'evidence' | 'interventions' | 'satellite' | 'reports';
type AuthPage = 'login' | 'register' | 'public';
const modules: { id: ModuleId; label: string; hi: string; icon: 'map' | 'layers' | 'photo' | 'target' | 'leaf' | 'download' }[] = [
  { id: 'overview', label: 'Overview', hi: 'अवलोकन', icon: 'map' },
  { id: 'spatial', label: 'Spatial workspace', hi: 'स्थानिक कार्यक्षेत्र', icon: 'layers' },
  { id: 'evidence', label: 'Field evidence', hi: 'मैदानी साक्ष्य', icon: 'photo' },
  { id: 'interventions', label: 'Interventions', hi: 'हस्तक्षेप', icon: 'target' },
  { id: 'satellite', label: 'Satellite analysis', hi: 'उपग्रह विश्लेषण', icon: 'leaf' },
  { id: 'reports', label: 'Reports & validation', hi: 'रिपोर्ट और सत्यापन', icon: 'download' },
];

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authPage, setAuthPage] = useState<AuthPage>(() => {
    const path = window.location.pathname;
    return path === '/register' ? 'register' : path === '/login' ? 'login' : 'public';
  });
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeWatershedId, setActiveWatershedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInterventions, setShowInterventions] = useState(true);
  const [showObservations, setShowObservations] = useState(true);
  const [showIsroLulc, setShowIsroLulc] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [boundaryOpen, setBoundaryOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [uploading, setUploading] = useState(false);
  const [importingBoundary, setImportingBoundary] = useState(false);
  const [reviewHistoryVersion, setReviewHistoryVersion] = useState(0);
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('watershed-language') === 'hi' ? 'hi' : 'en');
  const hi = language === 'hi';
  const tr = (en: string, hindi: string) => hi ? hindi : en;

  useEffect(() => { localStorage.setItem('watershed-language', language); }, [language]);

  const refresh = useCallback(async () => {
    const data = await loadWorkspace();
    setWorkspace(data);
    setActiveWatershedId((current) => {
      const available = data.watersheds.features;
      return available.find((feature) => feature.id === current)?.id
        ?? available.find((feature) => feature.properties.data_origin !== 'illustrative')?.id
        ?? available[0]?.id
        ?? null;
    });
    setSelectedId((current) => current ?? data.observations[0]?.id ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    void getCurrentUser().then(async (user) => {
      if (!active) return;
      setSession(user);
      try {
        await refresh();
      } catch (error) {
        if (active) {
          setSession(null);
          if (error instanceof ApiError && error.status !== 401) setToast(error.message);
        }
      }
    }).catch(() => {
      // A local API may be stopped. Keep the sign-in screen usable for the demo preview.
    }).finally(() => { if (active) setAuthReady(true); });
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => {
    const syncPath = () => {
      const path = window.location.pathname;
      setAuthPage(path === '/register' ? 'register' : path === '/login' ? 'login' : 'public');
    };
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!mapExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMapExpanded(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mapExpanded]);

  useEffect(() => {
    if (activeModule !== 'spatial') setMapExpanded(false);
  }, [activeModule]);

  async function handleSignIn(email: string, password: string) {
    const user = await signIn(email, password);
    setSession(user);
    navigateAuth('public');
    try {
      await refresh();
    } catch (error) {
      setSession(null);
      throw error;
    }
  }

  async function handleRegistration(displayName: string, email: string, password: string) {
    const user = await registerAccount(displayName, email, password);
    setSession(user);
    navigateAuth('public');
    try {
      await refresh();
    } catch (error) {
      setSession(null);
      throw error;
    }
  }

  function handleSignOut() {
    // Close the local session immediately; a slow/offline API must not trap the user here.
    void signOut().catch(() => undefined);
    setSession(null);
    setWorkspace(null);
    navigateAuth('public');
  }

  function navigateAuth(page: AuthPage) {
    const path = page === 'public' ? '/' : `/${page}`;
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setAuthPage(page);
  }

  const watershedFeatures = workspace?.watersheds.features ?? demoWatersheds.features;
  const watershedFeature = watershedFeatures.find((feature) => feature.id === activeWatershedId) ?? watershedFeatures[0];
  const watershedId = watershedFeature?.id ?? null;
  const observations = (workspace?.observations ?? []).filter((observation) => observation.watershed_id === watershedId);
  const selected = observations.find((observation) => observation.id === selectedId) ?? observations[0] ?? null;
  const allInterventions = workspace?.interventions;
  const activeWatersheds = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: watershedFeature ? [watershedFeature] : [],
  }), [watershedFeature]);
  const activeInterventions = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: (allInterventions?.features ?? []).filter((feature) => feature.properties.watershed_id === watershedId),
  }), [allInterventions, watershedId]);
  const watershedName = String(watershedFeature?.properties.name ?? 'Watershed workspace');
  const indoreDistrictFocus = watershedFeature?.properties.data_origin === 'illustrative';
  const activeAreaBreadcrumb = indoreDistrictFocus
    ? tr('Indore district · pilot area selected', 'इंदौर जिला · पायलट क्षेत्र चयनित')
    : watershedName;
  const pilotConfirmed = watershedFeature?.properties.pilot_confirmed === true;
  const summary = workspace ? {
    ...workspace.summary,
    watershed_count: watershedFeature ? 1 : 0,
    intervention_count: activeInterventions.features.length,
    observation_count: observations.length,
    photo_count: observations.filter((item) => item.has_image).length,
    pending_count: observations.filter((item) => item.review_status === 'pending').length,
    illustrative_count: observations.filter((item) => item.data_origin === 'illustrative').length,
  } : undefined;
  const filteredObservations = useMemo(() => observations.filter((item) =>
    `${item.category} ${item.description} ${item.intervention_name ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  ), [observations, search]);

  async function handleUpload(file: File, category: string, description: string, latitude?: string, longitude?: string) {
    setUploading(true);
    try {
      await uploadObservation(file, {
        category,
        description,
        watershedId: watershedFeature?.id ?? '',
        latitude,
        longitude,
      });
      setUploadOpen(false);
      await refresh();
      setToast(tr('Evidence uploaded. Review the location and metadata flags before approval.', 'साक्ष्य अपलोड हुआ। स्वीकृति से पहले स्थान और मेटाडेटा संकेतों की समीक्षा करें।'));
    } catch (error) {
      setToast(error instanceof Error ? error.message : tr('Upload failed. Check that the API is running.', 'अपलोड विफल। जाँचें कि API चल रहा है।'));
    } finally {
      setUploading(false);
    }
  }

  async function handleBoundaryImport(file: File, name: string, adminArea: string, source: string) {
    setImportingBoundary(true);
    try {
      const imported = await importWatershed(file, { name, adminArea, source });
      setActiveWatershedId(imported.id);
      setBoundaryOpen(false);
      await refresh();
      setToast(tr('Boundary added as an unverified candidate. It is not marked as the confirmed pilot site.', 'सीमा को अप्रमाणित उम्मीदवार के रूप में जोड़ा गया है। इसे पुष्टि किया हुआ पायलट स्थल नहीं माना गया है।'));
    } catch (error) {
      setToast(error instanceof Error ? error.message : tr('Boundary import failed. Check that the API is running.', 'सीमा आयात विफल। जाँचें कि API चल रहा है।'));
    } finally {
      setImportingBoundary(false);
    }
  }

  async function handleReview(observation: Observation, status: ReviewStatus) {
    if (!workspace?.live || observation.data_origin === 'illustrative') {
      setWorkspace((current) => current ? {
        ...current,
        observations: current.observations.map((item) => item.id === observation.id ? { ...item, review_status: status } : item),
      } : current);
      setToast(tr('Demo review state changed locally. It is not an operational decision.', 'डेमो समीक्षा स्थिति केवल यहीं बदली है। यह संचालन संबंधी निर्णय नहीं है।'));
      return;
    }
    try {
      await updateReview(observation.id, status, 'Reviewed in watershed workspace');
      setReviewHistoryVersion((version) => version + 1);
      await refresh();
      setToast(hi ? `अवलोकन की स्थिति: ${{ pending: 'समीक्षा लंबित', in_review: 'समीक्षा जारी', approved: 'समीक्षित', needs_changes: 'अनुवर्ती कार्रवाई आवश्यक' }[status]}.` : `Observation marked ${statusLabel[status].toLowerCase()}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : tr('Could not save review.', 'समीक्षा सहेजी नहीं जा सकी।'));
    }
  }

  function exportSummary() {
    if (!workspace) return;
    const rows = [
      ['Observation ID', 'Category', 'Intervention', 'Status', 'Captured at', 'Longitude', 'Latitude', 'Data origin', 'Quality flags', 'Photo attached', 'Description'],
      ...observations.map((item) => [item.id, item.category, item.intervention_name ?? '', statusLabel[item.review_status],
        item.captured_at ?? String(item.metadata?.exif_date_original ?? ''), item.longitude?.toString() ?? '', item.latitude?.toString() ?? '', item.data_origin, item.quality_flags?.join('; ') ?? '', item.has_image ? 'yes' : 'no', item.description]),
    ];
    const csvCell = (value: string) => {
      const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replaceAll('"', '""')}"`;
    };
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'watershed-observation-summary.csv';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!authReady) {
    return <div className="loading-screen" lang={language}><div className="loading-mark"><Icon name="water" /></div><span>{tr('Opening watershed workspace', 'जलागम कार्यक्षेत्र खुल रहा है')}</span></div>;
  }
  if (!session) {
    if (authPage === 'public') return <PublicLanding language={language} onLanguageChange={setLanguage} onLogin={() => navigateAuth('login')} onRegister={() => navigateAuth('register')} />;
    return <LoginScreen key={authPage} page={authPage} language={language} onLanguageChange={setLanguage} onSignIn={handleSignIn} onRegister={handleRegistration} onPageChange={navigateAuth} />;
  }
  if (!workspace) return <div className="loading-screen" lang={language}><div className="loading-mark"><Icon name="water" /></div><span>{tr('Opening watershed workspace', 'जलागम कार्यक्षेत्र खुल रहा है')}</span></div>;

  const activeModuleTitle = modules.find((module) => module.id === activeModule)?.[hi ? 'hi' : 'label'] ?? tr('Overview', 'अवलोकन');
  const canUpload = workspace.live && (session?.role === 'admin' || session?.role === 'field_staff');
  const canImportBoundary = workspace.live && session?.role === 'admin';
  const canReview = workspace.live && (session?.role === 'admin' || session?.role === 'reviewer');

  return (
    <div className={`app-frame${mapExpanded ? ' has-expanded-map' : ''}`} lang={language}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Icon name="water" /></div>
          <div><div className="brand-name">Watershed Atlas</div><div className="brand-subtitle">{tr('FIELD EVIDENCE WORKSPACE', 'मैदानी साक्ष्य कार्यक्षेत्र')}</div></div>
        </div>
        <div className="topbar-center"><span className="workspace-crumb">{activeModuleTitle}</span><span className="crumb-slash">/</span><span className="workspace-current">{activeAreaBreadcrumb}</span></div>
        <div className="topbar-actions">
          <LanguageSwitch language={language} onChange={setLanguage} />
          <div className={`connection-pill ${workspace.live ? 'is-live' : 'is-demo'}`}>
            <span className="connection-dot" />{workspace.live ? tr('Local API connected', 'स्थानीय API जुड़ा है') : tr('Illustrative demo data', 'उदाहरणात्मक डेमो डेटा')}
          </div>
          <button className="button button-outline export-button" onClick={exportSummary}><Icon name="download" /> {tr('Export', 'निर्यात')}</button>
          {canUpload && <button className="button button-primary" onClick={() => setUploadOpen(true)}><Icon name="plus" /> {tr('Add evidence', 'साक्ष्य जोड़ें')}</button>}
          <div className="account-chip"><span className="account-avatar">{(session.display_name?.[0] ?? 'U').toUpperCase()}</span><span><strong>{session.display_name}</strong><small>{session.role.replace('_', ' ')}</small></span><button type="button" className="account-signout" onClick={handleSignOut} aria-label={tr('Sign out', 'लॉग आउट')}>{tr('Sign out', 'लॉग आउट')}</button></div>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-scroll">
            <div className="side-section-label">{tr('WORKSPACE', 'कार्यक्षेत्र')}</div>
            <button className="project-selector">
              <span className="project-avatar">WS</span>
              <span className="project-text"><strong>{tr('Watershed monitoring', 'जलागम निगरानी')}</strong><small>{tr('Local pilot workspace', 'स्थानीय पायलट कार्यक्षेत्र')}</small></span>
              <Icon name="chevron" className="selector-chevron" />
            </button>

            <ModuleNav active={activeModule} onSelect={setActiveModule} className="sidebar-module-nav" language={language} />

            <div className="side-section-heading"><span>{tr('Focus area', 'प्रमुख क्षेत्र')}</span>{canImportBoundary && <button className="text-icon-button" title={tr('Import a candidate boundary', 'उम्मीदवार सीमा आयात करें')} aria-label={tr('Import a candidate boundary', 'उम्मीदवार सीमा आयात करें')} onClick={() => setBoundaryOpen(true)}><Icon name="plus" /></button>}</div>
            <div className="area-card">
              <div className="area-card-top"><span className="area-symbol"><Icon name="map" /></span><span className="area-status"><i />{pilotConfirmed ? tr('Confirmed pilot', 'पुष्टि किया पायलट') : watershedFeature?.properties.data_origin === 'illustrative' ? tr('Demo area', 'डेमो क्षेत्र') : tr('Candidate area', 'उम्मीदवार क्षेत्र')}</span></div>
              <strong>{watershedName}</strong>
              <span className="area-location">{String(watershedFeature?.properties.admin_area ?? 'Area not specified')}</span>
              {watershedFeatures.length > 1 && <label className="area-select-label"><span>{tr('Switch area', 'क्षेत्र बदलें')}</span><select value={watershedId ?? ''} onChange={(event) => { setActiveWatershedId(event.target.value); setSelectedId(null); }} aria-label={tr('Active watershed', 'सक्रिय जलागम')}>
                {watershedFeatures.map((feature) => <option key={feature.id} value={feature.id}>{String(feature.properties.name ?? 'Unnamed watershed')}</option>)}
              </select></label>}
              <div className="area-card-footer"><span><Icon name="map" /> {Number(watershedFeature?.properties.area_sq_km ?? 0).toFixed(1)} km²</span><span className="source-tag">{workspace.live ? 'POSTGIS' : 'SAMPLE'}</span></div>
            </div>

            <div className="side-section-heading layer-heading"><span>{tr('Map layers', 'मानचित्र परतें')}</span><span className="muted-count">{Number(showIsroLulc) + Number(showInterventions) + Number(showObservations)} {tr('active', 'सक्रिय')}</span></div>
            <label className="layer-row">
              <span className="layer-symbol boundary-symbol"><Icon name="map" /></span>
              <span className="layer-copy"><strong>{tr('Watershed boundary', 'जलागम सीमा')}</strong><small>{tr('Study area', 'अध्ययन क्षेत्र')}</small></span>
              <input type="checkbox" checked readOnly aria-label={tr('Watershed boundary visible', 'जलागम सीमा दिखाई दे रही है')} />
            </label>
            <label className="layer-row">
              <span className="layer-symbol intervention-symbol"><Icon name="target" /></span>
              <span className="layer-copy"><strong>{tr('Interventions', 'हस्तक्षेप')}</strong><small>{summary?.intervention_count ?? 0} {tr('records', 'अभिलेख')}</small></span>
              <input type="checkbox" checked={showInterventions} onChange={(event) => setShowInterventions(event.target.checked)} aria-label={tr('Toggle intervention layer', 'हस्तक्षेप परत टॉगल करें')} />
            </label>
            <label className="layer-row">
              <span className="layer-symbol isro-symbol"><Icon name="leaf" /></span>
              <span className="layer-copy"><strong>ISRO · Bhuvan LULC</strong><small>2015–16 · 1:250,000</small></span>
              <input type="checkbox" checked={showIsroLulc} onChange={(event) => setShowIsroLulc(event.target.checked)} aria-label={tr('Toggle ISRO Bhuvan land cover layer', 'ISRO Bhuvan भूमि आवरण परत टॉगल करें')} />
            </label>
            <label className="layer-row">
              <span className="layer-symbol observation-symbol"><Icon name="photo" /></span>
              <span className="layer-copy"><strong>{tr('Field observations', 'मैदानी अवलोकन')}</strong><small>{summary?.observation_count ?? 0} {tr('records', 'अभिलेख')}</small></span>
              <input type="checkbox" checked={showObservations} onChange={(event) => setShowObservations(event.target.checked)} aria-label={tr('Toggle observations layer', 'अवलोकन परत टॉगल करें')} />
            </label>

            <div className="side-section-heading timeline-heading"><span>{tr('Observation window', 'अवलोकन अवधि')}</span><Icon name="clock" className="quiet-icon" /></div>
            <div className="date-selects"><button disabled>{tr('From', 'से')} <strong>—</strong><Icon name="chevron" /></button><span>{tr('to', 'तक')}</span><button disabled>{tr('To', 'तक')} <strong>—</strong><Icon name="chevron" /></button></div>
            <div className="timeline-note"><span className="timeline-mark" />{tr('No satellite scenes connected yet', 'अभी कोई उपग्रह दृश्य जुड़ा नहीं है')}</div>

            <div className="side-section-heading evidence-heading"><span>{tr('Evidence queue', 'साक्ष्य कतार')}</span><span className="queue-count">{summary?.pending_count ?? 0}</span></div>
            <div className="queue-card">
              <div className="queue-card-icon"><Icon name="photo" /></div>
              <div className="queue-card-copy"><strong>{summary?.photo_count ?? 0} {tr('photos available', 'फोटो उपलब्ध')}</strong><span>{summary?.observation_count ?? 0} {tr('observation records', 'अवलोकन अभिलेख')}</span></div>
              <Icon name="arrow" className="queue-arrow" />
            </div>

            <div className="sidebar-note"><Icon name="alert" /><span>{watershedFeature?.properties.data_origin === 'illustrative'
              ? tr('Demo records are synthetic. No official boundary or field image is connected.', 'डेमो अभिलेख काल्पनिक हैं। कोई आधिकारिक सीमा या मैदानी छवि नहीं जुड़ी है.')
              : tr('This boundary is a candidate only. Confirm its source and pilot status with the agency.', 'यह केवल संभावित सीमा है। एजेंसी के साथ स्रोत और पायलट स्थिति की पुष्टि करें।')}</span></div>
          </div>
          <div className="sidebar-footer"><span className="footer-avatar">WP</span><span><strong>{tr('Local pilot', 'स्थानीय पायलट')}</strong><small>{tr('Development environment', 'विकास परिवेश')}</small></span><button className="more-button" aria-label={tr('More workspace options', 'कार्यक्षेत्र के अन्य विकल्प')}>···</button></div>
        </aside>

        <main className="main-content">
          <ModuleNav active={activeModule} onSelect={setActiveModule} className="mobile-module-nav" language={language} />
          {activeModule === 'overview' && <>
          <div className="page-intro">
            <div><div className="eyebrow">{tr('WATERSHED OVERVIEW', 'जलागम अवलोकन')} <span className="eyebrow-divider">/</span> {workspace.live ? 'POSTGIS CONNECTED' : tr('SAMPLE DATA', 'नमूना डेटा')}</div><h1>{tr('Evidence at a glance', 'साक्ष्य एक नज़र में')}</h1><p>{tr('Explore watershed features and review the field evidence linked to them.', 'जलागम की विशेषताएँ देखें और उनसे जुड़े मैदानी साक्ष्य की समीक्षा करें।')}</p></div>
            <div className="updated-label"><span className="updated-dot" /> {tr('Local workspace', 'स्थानीय कार्यक्षेत्र')}</div>
          </div>

          <section className="metric-grid" aria-label={tr('Workspace summary', 'कार्यक्षेत्र सारांश')}>
            <Metric icon="map" label={tr('Watersheds', 'जलागम')} value={summary?.watershed_count ?? 0} note={tr('In this workspace', 'इस कार्यक्षेत्र में')} tone="green" />
            <Metric icon="target" label={tr('Interventions', 'हस्तक्षेप')} value={summary?.intervention_count ?? 0} note={tr('Spatial records', 'स्थानिक अभिलेख')} tone="sand" />
            <Metric icon="photo" label={tr('Observations', 'अवलोकन')} value={summary?.observation_count ?? 0} note={tr('Field evidence records', 'मैदानी साक्ष्य अभिलेख')} tone="blue" />
            <Metric icon="clock" label={tr('Awaiting review', 'समीक्षा लंबित')} value={summary?.pending_count ?? 0} note={`${summary?.photo_count ?? 0} ${tr('photos attached', 'फोटो संलग्न')}`} tone="rose" />
          </section>

          <section className={`pilot-notice ${pilotConfirmed ? 'is-confirmed' : ''}`} aria-label={tr('Pilot site selection status', 'पायलट स्थल चयन स्थिति')}>
            <div className="pilot-notice-icon"><Icon name="map" /></div>
            <div className="pilot-notice-copy">
              <span>{pilotConfirmed ? tr('PILOT SITE CONFIRMED', 'पायलट स्थल की पुष्टि हुई') : tr('PILOT SITE PENDING', 'पायलट स्थल लंबित')}</span>
              <strong>{pilotConfirmed ? watershedName : indoreDistrictFocus ? tr('Indore district selected · exact watershed pending', 'इंदौर जिला चयनित · सटीक जलागम लंबित') : tr('Final watershed location to be agreed with the agency', 'अंतिम जलागम स्थल एजेंसी के साथ तय होगा')}</strong>
              <p>{pilotConfirmed
                ? tr('The selected watershed is marked for the pilot. Confirm source records and field validation before interpreting analysis results.', 'चयनित जलागम पायलट के लिए चिह्नित है। विश्लेषण समझने से पहले स्रोत अभिलेखों और मैदानी सत्यापन की पुष्टि करें।')
                : tr('Choose a representative rural or semi-arid watershed after checking boundary, geocoded field-image, satellite-scene, access, and validation availability. All current sample features are synthetic.', 'सीमा, भू-टैग की गई मैदानी छवियों, उपग्रह दृश्यों, पहुँच और सत्यापन की उपलब्धता जाँचकर ग्रामीण या अर्ध-शुष्क क्षेत्र का प्रतिनिधि जलागम चुनें। वर्तमान सभी नमूना सुविधाएँ काल्पनिक हैं।')}</p>
            </div>
            <span className="pilot-notice-tag">{tr('SITE SELECTION', 'स्थल चयन')}</span>
          </section>

          <section className="map-panel">
            <div className="map-panel-header">
              <div className="map-title-group"><div className="map-title-icon"><Icon name="map" /></div><div><h2>{tr('Spatial workspace', 'स्थानिक कार्यक्षेत्र')}</h2><p>{tr('Boundary, interventions, and field observations', 'सीमा, हस्तक्षेप और मैदानी अवलोकन')}</p></div></div>
              <div className="map-header-actions"><span className="map-date-chip"><Icon name="clock" /> {tr('Comparison dates not set', 'तुलना की तिथियाँ तय नहीं')}</span>{canImportBoundary && <button className="button button-small button-outline import-boundary-button" onClick={() => setBoundaryOpen(true)}><Icon name="map" /> {tr('Import boundary', 'सीमा आयात करें')}</button>}<button className="button button-small button-outline" onClick={exportSummary}><Icon name="download" /> {tr('Report data', 'डेटा रिपोर्ट')}</button></div>
            </div>
            <div className="map-and-inspector">
              <div className="map-container">
                <Suspense fallback={<div className="map-loading">{tr('Loading interactive map…', 'इंटरैक्टिव मानचित्र लोड हो रहा है…')}</div>}>
                  <MapWorkspace
                    watersheds={activeWatersheds}
                    interventions={activeInterventions}
                    observations={observations}
                    selectedId={selected?.id ?? null}
                    showInterventions={showInterventions}
                    showObservations={showObservations}
                    showIsroLulc={showIsroLulc}
                    language={language}
                    onSelect={setSelectedId}
                  />
                </Suspense>
                <div className="map-top-note"><span className="map-top-icon"><Icon name="layers" /></span><span><strong>{tr('Layer view', 'परत दृश्य')}</strong><small>OpenStreetMap · {watershedFeature?.properties.data_origin === 'illustrative' ? tr('sample features', 'नमूना सुविधाएँ') : tr('workspace features', 'कार्यक्षेत्र सुविधाएँ')}</small></span></div>
              </div>
              <aside className="inspector">
                <div className="inspector-heading"><div><span className="eyebrow">{tr('FIELD RECORDS', 'मैदानी अभिलेख')}</span><h3>{tr('Recent observations', 'हाल के अवलोकन')}</h3></div><span className="inspector-total">{filteredObservations.length}</span></div>
                <div className="search-box"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('Search evidence', 'साक्ष्य खोजें')} aria-label={tr('Search observations', 'अवलोकन खोजें')} /></div>
                <div className="observation-list">
                  {filteredObservations.length ? filteredObservations.map((item) => (
                    <ObservationItem key={item.id} observation={item} selected={selected?.id === item.id} onSelect={() => setSelectedId(item.id)} language={language} />
                  )) : <div className="empty-filter">{tr('No matching observations', 'कोई मेल खाता अवलोकन नहीं')}</div>}
                </div>
                {selected && <div className="selected-record">
                  <div className="selected-record-head"><span>{tr('SELECTED RECORD', 'चयनित अभिलेख')}</span><button className="text-icon-button" onClick={() => setSelectedId(null)} aria-label={tr('Clear selected observation', 'चयनित अवलोकन हटाएँ')}><Icon name="close" /></button></div>
                  <div className="record-category"><span className="category-dot" />{selected.category}</div>
                  <div className="record-description">{selected.description || tr('No note provided.', 'कोई टिप्पणी नहीं दी गई।')}</div>
                  {selected.intervention_name && <div className="record-link"><Icon name="target" /><span>{selected.intervention_name}</span></div>}
                  {selected.has_image && selected.image_url ? <img className="record-photo" src={imageUrl(selected.image_url)} alt={tr('Uploaded field evidence', 'अपलोड किया गया मैदानी साक्ष्य')} /> : <div className="no-photo"><Icon name="photo" /><span>{selected.data_origin === 'illustrative' ? tr('Illustrative marker only', 'केवल उदाहरणात्मक संकेतक') : tr('No image attached', 'कोई छवि संलग्न नहीं')}</span></div>}
                  <div className="record-meta"><span>{tr('Location', 'स्थान')}</span><strong>{selected.latitude != null && selected.longitude != null ? `${selected.latitude.toFixed(4)}, ${selected.longitude.toFixed(4)}` : tr('Not geotagged', 'भू-टैग नहीं किया गया')}</strong></div>
                  <div className="record-meta"><span>{tr('Captured', 'कैप्चर किया')}</span><strong>{observationDateLabel(selected, language)}</strong></div>
                  <div className="record-meta"><span>{tr('Review status', 'समीक्षा स्थिति')}</span><strong className={`status-text status-${selected.review_status}`}>{hi ? ({ pending: 'समीक्षा लंबित', in_review: 'समीक्षा जारी', approved: 'समीक्षित', needs_changes: 'अनुवर्ती कार्रवाई आवश्यक' } as Record<ReviewStatus, string>)[selected.review_status] : statusLabel[selected.review_status]}</strong></div>
                  <QualityFlags observation={selected} language={language} />
                  {selected.data_origin === 'illustrative' ? <div className="record-warning"><Icon name="alert" /> {tr('Sample content cannot be approved as field evidence.', 'नमूना सामग्री को मैदानी साक्ष्य के रूप में स्वीकृत नहीं किया जा सकता।')}</div> : <div className="review-actions">
                    {canReview && <><button className="button button-review" onClick={() => void handleReview(selected, 'in_review')}>{tr('Mark in review', 'समीक्षा में चिह्नित करें')}</button>
                    <button className="button button-approve" onClick={() => void handleReview(selected, 'approved')}><Icon name="check" /> {tr('Approve', 'स्वीकृत करें')}</button></>}
                  </div>}
                </div>}
                {!selected && <div className="inspector-empty"><Icon name="target" /><strong>{tr('Select a map marker', 'मानचित्र संकेतक चुनें')}</strong><span>{tr('Choose a record to inspect its location and review details.', 'स्थान और समीक्षा विवरण देखने के लिए अभिलेख चुनें।')}</span></div>}
                <div className="analysis-placeholder"><div className="analysis-placeholder-icon"><Icon name="leaf" /></div><div><strong>{tr('ISRO thematic context', 'ISRO विषयगत संदर्भ')}</strong><span>{tr('Bhuvan LULC 2015–16 is connected; time-series scene analysis is pending.', 'Bhuvan LULC 2015–16 जुड़ा है; समय-श्रृंखला दृश्य विश्लेषण लंबित है।')}</span></div><span className="coming-soon">WMS LIVE</span></div>
              </aside>
            </div>
            <div className="map-panel-footer"><div className="legend"><span><i className="legend-boundary" /> {tr('Watershed', 'जलागम')}</span><span><i className="legend-intervention" /> {tr('Intervention', 'हस्तक्षेप')}</span><span><i className="legend-observation" /> {tr('Observation', 'अवलोकन')}</span></div><div className="map-footer-right"><span>{tr('Source', 'स्रोत')}: {workspace.live ? 'Local PostGIS' : tr('Synthetic development fixture', 'काल्पनिक विकास नमूना')}</span><span className="footer-separator" />EPSG:4326</div></div>
          </section>
          <footer className="main-footer"><span>{tr('Evidence review supports field decisions; it does not replace field validation.', 'साक्ष्य समीक्षा मैदानी निर्णयों में सहायक है; यह मैदानी सत्यापन का विकल्प नहीं है।')}</span><span>{tr('Local pilot', 'स्थानीय पायलट')} · v0.1</span></footer>
          </>}

          {activeModule === 'spatial' && <ModulePage language={language} title={tr('Spatial workspace', 'स्थानिक कार्यक्षेत्र')} eyebrow={tr('MAP & LAYERS', 'मानचित्र और परतें')} description={tr('Explore the watershed boundary, field records, and ISRO Bhuvan thematic land-cover context.', 'जलागम सीमा, मैदानी अभिलेख और ISRO Bhuvan भूमि-आवरण संदर्भ देखें।')}>
            {mapExpanded && <div className="map-expanded-backdrop" aria-hidden="true" />}
            <section id="watershed-spatial-map" className={`map-panel module-map-panel${mapExpanded ? ' is-expanded' : ''}`}>
              <div className="map-panel-header"><div className="map-title-group"><div className="map-title-icon"><Icon name="layers" /></div><div><h2>{watershedName}</h2><p>{String(watershedFeature?.properties.admin_area ?? tr('Area not specified', 'क्षेत्र निर्दिष्ट नहीं'))} · {Number(watershedFeature?.properties.area_sq_km ?? 0).toFixed(1)} km²</p></div></div><div className="map-header-actions">{canImportBoundary && <button className="button button-small button-outline" onClick={() => setBoundaryOpen(true)}><Icon name="map" /> {tr('Import boundary', 'सीमा आयात करें')}</button>}<button className="button button-small button-outline map-expand-button" onClick={() => setMapExpanded((expanded) => !expanded)} aria-controls="watershed-spatial-map" aria-pressed={mapExpanded} aria-label={mapExpanded ? tr('Minimize map', 'मानचित्र छोटा करें') : tr('Expand map', 'मानचित्र बड़ा करें')}><svg viewBox="0 0 20 20" aria-hidden="true">{mapExpanded ? <path d="M7 3v4H3m14 0h-4V3M3 13h4v4m10-4h-4v4" /> : <path d="M3 7V3h4m6 0h4v4M17 13v4h-4m-6 0H3v-4" />}</svg>{mapExpanded ? tr('Minimize map', 'छोटा करें') : tr('Expand map', 'बड़ा करें')}</button></div></div>
              <div className="module-map-canvas"><Suspense fallback={<div className="map-loading">{tr('Loading interactive map…', 'इंटरैक्टिव मानचित्र लोड हो रहा है…')}</div>}><MapWorkspace watersheds={activeWatersheds} interventions={activeInterventions} observations={observations} selectedId={selected?.id ?? null} showInterventions={showInterventions} showObservations={showObservations} showIsroLulc={showIsroLulc} language={language} onSelect={setSelectedId} /></Suspense></div>
              <div className="map-panel-footer"><div className="legend"><span><i className="legend-boundary" /> {tr('Watershed', 'जलागम')}</span><span><i className="legend-intervention" /> {tr('Intervention', 'हस्तक्षेप')}</span><span><i className="legend-observation" /> {tr('Observation', 'अवलोकन')}</span></div><div className="map-footer-right">{workspace.live ? 'PostGIS' : tr('Synthetic development fixture', 'काल्पनिक विकास नमूना')} · EPSG:4326 · NRSC/ISRO LULC</div></div>
            </section>
            <div className="module-two-column"><ModuleStat label={tr('Boundary status', 'सीमा स्थिति')} value={pilotConfirmed ? tr('Pilot confirmed', 'पायलट की पुष्टि') : watershedFeature?.properties.data_origin === 'illustrative' ? tr('Illustrative sample', 'उदाहरणात्मक नमूना') : tr('Unverified candidate', 'अप्रमाणित उम्मीदवार')} /><ModuleStat label={tr('Visible map layers', 'दृश्य मानचित्र परतें')} value={`${1 + Number(showInterventions) + Number(showObservations)} ${tr('enabled', 'सक्रिय')}`} /><ModuleStat label={tr('Source', 'स्रोत')} value={String(watershedFeature?.properties.source ?? tr('Not supplied', 'उपलब्ध नहीं'))} /></div>
          </ModulePage>}

          {activeModule === 'evidence' && <ModulePage language={language} title={tr('Field evidence', 'मैदानी साक्ष्य')} eyebrow={tr('OBSERVATIONS & REVIEW', 'अवलोकन और समीक्षा')} description={tr('Search observations, inspect location metadata, and review source records before using them for decisions.', 'निर्णयों में उपयोग से पहले अवलोकन खोजें, स्थान मेटाडेटा देखें और स्रोत अभिलेखों की समीक्षा करें।')}>
            <div className="module-toolbar"><div className="search-box"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('Search evidence', 'साक्ष्य खोजें')} aria-label={tr('Search observations', 'अवलोकन खोजें')} /></div><span>{filteredObservations.length} {tr('records', 'अभिलेख')} · {summary?.photo_count ?? 0} {tr('images attached', 'छवियाँ संलग्न')}</span>{canUpload && <button className="button button-primary" onClick={() => setUploadOpen(true)}><Icon name="plus" /> {tr('Add evidence', 'साक्ष्य जोड़ें')}</button>}</div>
            <div className="evidence-module-grid"><section className="module-card"><h2>{tr('Observation queue', 'अवलोकन कतार')}</h2><div className="module-observation-list">{filteredObservations.length ? filteredObservations.map((item) => <ObservationItem key={item.id} observation={item} selected={selected?.id === item.id} onSelect={() => setSelectedId(item.id)} language={language} />) : <div className="empty-filter">{tr('No matching observations', 'कोई मेल खाता अवलोकन नहीं')}</div>}</div></section>
              <section className="module-card evidence-detail"><h2>{tr('Record details', 'अभिलेख विवरण')}</h2>{selected ? <><div className="record-category"><span className="category-dot" />{selected.category}</div><p>{selected.description || tr('No note provided.', 'कोई टिप्पणी नहीं दी गई।')}</p><div className="record-meta"><span>{tr('Captured', 'कैप्चर किया')}</span><strong>{observationDateLabel(selected, language)}</strong></div><div className="record-meta"><span>{tr('Coordinates', 'निर्देशांक')}</span><strong>{selected.latitude != null && selected.longitude != null ? `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}` : tr('Not geotagged', 'भू-टैग नहीं किया गया')}</strong></div><div className="record-meta"><span>{tr('Review status', 'समीक्षा स्थिति')}</span><strong>{hi ? ({ pending: 'समीक्षा लंबित', in_review: 'समीक्षा जारी', approved: 'समीक्षित', needs_changes: 'अनुवर्ती कार्रवाई आवश्यक' } as Record<ReviewStatus, string>)[selected.review_status] : statusLabel[selected.review_status]}</strong></div><div className="record-meta"><span>{tr('Source', 'स्रोत')}</span><strong>{selected.data_origin}</strong></div><QualityFlags observation={selected} language={language} />{canReview && workspace.live && <ReviewHistory observationId={selected.id} language={language} refreshVersion={reviewHistoryVersion} />}{selected.has_image && selected.image_url ? <img className="record-photo module-record-photo" src={imageUrl(selected.image_url)} alt={tr('Uploaded field evidence', 'अपलोड किया गया मैदानी साक्ष्य')} /> : <div className="no-photo"><Icon name="photo" /><span>{selected.data_origin === 'illustrative' ? tr('No real field image connected', 'वास्तविक मैदानी छवि नहीं जुड़ी') : tr('No image attached', 'कोई छवि संलग्न नहीं')}</span></div>}{selected.data_origin === 'illustrative' && <div className="record-warning"><Icon name="alert" /> {tr('Illustrative records cannot be treated as reviewed field evidence.', 'उदाहरणात्मक अभिलेखों को समीक्षित मैदानी साक्ष्य नहीं माना जा सकता।')}</div>}</> : <p>{tr('No observation is selected.', 'कोई अवलोकन चयनित नहीं है।')}</p>}</section>
            </div>
          </ModulePage>}

          {activeModule === 'interventions' && <ModulePage language={language} title={tr('Interventions', 'हस्तक्षेप')} eyebrow={tr('WORKS & STRUCTURES', 'कार्य और संरचनाएँ')} description={tr('Review intervention records spatially linked to this watershed. Demo entries are synthetic; upload or agency integration is needed for operational data.', 'इस जलागम से स्थानिक रूप से जुड़े हस्तक्षेप अभिलेखों की समीक्षा करें। डेमो प्रविष्टियाँ काल्पनिक हैं; वास्तविक डेटा के लिए अपलोड या एजेंसी एकीकरण आवश्यक है।')}>
            <div className="module-two-column"><ModuleStat label={tr('Intervention records', 'हस्तक्षेप अभिलेख')} value={String(activeInterventions.features.length)} /><ModuleStat label={tr('Watershed', 'जलागम')} value={watershedName} /><ModuleStat label={tr('Data source', 'डेटा स्रोत')} value={workspace.live ? 'PostGIS' : tr('Illustrative sample', 'उदाहरणात्मक नमूना')} /></div>
            <section className="module-card table-card"><h2>{tr('Intervention register', 'हस्तक्षेप रजिस्टर')}</h2>{activeInterventions.features.length ? <div className="module-table-wrap"><table className="module-table"><thead><tr><th>{tr('Name', 'नाम')}</th><th>{tr('Type', 'प्रकार')}</th><th>{tr('Location', 'स्थान')}</th><th>{tr('Origin', 'स्रोत')}</th></tr></thead><tbody>{activeInterventions.features.map((feature) => { const coordinates = feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates) ? feature.geometry.coordinates as number[] : []; return <tr key={feature.id}><td>{String(feature.properties.name ?? tr('Unnamed intervention', 'बिना नाम का हस्तक्षेप'))}</td><td>{String(feature.properties.intervention_type ?? tr('Not classified', 'वर्गीकृत नहीं')).replaceAll('_', ' ')}</td><td>{coordinates.length >= 2 ? `${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}` : tr('Geometry recorded', 'ज्यामिति दर्ज')}</td><td><span className="origin-tag">{String(feature.properties.data_origin ?? 'unknown')}</span></td></tr>; })}</tbody></table></div> : <div className="module-empty"><Icon name="target" /><strong>{tr('No interventions recorded', 'कोई हस्तक्षेप दर्ज नहीं')}</strong><span>{tr('Intervention data can be loaded when agency records and their sources are available.', 'एजेंसी अभिलेख और उनके स्रोत उपलब्ध होने पर हस्तक्षेप डेटा लोड किया जा सकता है।')}</span></div>}</section>
          </ModulePage>}

          {activeModule === 'satellite' && <ModulePage language={language} title={tr('Satellite analysis', 'उपग्रह विश्लेषण')} eyebrow={tr('REMOTE SENSING', 'सुदूर संवेदन')} description={tr('Inspect the published ISRO/NRSC thematic layer and prepare a provenance-led workflow for future satellite scenes.', 'प्रकाशित ISRO/NRSC विषयगत परत देखें और भविष्य के उपग्रह दृश्यों के लिए स्रोत-आधारित कार्यप्रवाह तैयार करें।')}>
            <div className="analysis-status-card"><span className="analysis-status-icon"><Icon name="leaf" /></span><div><span className="status-pill-pending">BHUVAN WMS {tr('CONNECTED', 'जुड़ा है')}</span><h2>{tr('Regional LULC context is available', 'क्षेत्रीय LULC संदर्भ उपलब्ध है')}</h2><p>{tr('The live Bhuvan WMS displays ISRO/NRSC Land Use Land Cover for 2015–16 at 1:250,000 scale. This is a thematic map, not a current satellite scene; do not use it to verify small structures or claim current site conditions.', 'लाइव Bhuvan WMS 1:250,000 पैमाने पर 2015–16 का ISRO/NRSC भूमि उपयोग/आवरण दिखाता है। यह विषयगत मानचित्र है, वर्तमान उपग्रह दृश्य नहीं; छोटी संरचनाओं या वर्तमान स्थल स्थिति की पुष्टि के लिए इसका उपयोग न करें।')}</p><a className="module-source-link" href="https://bhuvan-app1.nrsc.gov.in/2dresources/bhuvanstore2.php" target="_blank" rel="noreferrer">{tr('Open official Bhuvan catalog', 'आधिकारिक Bhuvan कैटलॉग खोलें')} <span>↗</span></a></div></div>
            <div className="module-two-column"><ModuleStat label={tr('Connected source', 'जुड़ा स्रोत')} value="NRSC / ISRO Bhuvan" /><ModuleStat label={tr('Thematic product', 'विषयगत उत्पाद')} value="LULC · 2015–16" /><ModuleStat label={tr('Published scale', 'प्रकाशित पैमाना')} value="1:250,000" /></div>
            <div className="analysis-status-card analysis-pending-card"><span className="analysis-status-icon"><Icon name="clock" /></span><div><span className="status-pill-pending">{tr('SCENE ANALYSIS PENDING', 'दृश्य विश्लेषण लंबित')}</span><h2>{tr('SRISHTI-DRISHTI access is not configured', 'SRISHTI-DRISHTI पहुँच कॉन्फ़िगर नहीं है')}</h2><p>{tr('Site-specific scenes, acquisition dates, processing metadata, and integration permissions must be supplied before time-series indicators or thematic change results can be calculated.', 'समय-श्रृंखला संकेतक या विषयगत बदलाव की गणना से पहले स्थल-विशिष्ट दृश्य, अधिग्रहण तिथियाँ, प्रोसेसिंग मेटाडेटा और एकीकरण अनुमतियाँ देनी होंगी।')}</p></div></div>
            <section className="module-card"><h2>{tr('Analysis provenance required', 'विश्लेषण स्रोत विवरण आवश्यक')}</h2><ul className="validation-list"><li>{tr('Approved source and permitted data access route', 'स्वीकृत स्रोत और डेटा पहुँच का अनुमत तरीका')}</li><li>{tr('Acquisition date, spatial resolution, and cloud/quality masks', 'अधिग्रहण तिथि, स्थानिक रिज़ॉल्यूशन और बादल/गुणवत्ता मास्क')}</li><li>{tr('Processing method and software/model version', 'प्रोसेसिंग विधि और सॉफ़्टवेयर/मॉडल संस्करण')}</li><li>{tr('Field reference observations for interpretation checks', 'व्याख्या जाँच के लिए मैदानी संदर्भ अवलोकन')}</li><li>{tr('Limitations documented before agency decisions', 'एजेंसी निर्णयों से पहले सीमाएँ दर्ज करें')}</li></ul><p className="module-footnote">{tr('No satellite values or thematic classifications are fabricated in this workspace.', 'इस कार्यक्षेत्र में उपग्रह मान या विषयगत वर्गीकरण गढ़े नहीं गए हैं।')}</p></section>
          </ModulePage>}

          {activeModule === 'reports' && <ModulePage language={language} title={tr('Reports & validation', 'रिपोर्ट और सत्यापन')} eyebrow={tr('EXPORTS & PILOT CHECKS', 'निर्यात और पायलट जाँच')} description={tr('Export the current observation register and track the evidence required to validate the pilot area.', 'वर्तमान अवलोकन रजिस्टर निर्यात करें और पायलट क्षेत्र के सत्यापन के लिए आवश्यक साक्ष्य ट्रैक करें।')}>
            <section className="report-export-card"><div><span className="eyebrow">{tr('OBSERVATION REGISTER', 'अवलोकन रजिस्टर')}</span><h2>{tr('Download a CSV summary', 'CSV सारांश डाउनलोड करें')}</h2><p>{tr('Includes category, status, coordinates, data origin, and observation note for the current watershed.', 'इसमें वर्तमान जलागम की श्रेणी, स्थिति, निर्देशांक, डेटा स्रोत और अवलोकन टिप्पणी शामिल है।')}</p></div><button className="button button-primary" onClick={exportSummary}><Icon name="download" /> {tr('Export CSV', 'CSV निर्यात करें')}</button></section>
            <section className="module-card"><h2>{tr('Pilot validation checklist', 'पायलट सत्यापन जाँचसूची')}</h2><ul className="validation-list"><li><span className="check-empty" /> {tr('Agree representative watershed with the concerned agency', 'संबंधित एजेंसी के साथ प्रतिनिधि जलागम तय करें')}</li><li><span className="check-empty" /> {tr('Verify boundary authority, source, date, and CRS', 'सीमा प्राधिकरण, स्रोत, तिथि और CRS सत्यापित करें')}</li><li><span className="check-empty" /> {tr('Confirm permissions and availability of geocoded field images', 'भू-टैग वाली मैदानी छवियों की अनुमति और उपलब्धता की पुष्टि करें')}</li><li><span className="check-empty" /> {tr('Confirm SRISHTI-DRISHTI scene coverage and processing metadata', 'SRISHTI-DRISHTI दृश्य कवरेज और प्रोसेसिंग मेटाडेटा की पुष्टि करें')}</li><li><span className="check-empty" /> {tr('Link intervention records to dates and locations', 'हस्तक्षेप अभिलेखों को तिथि और स्थान से जोड़ें')}</li><li><span className="check-empty" /> {tr('Record field validation and interpretation limitations', 'मैदानी सत्यापन और व्याख्या सीमाएँ दर्ज करें')}</li></ul><div className="record-warning"><Icon name="alert" /> {tr('Pilot site is', 'पायलट स्थल')} {pilotConfirmed ? tr('marked confirmed in the dataset; source validation is still required.', 'डेटासेट में पुष्ट है; स्रोत सत्यापन अभी भी आवश्यक है।') : tr('pending joint selection. Current demo geography is synthetic.', 'संयुक्त चयन लंबित है। वर्तमान डेमो भूगोल काल्पनिक है।')}</div></section>
          </ModulePage>}
        </main>
      </div>
      {uploadOpen && canUpload && <UploadDialog language={language} onClose={() => setUploadOpen(false)} onSubmit={handleUpload} loading={uploading} />}
      {boundaryOpen && canImportBoundary && <BoundaryImportDialog language={language} onClose={() => setBoundaryOpen(false)} onSubmit={handleBoundaryImport} loading={importingBoundary} />}
      {toast && <div className="toast"><span className="toast-icon"><Icon name="check" /></span>{toast}</div>}
    </div>
  );
}

function ModuleNav({ active, onSelect, className, language }: { active: ModuleId; onSelect: (module: ModuleId) => void; className: string; language: Language }) {
  const hi = language === 'hi';
  return <nav className={`module-nav ${className}`} aria-label={hi ? 'कार्यक्षेत्र मॉड्यूल' : 'Workspace modules'}><span className="side-section-label">{hi ? 'मॉड्यूल' : 'MODULES'}</span>{modules.map((module) => <button key={module.id} className={`module-nav-item ${active === module.id ? 'is-active' : ''}`} onClick={() => onSelect(module.id)} aria-current={active === module.id ? 'page' : undefined}><Icon name={module.icon} /><span>{hi ? module.hi : module.label}</span></button>)}</nav>;
}

function ModulePage({ title, eyebrow, description, children, language }: { title: string; eyebrow: string; description: string; children: ReactNode; language: Language }) {
  const hi = language === 'hi';
  return <><div className="page-intro module-page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><div className="updated-label"><span className="updated-dot" /> {hi ? 'स्थानीय कार्यक्षेत्र' : 'Local workspace'}</div></div><div className="module-page-content">{children}</div><footer className="main-footer"><span>{hi ? 'साक्ष्य समीक्षा मैदानी निर्णयों में सहायक है; यह मैदानी सत्यापन का विकल्प नहीं है।' : 'Evidence review supports field decisions; it does not replace field validation.'}</span><span>{hi ? 'स्थानीय पायलट' : 'Local pilot'} · v0.1</span></footer></>;
}

function ModuleStat({ label, value }: { label: string; value: string }) {
  return <article className="module-stat"><span>{label}</span><strong>{value}</strong></article>;
}

function ReviewHistory({ observationId, language, refreshVersion }: { observationId: string; language: Language; refreshVersion: number }) {
  const [events, setEvents] = useState<ReviewEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const hi = language === 'hi';
  useEffect(() => {
    let active = true;
    setEvents(null);
    setFailed(false);
    void loadReviewHistory(observationId).then((history) => {
      if (active) setEvents(history);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [observationId, refreshVersion]);

  function displayStatus(status: string | null) {
    if (!status) return hi ? 'पहली समीक्षा' : 'Initial review';
    if (!hi) return statusLabel[status as ReviewStatus] ?? status.replaceAll('_', ' ');
    return ({ pending: 'समीक्षा लंबित', in_review: 'समीक्षा जारी', approved: 'समीक्षित', needs_changes: 'अनुवर्ती कार्रवाई आवश्यक' } as Record<ReviewStatus, string>)[status as ReviewStatus] ?? status.replaceAll('_', ' ');
  }

  return <section className="review-history" aria-label={hi ? 'समीक्षा इतिहास' : 'Review history'}>
    <h3>{hi ? 'समीक्षा इतिहास' : 'Review history'}</h3>
    {failed ? <p>{hi ? 'समीक्षा इतिहास लोड नहीं हो सका।' : 'Review history could not be loaded.'}</p> : events === null ? <p>{hi ? 'इतिहास लोड हो रहा है…' : 'Loading history…'}</p> : events.length === 0 ? <p>{hi ? 'अभी कोई समीक्षा निर्णय दर्ज नहीं है।' : 'No review decisions have been recorded yet.'}</p> : <ol>{events.map((event) => <li key={event.id}>
      <div className="review-history-heading"><strong>{displayStatus(event.new_status)}</strong><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(hi ? 'hi-IN' : 'en-IN')}</time></div>
      <span>{event.actor}</span>
      {event.previous_status && <span>{hi ? 'पहले:' : 'Previous:'} {displayStatus(event.previous_status)}</span>}
      {event.comment && <p>{event.comment}</p>}
    </li>)}</ol>}
  </section>;
}

function Metric({ icon, label, value, note, tone }: { icon: 'map' | 'target' | 'photo' | 'clock'; label: string; value: number; note: string; tone: string }) {
  return <article className="metric-card"><span className={`metric-icon tone-${tone}`}><Icon name={icon} /></span><div className="metric-copy"><span>{label}</span><strong>{value.toLocaleString()}</strong><small>{note}</small></div></article>;
}

function ObservationItem({ observation, selected, onSelect, language }: { observation: Observation; selected: boolean; onSelect: () => void; language: Language }) {
  const hi = language === 'hi';
  return <button className={`observation-item ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
    <span className={`observation-thumb ${observation.has_image ? 'has-image' : ''}`}>
      {observation.has_image && observation.image_url ? <img src={imageUrl(observation.image_url)} alt="" /> : <Icon name={observation.category.toLowerCase().includes('vegetation') ? 'leaf' : 'photo'} />}
    </span>
    <span className="observation-copy"><strong>{observation.category}</strong><span>{observation.intervention_name ?? (hi ? 'असंबद्ध अवलोकन' : 'Unlinked observation')}</span><small>{observationDateLabel(observation, language, true)}</small></span>
    <i className={`status-indicator status-${observation.review_status}`} title={hi ? ({ pending: 'समीक्षा लंबित', in_review: 'समीक्षा जारी', approved: 'समीक्षित', needs_changes: 'अनुवर्ती कार्रवाई आवश्यक' } as Record<ReviewStatus, string>)[observation.review_status] : statusLabel[observation.review_status]} />
  </button>;
}

function UploadDialog({ onClose, onSubmit, loading, language }: { onClose: () => void; onSubmit: (file: File, category: string, description: string, latitude?: string, longitude?: string) => Promise<void>; loading: boolean; language: Language }) {
  const hi = language === 'hi';
  const tx = (en: string, hindi: string) => hi ? hindi : en;
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('Water conservation');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [dragging, setDragging] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (file) void onSubmit(file, category, description, latitude || undefined, longitude || undefined);
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="upload-dialog" onSubmit={submit}>
      <div className="dialog-heading"><div><span className="eyebrow">{tx('FIELD EVIDENCE', 'मैदानी साक्ष्य')}</span><h2>{tx('Add an observation', 'अवलोकन जोड़ें')}</h2><p>{tx('Upload a JPEG or PNG. Coordinates are read from image metadata when available.', 'JPEG या PNG अपलोड करें। उपलब्ध होने पर निर्देशांक छवि मेटाडेटा से पढ़े जाएँगे।')}</p></div><button type="button" className="text-icon-button" onClick={onClose} aria-label={tx('Close dialog', 'संवाद बंद करें')}><Icon name="close" /></button></div>
      <label className={`drop-zone ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const dropped = event.dataTransfer.files[0]; if (dropped) setFile(dropped); }}>
        <input type="file" accept="image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <span className="drop-icon"><Icon name={file ? 'check' : 'upload'} /></span>
        <strong>{file?.name ?? tx('Choose an image or drop it here', 'छवि चुनें या यहाँ छोड़ें')}</strong>
        <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ${file.type || tx('Image file', 'छवि फ़ाइल')}` : tx('JPEG or PNG · up to 20 MB', 'JPEG या PNG · अधिकतम 20 MB')}</span>
      </label>
      <div className="form-grid">
        <label className="form-field"><span>{tx('Observation category', 'अवलोकन श्रेणी')}</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="Water conservation">{tx('Water conservation', 'जल संरक्षण')}</option><option value="Vegetation">{tx('Vegetation', 'वनस्पति')}</option><option value="Land condition">{tx('Land condition', 'भूमि की स्थिति')}</option><option value="Drainage">{tx('Drainage', 'जल निकासी')}</option><option value="Other">{tx('Other', 'अन्य')}</option></select></label>
        <div className="coordinate-fields">
          <label className="form-field"><span>{tx('Latitude', 'अक्षांश')} <em>{tx('Optional', 'वैकल्पिक')}</em></span><input type="number" step="any" min="-90" max="90" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder={tx('From image or enter', 'छवि से लें या दर्ज करें')} /></label>
          <label className="form-field"><span>{tx('Longitude', 'देशांतर')} <em>{tx('Optional', 'वैकल्पिक')}</em></span><input type="number" step="any" min="-180" max="180" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder={tx('From image or enter', 'छवि से लें या दर्ज करें')} /></label>
        </div>
        <label className="form-field"><span>{tx('Field note', 'मैदानी टिप्पणी')} <em>{tx('Optional', 'वैकल्पिक')}</em></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} placeholder={tx('Describe what the image records', 'छवि में क्या दर्ज है, बताएँ')} /></label>
      </div>
      <div className="dialog-note"><Icon name="alert" /><span>{tx('Location and capture time may be missing. Uploaded records stay in local development storage and need review.', 'स्थान और कैप्चर समय उपलब्ध न भी हों। अपलोड किए अभिलेख स्थानीय विकास स्टोरेज में रहते हैं और समीक्षा आवश्यक है।')}</span></div>
      <div className="dialog-actions"><button type="button" className="button button-outline" onClick={onClose}>{tx('Cancel', 'रद्द करें')}</button><button type="submit" className="button button-primary" disabled={!file || loading}>{loading ? tx('Uploading…', 'अपलोड हो रहा है…') : <><Icon name="upload" /> {tx('Upload evidence', 'साक्ष्य अपलोड करें')}</>}</button></div>
    </form>
  </div>;
}

function BoundaryImportDialog({ onClose, onSubmit, loading, language }: { onClose: () => void; onSubmit: (file: File, name: string, adminArea: string, source: string) => Promise<void>; loading: boolean; language: Language }) {
  const hi = language === 'hi';
  const tx = (en: string, hindi: string) => hi ? hindi : en;
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [adminArea, setAdminArea] = useState('');
  const [source, setSource] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (file) void onSubmit(file, name, adminArea, source);
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="upload-dialog" onSubmit={submit}>
      <div className="dialog-heading"><div><span className="eyebrow">{tx('PILOT AREA SETUP', 'पायलट क्षेत्र सेटअप')}</span><h2>{tx('Import a candidate boundary', 'संभावित सीमा आयात करें')}</h2><p>{tx('Add one watershed boundary from a GeoJSON file. Importing does not designate it as the pilot site.', 'GeoJSON फ़ाइल से एक जलागम सीमा जोड़ें। आयात करने से वह पायलट स्थल घोषित नहीं होती।')}</p></div><button type="button" className="text-icon-button" onClick={onClose} aria-label={tx('Close dialog', 'संवाद बंद करें')}><Icon name="close" /></button></div>
      <label className={`drop-zone ${file ? 'has-file' : ''}`}>
        <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
        <span className="drop-icon"><Icon name={file ? 'check' : 'upload'} /></span>
        <strong>{file?.name ?? tx('Choose a GeoJSON boundary file', 'GeoJSON सीमा फ़ाइल चुनें')}</strong>
        <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : tx('GeoJSON Polygon or MultiPolygon · up to 10 MB', 'GeoJSON Polygon या MultiPolygon · अधिकतम 10 MB')}</span>
      </label>
      <div className="form-grid">
        <label className="form-field"><span>{tx('Watershed name', 'जलागम का नाम')}</span><input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={160} required placeholder={tx('Name from the source record', 'स्रोत अभिलेख के अनुसार नाम')} /></label>
        <label className="form-field"><span>{tx('District / state', 'ज़िला / राज्य')} <em>{tx('Optional', 'वैकल्पिक')}</em></span><input value={adminArea} onChange={(event) => setAdminArea(event.target.value)} maxLength={240} placeholder={tx('Administrative area', 'प्रशासनिक क्षेत्र')} /></label>
        <label className="form-field"><span>{tx('Boundary source', 'सीमा का स्रोत')}</span><input value={source} onChange={(event) => setSource(event.target.value)} minLength={2} maxLength={240} required placeholder={tx('Agency, dataset, date, or file reference', 'एजेंसी, डेटासेट, तिथि या फ़ाइल संदर्भ')} /></label>
      </div>
      <div className="dialog-note"><Icon name="alert" /><span>{tx('Use WGS 84 longitude/latitude (EPSG:4326). The imported boundary is stored as an unverified external candidate; it will not be labeled official or pilot-confirmed.', 'WGS 84 देशांतर/अक्षांश (EPSG:4326) का उपयोग करें। आयात की गई सीमा अप्रमाणित बाहरी उम्मीदवार के रूप में सहेजी जाएगी; इसे आधिकारिक या पुष्ट पायलट नहीं कहा जाएगा।')}</span></div>
      <div className="dialog-actions"><button type="button" className="button button-outline" onClick={onClose}>{tx('Cancel', 'रद्द करें')}</button><button type="submit" className="button button-primary" disabled={!file || !name.trim() || !source.trim() || loading}>{loading ? tx('Importing…', 'आयात हो रहा है…') : <><Icon name="upload" /> {tx('Import boundary', 'सीमा आयात करें')}</>}</button></div>
    </form>
  </div>;
}

export default App;
