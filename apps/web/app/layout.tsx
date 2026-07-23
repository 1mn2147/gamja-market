import type { Metadata } from 'next';
import { SiteShell } from '@gamja/ui';
import { AuthNavAction } from './auth-nav-action';
import './globals.css';

export const metadata: Metadata = {
  title: '감자마켓',
  description: '안전한 동네 중고거래 플랫폼',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><SiteShell headerAction={<AuthNavAction />}>{children}</SiteShell></body></html>;
}
