'use client';

import { Settings2 } from 'lucide-react';
import { Button } from '@notai/ui/components/button';
import { useConsent } from '@notai/ui/components/consent-provider';

export function CookieSettingsButtonClient() {
    const { openSettings } = useConsent();
    return (
        <Button type="button" onClick={openSettings} className="gap-2">
            <Settings2 className="size-4" aria-hidden />
            Open cookie settings
        </Button>
    );
}
