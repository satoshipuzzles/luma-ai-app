import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import '@shadcn/ui/styles.css';
import { init } from '@getalby/bitcoin-connect-react';

function MyApp({ Component, pageProps }: AppProps) {
  init({
    appName: 'My Lightning App',
    // add any other configuration options as needed
  });

  return <Component {...pageProps} />;
}

export default MyApp;
