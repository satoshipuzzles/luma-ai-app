import type { AppProps } from 'next/app';
import { Toaster } from "@/components/ui/toaster";
import '@/styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Toaster />
    </>
  );
}

export default MyApp;
