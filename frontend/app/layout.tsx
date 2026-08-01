import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/lib/toast';
import { ErrorBoundary } from '@/components/error-boundary';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: EXTERNAL_WORKFORCE_LABELS.product,
  description: EXTERNAL_WORKFORCE_LABELS.productPlatform,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
