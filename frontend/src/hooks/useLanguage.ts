import { useState, useEffect } from 'react'

const LANGUAGE_KEY = 'zovu_language'

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ig', label: 'Igbo' },
  { code: 'ha', label: 'Hausa' },
]

const setGoogleTranslateCookie = (code: string) => {
  const value = code === 'en' ? '' : `/en/${code}`
  document.cookie = `googtrans=${value}; path=/`
  document.cookie = `googtrans=${value}; path=/; domain=${window.location.hostname}`
}

const triggerGoogleTranslate = (code: string) => {
  const select = document.querySelector('.goog-te-combo') as HTMLSelectElement
  if (!select) return

  if (code === 'en') {
    // Reset to English
    select.value = ''
    select.dispatchEvent(new Event('change'))

    // Also clear the cookie and reload to fully restore English
    setGoogleTranslateCookie('en')
    setTimeout(() => window.location.reload(), 300)
    return
  }

  select.value = code
  select.dispatchEvent(new Event('change'))
}

export const useLanguage = () => {
  const [activeLanguage, setActiveLanguage] = useState('en')

  // On mount — read saved language but default to English
  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY) || 'en'
    setActiveLanguage(saved)

    if (saved !== 'en') {
      // Wait for Google Translate widget to be ready
      const interval = setInterval(() => {
        const select = document.querySelector('.goog-te-combo') as HTMLSelectElement
        if (select) {
          select.value = saved
          select.dispatchEvent(new Event('change'))
          clearInterval(interval)
        }
      }, 500)
      setTimeout(() => clearInterval(interval), 6000)
    } else {
      // Make sure English is default — clear any stale cookie
      setGoogleTranslateCookie('en')
    }
  }, [])

  const changeLanguage = (code: string) => {
    localStorage.setItem(LANGUAGE_KEY, code)
    setActiveLanguage(code)
    setGoogleTranslateCookie(code)
    triggerGoogleTranslate(code)
  }

  return {
    activeLanguage,
    changeLanguage,
    languages: LANGUAGES
  }
}