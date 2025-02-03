// pages/_app.tsx
import type { AppProps } from 'next/app';
import { Toaster } from "@/components/ui/toaster";
import { FeeProvider } from '@/context/FeeContext';
import '@/styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <FeeProvider>
      <Component {...pageProps} />
      <Toaster />
    </FeeProvider>
  );
}

export default MyApp;
