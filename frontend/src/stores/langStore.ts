import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Language, translations, TranslationKey } from '../lib/i18n';

interface LangState {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      lang: 'en',

      setLang: (lang) => {
        set({ lang });
        // Apply RTL/LTR to document
        document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
      },

      t: (key) => {
        const { lang } = get();
        return translations[lang][key] ?? translations.en[key] ?? key;
      },
    }),
    {
      name: 'goalbet-lang',
      onRehydrateStorage: () => (state) => {
        // Apply direction after rehydration
        if (state?.lang) {
          document.documentElement.dir = state.lang === 'he' ? 'rtl' : 'ltr';
          document.documentElement.lang = state.lang;
        }
      },
    }
  )
);
