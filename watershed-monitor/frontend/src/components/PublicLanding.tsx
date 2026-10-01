import { Icon } from './Icon';
import { LanguageSwitch } from './LanguageSwitch';
import type { Language } from './LanguageSwitch';
import './public.css';

interface Props {
  onLogin: () => void;
  onRegister: () => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
}

const configuredEmail = import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? '';
const contactEmail = configuredEmail || 'contact@example.org';
const hasProjectEmail = Boolean(configuredEmail) && !/example\.org$/i.test(configuredEmail);
const projectOrganization = import.meta.env.VITE_PROJECT_ORGANIZATION?.trim() ?? '';
const projectAddress = import.meta.env.VITE_PROJECT_ADDRESS?.trim() ?? '';
const projectPhone = import.meta.env.VITE_PROJECT_PHONE?.trim() ?? '';

export function PublicLanding({ onLogin, onRegister, language, onLanguageChange }: Props) {
  const hi = language === 'hi';
  return <div className="public-site" lang={language}>
    <header className="public-nav-wrap">
      <a className="public-brand" href="#home" aria-label="Watershed Atlas home"><span className="public-brand-mark"><Icon name="water" /></span><span><strong>Watershed Atlas</strong><small>GEOSPATIAL FIELD INTELLIGENCE</small></span></a>
      <nav className="public-nav-links" aria-label={hi ? 'मुख्य नेविगेशन' : 'Main navigation'}><a href="#services">{hi ? 'सेवाएँ' : 'Services'}</a><a href="#about">{hi ? 'परिचय' : 'About'}</a><a href="#contact">{hi ? 'संपर्क' : 'Contact us'}</a></nav>
      <div className="public-nav-actions"><LanguageSwitch language={language} onChange={onLanguageChange} /><button className="public-login-link" onClick={onLogin}>{hi ? 'लॉग इन' : 'Login'}</button><button className="public-register-button" onClick={onRegister}>{hi ? 'खाता बनाएँ' : 'Create account'} <span>→</span></button></div>
    </header>

    <main>
      <section className="public-hero" id="home">
        <div className="public-hero-grid" />
        <div className="public-hero-copy">
          <span className="public-kicker"><i /> {hi ? 'जलागम निगरानी और मैदानी साक्ष्य' : 'WATERSHED MONITORING & FIELD EVIDENCE'}</span>
          <h1>{hi ? <>जलागम के निर्णय लें <span className="public-inline-relief" aria-hidden="true"><svg viewBox="0 0 48 32"><path d="M4 20c7-9 12-10 18-4s10 8 22-4"/><path d="M6 24c7-8 11-8 17-3s12 6 20-2"/><path d="M15 9c5-4 10-3 13 1"/></svg></span> <em>पूरी तस्वीर</em> देखकर।</> : <>Make watershed decisions with the <span className="public-inline-relief" aria-hidden="true"><svg viewBox="0 0 48 32"><path d="M4 20c7-9 12-10 18-4s10 8 22-4"/><path d="M6 24c7-8 11-8 17-3s12 6 20-2"/><path d="M15 9c5-4 10-3 13 1"/></svg></span> <em>whole picture.</em></>}</h1>
          <p>{hi ? 'जलागम सीमाएँ, मैदानी अवलोकन, हस्तक्षेप अभिलेख और विश्वसनीय पृथ्वी-अवलोकन जानकारी को एक समीक्षा योग्य कार्यक्षेत्र में देखें।' : 'Bring watershed boundaries, field observations, intervention records and trusted earth-observation context into one reviewable workspace.'}</p>
          <div className="public-hero-actions"><button className="public-cta" onClick={onRegister}>{hi ? 'शुरू करें' : 'Get started'} <span>→</span></button></div>
          <div className="public-trust-row"><span><Icon name="map" /> {hi ? 'स्थानिक साक्ष्य' : 'Spatial evidence'}</span><span><Icon name="layers" /> {hi ? 'स्रोत की पहचान' : 'Source traceability'}</span><span><Icon name="check" /> {hi ? 'मैदानी सत्यापन' : 'Field validation'}</span></div>
        </div>
        <div className="public-hero-art" aria-label="Decorative three-dimensional watershed illustration">
          <div className="public-art-glow" />
          <div className="public-art-orbit public-art-orbit-one" /><div className="public-art-orbit public-art-orbit-two" />
          <div className="public-terrain-stack"><div className="public-terrain-layer public-terrain-bottom" /><div className="public-terrain-layer public-terrain-middle" /><div className="public-terrain-layer public-terrain-top">
            <svg viewBox="0 0 600 400" role="presentation" aria-hidden="true">
              <path d="M42 236c46-25 63-99 121-96 44 2 51 57 94 49 39-7 60-84 109-72 42 10 41 66 88 70 39 3 64-20 97-11" />
              <path d="M82 268c32-22 48-70 86-71 33-1 41 40 76 35 39-5 52-63 91-55 36 7 36 49 77 53 35 4 51-13 82-8" />
              <path d="M127 300c24-15 34-44 61-46 26-2 33 24 60 21 30-4 43-41 72-36 31 4 32 34 65 37 24 3 40-4 61-2" />
              <path className="public-river-line" d="M107 159c36 27 42 58 82 72 34 12 67 7 90 32 22 23 28 63 73 71 42 8 75-19 120-11" />
              <path className="public-road-line" d="M108 318c39-25 82-45 125-41 34 3 60 26 102 16 50-12 76-60 122-56" />
              <circle cx="311" cy="259" r="9" className="public-map-point" />
            </svg>
          </div></div>
          <div className="public-terrain-pin"><span><Icon name="target" /></span><i /></div>
          <div className="public-art-badge public-badge-source"><span className="source-live-dot" /><span><strong>ISRO · BHUVAN</strong><small>{hi ? 'भूमि उपयोग/आवरण परत' : 'LULC thematic layer'}</small></span></div>
          <div className="public-art-badge public-badge-date"><strong>2015—16</strong><small>{hi ? 'आधार वर्ष · 1:250K' : 'BASELINE · 1:250K'}</small></div>
          <div className="public-art-caption">{hi ? 'उदाहरणात्मक भूभाग · चयनित पायलट स्थल नहीं' : 'ILLUSTRATIVE TERRAIN · NOT A SELECTED PILOT SITE'}</div>
        </div>
          <div className="public-hero-bottom"><span>{hi ? 'खुला भू-स्थानिक संदर्भ' : 'OPEN GEOSPATIAL CONTEXT'}</span><span>{hi ? 'मैदानी डेटा लॉग इन के बाद' : 'FIELD DATA STAYS BEHIND SIGN-IN'}</span></div>
      </section>

      <section className="public-services" id="services">
        <div className="public-section-heading"><span className="public-section-kicker">{hi ? 'आप क्या कर सकते हैं' : 'WHAT YOU CAN DO'}</span><h2>{hi ? 'एक कार्यक्षेत्र, जुड़े हुए मॉड्यूल।' : 'One workspace, connected modules.'}</h2><p>{hi ? 'परियोजना की सार्वजनिक जानकारी देखें। जलागम अभिलेखों और समीक्षा उपकरणों के लिए लॉग इन करें।' : 'Start with public project information. Sign in to work with your watershed records and review tools.'}</p></div>
        <div className="public-service-grid">
          <article className="public-service-card"><span className="public-service-icon icon-map"><Icon name="layers" /></span><span className="public-service-index">01 / {hi ? 'स्थानिक' : 'SPATIAL'}</span><h3>{hi ? 'जलागम का मानचित्र देखें' : 'See the watershed'}</h3><p>{hi ? 'इंटरैक्टिव मानचित्र पर सीमाएँ, हस्तक्षेप स्थान और मैदानी अभिलेख देखें।' : 'Explore boundaries, intervention locations and field records on an interactive map.'}</p></article>
          <article className="public-service-card"><span className="public-service-icon icon-evidence"><Icon name="photo" /></span><span className="public-service-index">02 / {hi ? 'साक्ष्य' : 'EVIDENCE'}</span><h3>{hi ? 'मैदानी साक्ष्य की समीक्षा करें' : 'Keep field evidence reviewable'}</h3><p>{hi ? 'फोटो टिप्पणियाँ, निर्देशांक, कैप्चर तिथि और समीक्षा स्थिति सही स्थान से जोड़ें।' : 'Link image notes, coordinates, capture dates and review status to the right place.'}</p></article>
          <article className="public-service-card"><span className="public-service-icon icon-earth"><Icon name="leaf" /></span><span className="public-service-index">03 / {hi ? 'पृथ्वी अवलोकन' : 'EARTH OBSERVATION'}</span><h3>{hi ? 'उपग्रह संदर्भ जोड़ें' : 'Add satellite context'}</h3><p>{hi ? 'प्रकाशित वर्ष और मानचित्र पैमाने के साथ Bhuvan NRSC/ISRO भूमि-आवरण परत देखें।' : 'View a Bhuvan NRSC/ISRO land-cover layer with its published year and map scale.'}</p></article>
          <article className="public-service-card"><span className="public-service-icon icon-report"><Icon name="download" /></span><span className="public-service-index">04 / {hi ? 'सत्यापन' : 'VALIDATION'}</span><h3>{hi ? 'निर्णय के आधार दर्ज करें' : 'Document what supports a decision'}</h3><p>{hi ? 'मैदानी रजिस्टर निर्यात करें और स्रोत, गुणवत्ता तथा बाकी जाँचों को ट्रैक करें।' : 'Export a field register and track the source, quality and field checks still needed.'}</p></article>
        </div>
        <div className="public-data-note"><span className="public-data-note-icon"><Icon name="alert" /></span><p><strong>{hi ? 'डेटा की सीमाएँ स्पष्ट हैं।' : 'Data with clear limits.'}</strong> {hi ? 'वर्तमान Bhuvan परत 1:250,000 पैमाने पर 2015–16 का LULC विषयगत उत्पाद है। यह क्षेत्रीय संदर्भ के लिए उपयोगी है, छोटी संरचनाओं की पुष्टि या वर्तमान स्थल स्थिति बताने के लिए नहीं।' : 'The current Bhuvan layer is a 2015–16 LULC thematic product at 1:250,000 scale. It is useful for regional context, not for confirming small structures or representing current site conditions.'}</p><a href="https://bhuvan-app1.nrsc.gov.in/2dresources/bhuvanstore2.php" target="_blank" rel="noreferrer">{hi ? 'Bhuvan कैटलॉग देखें' : 'View Bhuvan catalog'} <span>↗</span></a></div>
      </section>

      <section className="public-about" id="about">
        <div className="public-about-art"><span className="about-ring ring-large" /><span className="about-ring ring-small" /><div className="about-compass"><Icon name="target" /></div><span className="about-coordinate">{hi ? 'स्थल चयन' : 'SITE SELECTION'}<br /><strong>{hi ? 'मिलकर तय होगा' : 'TO BE AGREED'}</strong></span></div>
        <div className="public-about-copy"><span className="public-section-kicker">{hi ? 'परियोजना परिचय' : 'ABOUT THIS PROJECT'}</span><h2>{hi ? 'वास्तविक जलागम पर आधारित, अनुमानित पायलट पर नहीं।' : 'Built around the real watershed, not a guessed pilot.'}</h2><p>{hi ? 'इंदौर जिला पायलट खोज क्षेत्र है। सटीक प्रतिनिधि जलागम, ब्लॉक/तहसील और आधिकारिक सीमा संबंधित एजेंसी के साथ डेटा उपलब्धता तथा सत्यापन जाँच के बाद तय होंगे।' : 'Indore district is the pilot search area. The exact representative watershed, block or tehsil, and official boundary will be agreed with the concerned agency after checking data availability and validation requirements.'}</p><p>{hi ? 'सार्वजनिक साइट पर उत्पाद की मूल जानकारी है। जलागम अभिलेखों और समीक्षा मॉड्यूल के लिए लॉग इन आवश्यक है। जब तक आधिकारिक पायलट डेटा नहीं जुड़ता, नमूना मानचित्र सुविधाएँ स्पष्ट रूप से उदाहरणात्मक चिह्नित हैं।' : 'The public site provides basic product information. Sign-in is required for watershed records and review modules. Sample map features remain clearly labelled illustrative until official pilot data is supplied.'}</p><button className="public-text-button" onClick={onRegister}>{hi ? 'कार्यक्षेत्र खाता बनाएँ' : 'Create a workspace account'} <span>→</span></button></div>
      </section>

      <section className="public-contact" id="contact">
        <div className="public-contact-copy">
          <span className="public-section-kicker">{hi ? 'संपर्क' : 'CONTACT'}</span>
          <h2>{hi ? 'पायलट डेटा या कोई सवाल है?' : 'Have pilot data or a question?'}</h2>
          <p>{hi ? 'परियोजना टीम से संपर्क करने के लिए आधिकारिक ईमेल और कार्यालय का विवरण यहाँ जोड़ें।' : 'Add the official project mailbox and office details here so agencies and field teams know whom to contact.'}</p>
        </div>
        <div className="public-contact-details">
          <div className={`contact-detail-card ${hasProjectEmail ? '' : 'is-placeholder'}`}>
            <span className="contact-detail-label">{hi ? 'परियोजना ईमेल' : 'PROJECT EMAIL'}</span>
            {hasProjectEmail
              ? <a className="contact-detail-value" href={`mailto:${contactEmail}`}>{contactEmail}</a>
              : <strong className="contact-detail-value">{contactEmail}</strong>}
            <span className="contact-detail-hint">{hasProjectEmail
              ? (hi ? 'इस परियोजना के लिए निगरानी वाला आधिकारिक ईमेल।' : 'Official mailbox monitored by the project team.')
              : (hi ? 'इसे विभाग/परियोजना के आधिकारिक और नियमित रूप से देखे जाने वाले ईमेल से बदलें।' : 'Replace this sample with an official mailbox the project team checks regularly.')}</span>
          </div>
          <div className={`contact-detail-card ${projectOrganization ? '' : 'is-placeholder'}`}>
            <span className="contact-detail-label">{hi ? 'विभाग / संगठन' : 'DEPARTMENT / ORGANIZATION'}</span>
            <strong className="contact-detail-value">{projectOrganization || (hi ? 'आधिकारिक नाम जोड़ें' : 'Add the official name')}</strong>
            <span className="contact-detail-hint">{hi ? 'संबंधित विभाग, एजेंसी या परियोजना लागू करने वाले संगठन का नाम लिखें।' : 'Enter the department, agency, or organization responsible for the project.'}</span>
          </div>
          <div className={`contact-detail-card ${projectAddress ? '' : 'is-placeholder'}`}>
            <span className="contact-detail-label">{hi ? 'कार्यालय का पता' : 'OFFICE ADDRESS'}</span>
            <strong className="contact-detail-value">{projectAddress || (hi ? 'पता अभी नहीं दिया गया' : 'Address not supplied yet')}</strong>
            <span className="contact-detail-hint">{hi ? 'कार्यालय/भवन, सड़क या क्षेत्र, जिला, राज्य और PIN code जोड़ें।' : 'Add office/building, street or locality, district, state, and PIN code.'}</span>
          </div>
          <div className={`contact-detail-card ${projectPhone ? '' : 'is-placeholder'}`}>
            <span className="contact-detail-label">{hi ? 'फोन / हेल्पलाइन' : 'PHONE / HELPLINE'}</span>
            {projectPhone
              ? <a className="contact-detail-value" href={'tel:' + projectPhone.replace(/[^\d+]/g, '')}>{projectPhone}</a>
              : <strong className="contact-detail-value">{hi ? 'वैकल्पिक · आधिकारिक नंबर जोड़ें' : 'Optional · add an official number'}</strong>}
            <span className="contact-detail-hint">{hi ? 'केवल परियोजना के आधिकारिक संपर्क या सार्वजनिक हेल्पलाइन का उपयोग करें।' : 'Use only an official project contact or public helpline.'}</span>
          </div>
          <p className="project-content-note">
            <strong>{hi ? 'लॉन्च से पहले भरें:' : 'Complete before launch:'}</strong>{' '}
            {hi
              ? 'विभाग/संगठन का नाम, आधिकारिक ईमेल, डाक-पता, वैकल्पिक फोन नंबर, और एजेंसी से पुष्टि होने के बाद जलागम का सही नाम व सीमा-स्रोत।'
              : 'Department or organization name, official email, postal address, optional phone number, and the exact watershed name and boundary source after agency confirmation.'}
          </p>
        </div>
      </section>
    </main>

    <footer className="public-footer" id="footer">
      <div className="public-footer-main">
        <a className="public-brand footer-brand" href="#home"><span className="public-brand-mark"><Icon name="water" /></span><span><strong>Watershed Atlas</strong><small>GEOSPATIAL FIELD INTELLIGENCE</small></span></a>
        <p>{hi ? 'सावधानीपूर्वक, मैदानी सत्यापन वाले जलागम कार्य के लिए स्थानिक साक्ष्य और पृथ्वी-अवलोकन संदर्भ।' : 'Spatial evidence and earth-observation context for careful, field-validated watershed work.'}</p>
        <nav className="public-footer-links" aria-label={hi ? 'फुटर नेविगेशन' : 'Footer navigation'}><a href="#services">{hi ? 'सेवाएँ' : 'Services'}</a><a href="#about">{hi ? 'परिचय' : 'About'}</a><a href="#contact">{hi ? 'संपर्क' : 'Contact us'}</a><button onClick={onLogin}>{hi ? 'लॉग इन' : 'Login'}</button></nav>
        <div className="public-footer-details">
          {hasProjectEmail
            ? <a className="public-footer-email" href={`mailto:${contactEmail}`}>{contactEmail}</a>
            : <span className="public-footer-email is-placeholder">{contactEmail} · {hi ? 'आधिकारिक ईमेल से बदलें' : 'replace with official email'}</span>}
          <span>{projectOrganization || (hi ? 'विभाग / संगठन का नाम जोड़ें' : 'Add department or organization name')}</span>
          <span>{projectAddress || (hi ? 'कार्यालय का पता जोड़ें' : 'Add public office address')}</span>
          {projectPhone
            ? <a className="public-footer-email" href={'tel:' + projectPhone.replace(/[^\d+]/g, '')}>{projectPhone}</a>
            : <span>{hi ? 'फोन वैकल्पिक है' : 'Phone number is optional'}</span>}
        </div>
      </div>
      <div className="public-footer-bottom"><span>© {new Date().getFullYear()} Watershed Atlas · {hi ? 'विकास संस्करण' : 'Development build'}</span><span>{hi ? 'ISRO/Bhuvan स्रोत परत NRSC की शर्तों और सेवा उपलब्धता के अधीन है।' : 'ISRO/Bhuvan source layer remains subject to NRSC terms and service availability.'}</span></div>
    </footer>
  </div>;
}
