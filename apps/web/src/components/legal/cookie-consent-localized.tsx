'use client';

import { useTranslations } from 'next-intl';
import { CookieConsent, type CookieConsentStrings } from '@notai/ui/components/cookie-consent';

export function CookieConsentLocalized() {
  const t = useTranslations('cookieConsent');
  const strings: CookieConsentStrings = {
    ariaRegion: t('ariaRegion'),
    bannerTitle: t('bannerTitle'),
    bannerBody: t('bannerBody', { link: '{link}' }),
    bannerBodyLink: t('bannerBodyLink'),
    acceptAll: t('acceptAll'),
    rejectAll: t('rejectAll'),
    customize: t('customize'),
    settingsTitle: t('settingsTitle'),
    settingsDescription: t('settingsDescription'),
    closeAriaLabel: t('closeAriaLabel'),
    toggleAriaPrefix: t('toggleAriaPrefix'),
    toggleAriaSuffix: t('toggleAriaSuffix'),
    necessary: t('necessary'),
    necessaryDesc: t('necessaryDesc'),
    preferences: t('preferences'),
    preferencesDesc: t('preferencesDesc'),
    analytics: t('analytics'),
    analyticsDesc: t('analyticsDesc'),
    marketing: t('marketing'),
    marketingDesc: t('marketingDesc'),
    saveChoices: t('saveChoices'),
  };
  return <CookieConsent strings={strings} />;
}
