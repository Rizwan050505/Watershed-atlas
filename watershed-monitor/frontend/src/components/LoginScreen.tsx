import { useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from './Icon';
import { ApiError } from '../api';
import { LanguageSwitch } from './LanguageSwitch';
import type { Language } from './LanguageSwitch';
import './login.css';

interface Props {
  page: 'login' | 'register';
  onSignIn: (email: string, password: string) => Promise<void>;
  onRegister: (displayName: string, email: string, password: string) => Promise<void>;
  onPageChange: (page: 'login' | 'register' | 'public') => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
}

export function LoginScreen({ page, onSignIn, onRegister, onPageChange, language, onLanguageChange }: Props) {
  const registering = page === 'register';
  const hi = language === 'hi';
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (registering) {
        if (password !== confirmPassword) throw new Error(hi ? 'पासवर्ड मेल नहीं खाते।' : 'The passwords do not match.');
        await onRegister(displayName, email, password);
      } else {
        await onSignIn(email, password);
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 0) {
        setError(hi
          ? 'सर्वर से संपर्क नहीं हो रहा। Docker Desktop खोलकर PostGIS और API सेवाएँ शुरू करें, फिर दोबारा प्रयास करें।'
          : cause.message);
      } else {
        setError(cause instanceof Error ? cause.message : (hi ? 'लॉग इन नहीं हुआ। API और खाते की जानकारी जाँचें।' : 'Sign-in failed. Check the local API and account details.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-shell" lang={language}>
    <section className="login-story">
      <div className="login-brand"><span className="login-brand-mark"><Icon name="water" /></span><span><strong>Watershed Atlas</strong><small>GEOSPATIAL FIELD INTELLIGENCE</small></span></div>
      <div className="login-copy">
        <span className="login-kicker"><i /> {hi ? 'जलागम निगरानी कार्यक्षेत्र' : 'WATERSHED MONITORING WORKSPACE'}</span>
        <h1>{hi ? 'हर जलागम को एक जीवंत, परतदार प्रणाली की तरह देखें।' : 'See every watershed as a living, layered system.'}</h1>
        <p>{hi ? 'सावधानीपूर्वक समीक्षा के लिए मैदानी साक्ष्य, हस्तक्षेप अभिलेख और उपग्रह संदर्भ को एक जगह लाएँ।' : 'Bring field evidence, intervention records and satellite context into one place for careful, reviewable watershed assessment.'}</p>
        <div className="login-capabilities"><span><i /> {hi ? 'स्थानिक साक्ष्य' : 'Spatial evidence'}</span><span><i /> {hi ? 'स्रोत की पहचान' : 'Source traceability'}</span><span><i /> {hi ? 'मैदानी सत्यापन' : 'Field validation'}</span></div>
      </div>
      <div className="terrain-stage" aria-label="Decorative three-dimensional watershed terrain illustration">
        <div className="terrain-glow" />
        <div className="terrain-orbit orbit-a" /><div className="terrain-orbit orbit-b" />
        <div className="terrain-stack">
          <div className="terrain-slab terrain-slab-base" />
          <div className="terrain-slab terrain-slab-low" />
          <div className="terrain-slab terrain-slab-mid" />
          <div className="terrain-slab terrain-slab-high" />
          <div className="terrain-slab terrain-slab-top">
            <svg viewBox="0 0 520 340" role="presentation" aria-hidden="true">
              <path d="M38 197c41-36 57-85 107-83 37 2 48 49 83 44 36-5 52-67 96-60 43 7 43 59 91 61 30 1 47-18 69-12" />
              <path d="M72 221c31-28 43-62 79-62 28 0 39 34 68 32 35-2 50-52 83-47 36 5 40 44 77 47 27 2 44-11 65-8" />
              <path d="M106 247c23-20 31-41 54-42 22-1 31 22 52 21 29-2 40-35 67-32 26 3 30 29 60 32 25 3 37-4 54-2" />
              <path className="terrain-river" d="M90 126c29 23 40 48 70 59 32 11 61 7 83 29 20 21 29 58 67 65 38 6 71-19 111-8" />
              <path className="terrain-road" d="M99 269c37-30 66-36 102-34 33 2 63 22 98 12 43-12 59-49 105-48" />
              <circle className="terrain-point" cx="264" cy="214" r="8" />
            </svg>
          </div>
        </div>
        <div className="terrain-pin"><span><Icon name="target" /></span><i /></div>
        <div className="terrain-caption caption-left"><span className="caption-dot" /> {hi ? 'सीमा + मैदानी अभिलेख' : 'BOUNDARY + FIELD RECORDS'}</div>
        <div className="terrain-caption caption-right"><strong>30 m</strong><span>{hi ? 'छवि संदर्भ' : 'IMAGE CONTEXT'}</span></div>
        <div className="terrain-coordinate">{hi ? 'पायलट स्थल · लंबित' : 'PILOT SITE · PENDING'} <small>{hi ? 'केवल उदाहरणात्मक भूभाग' : 'Illustrative terrain only'}</small></div>
      </div>
      <div className="login-footnote"><span>{hi ? 'मैदानी साक्ष्य की समीक्षा उसके स्रोत और स्थान के आधार पर होती है।' : 'FIELD EVIDENCE IS REVIEWED AGAINST ITS SOURCE AND LOCATION.'}</span><span>{hi ? 'स्थानीय पायलट · विकास संस्करण' : 'LOCAL PILOT · DEVELOPMENT BUILD'}</span></div>
    </section>

    <section className="login-access">
      <form className="login-card" onSubmit={(event) => void submit(event)}>
        <div className="auth-card-top"><button className="auth-back-link" type="button" onClick={() => onPageChange('public')}>← {hi ? 'सार्वजनिक साइट' : 'Public site'}</button><LanguageSwitch language={language} onChange={onLanguageChange} /></div>
        <span className="login-card-kicker">{registering ? (hi ? 'कार्यक्षेत्र खाता बनाएँ' : 'CREATE A WORKSPACE ACCOUNT') : (hi ? 'सुरक्षित कार्यक्षेत्र लॉग इन' : 'SECURE WORKSPACE ACCESS')}</span>
        <h2>{registering ? (hi ? 'कार्यक्षेत्र से जुड़ें' : 'Join the workspace') : (hi ? 'वापसी पर स्वागत है' : 'Welcome back')}</h2>
        <p>{registering ? (hi ? 'जलागम अभिलेखों और मैदानी मॉड्यूल तक पहुँचने के लिए खाता बनाएँ।' : 'Create an account to access watershed records and field modules.') : (hi ? 'अपने जलागम डेटा, साक्ष्य और निगरानी मॉड्यूल देखने के लिए लॉग इन करें।' : 'Sign in to view your watershed data, evidence and monitoring modules.')}</p>
        {registering && <label className="login-field"><span>{hi ? 'पूरा नाम' : 'Full name'}</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" minLength={2} maxLength={120} required /></label>}
        <label className="login-field"><span>{hi ? 'ईमेल पता' : 'Email address'}</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
        <label className="login-field"><span>{hi ? 'पासवर्ड' : 'Password'} {registering && <small>{hi ? 'कम से कम 12 अक्षर' : 'At least 12 characters'}</small>}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 12 : undefined} required /></label>
        {registering && <label className="login-field"><span>{hi ? 'पासवर्ड की पुष्टि करें' : 'Confirm password'}</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={12} required /></label>}
        {error && <div className="login-error" role="alert"><Icon name="alert" />{error}</div>}
        <button className="login-submit" type="submit" disabled={busy}>{busy ? (registering ? (hi ? 'खाता बनाया जा रहा है…' : 'Creating account…') : (hi ? 'लॉग इन हो रहा है…' : 'Signing in…')) : <>{registering ? (hi ? 'खाता बनाएँ' : 'Create account') : (hi ? 'कार्यक्षेत्र खोलें' : 'Open workspace')} <span>→</span></>}</button>
        <div className="auth-switch">{registering ? <>{hi ? 'पहले से पंजीकृत हैं?' : 'Already registered?'} <button type="button" onClick={() => onPageChange('login')}>{hi ? 'लॉग इन' : 'Login'}</button></> : <>{hi ? 'कार्यक्षेत्र में नए हैं?' : 'New to the workspace?'} <button type="button" onClick={() => onPageChange('register')}>{hi ? 'खाता बनाएँ' : 'Create an account'}</button></>}</div>
        <div className="login-security"><span className="security-dot" /> {registering ? (hi ? 'नए खातों को मैदानी कर्मचारी की भूमिका मिलती है। व्यवस्थापक बाद में पहुँच बदल सकता है।' : 'New accounts receive the field staff role. An administrator can change access later.') : (hi ? 'पासवर्ड salted hash के रूप में सुरक्षित हैं; सत्र HTTP-only cookie का उपयोग करते हैं।' : 'Passwords are stored as salted hashes; sessions use an HTTP-only cookie.')}</div>
      </form>
      <div className="login-access-footer"><span>{hi ? 'जलागम निगरानी' : 'Watershed monitoring'}</span><span>·</span><span>{hi ? 'स्थानिक साक्ष्य मंच' : 'Spatial evidence platform'}</span></div>
    </section>
  </main>;
}
