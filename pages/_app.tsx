import type { AppProps } from 'next/app';
import { Toaster } from "@/components/ui/toaster";
import { NostrProvider } from '@/contexts/NostrContext';
import '@/styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NostrProvider>
      <Component {...pageProps} />
      <Toaster />
    </NostrProvider>
  );
}

export default MyApp;
