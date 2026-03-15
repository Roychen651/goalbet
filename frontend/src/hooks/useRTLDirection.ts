import { useEffect } from 'react';

const RTL_LANGUAGES = ['he', 'ar', 'fa', 'ur', 'yi', 'ji', 'iw', 'ku'];

export function useRTLDirection() {
  useEffect(() => {
    const lang = navigator.language.split('-')[0].toLowerCase();
    const isRTL = RTL_LANGUAGES.includes(lang);

    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = navigator.language;

    return () => {
      document.documentElement.dir = 'ltr';
    };
  }, []);
}
