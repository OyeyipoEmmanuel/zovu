import { useLanguage } from '../hooks/useLanguage'

export const LanguageSwitcher = () => {
  const { activeLanguage, changeLanguage, languages } = useLanguage()

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center items-center gap-2 py-3 px-4"
      style={{
        background: 'rgba(13, 13, 13, 0.95)',
        borderTop: '1px solid #2A2A2A',
        backdropFilter: 'blur(10px)'
      }}
    >
      <span
        style={{ color: '#A0A0A0', fontSize: '12px', marginRight: '8px' }}
      >
        🌐 Language:
      </span>

      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => changeLanguage(lang.code)}
          style={{
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: activeLanguage === lang.code ? '600' : '400',
            border: activeLanguage === lang.code
              ? '1px solid #1A6B4A'
              : '1px solid #2A2A2A',
            background: activeLanguage === lang.code
              ? '#1A6B4A'
              : 'transparent',
            color: activeLanguage === lang.code ? '#F5F5F5' : '#A0A0A0',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {lang.label}
        </button>
      ))}
    </div>
  )
}
