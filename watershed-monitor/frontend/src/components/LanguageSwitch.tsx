export type Language = 'en' | 'hi';

export function LanguageSwitch({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return <div className="language-switch" role="group" aria-label="Choose language / भाषा चुनें">
    <button type="button" className={language === 'en' ? 'is-active' : ''} aria-pressed={language === 'en'} onClick={() => onChange('en')}>EN</button>
    <button type="button" className={language === 'hi' ? 'is-active' : ''} aria-pressed={language === 'hi'} onClick={() => onChange('hi')}>हिन्दी</button>
  </div>;
}
