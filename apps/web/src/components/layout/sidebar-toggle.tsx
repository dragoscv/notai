'use client';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@notai/ui/components/button';
import { cn } from '@notai/lib/utils';
import { useSidebar } from './app-shell';

/**
 * Hamburger button to open the mobile sidebar drawer. Only visible below md.
 * Place inside each page header (Today, NoteWorkspace, etc).
 */
export function SidebarToggle({ className }: { className?: string }) {
  const { toggleMobile } = useSidebar();
  const t = useTranslations('sidebarTree.toggle');
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      className={cn('md:hidden', className)}
      onClick={toggleMobile}
      aria-label={t('openNav')}
      title={t('openNav')}
    >
      <Menu />
    </Button>
  );
}
