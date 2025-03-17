import type { AppProps } from 'next/app';
import { Toaster } from "@/components/ui/toaster";
import { useEffect } from 'react';
import Script from 'next/script';
import '@/styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  // Add this useEffect to detect Bitcoin Connect
  useEffect(() => {
    const checkBitcoinConnect = () => {
      if (typeof window !== 'undefined' && window.bitcoinConnect) {
        console.log('Bitcoin Connect detected!', window.bitcoinConnect);
      } else {
        console.log('Bitcoin Connect not available');
      }
    };
    
    // Check after a delay to allow script to load
    setTimeout(checkBitcoinConnect, 1000);
  }, []);
  
  return (
    <>
      {/* Add Bitcoin Connect Script */}
      <Script
        src="https://unpkg.com/@getalby/bitcoin-connect@1.0.0/dist/bitcoin-connect.js"
        strategy="afterInteractive"
        onLoad={() => console.log('Bitcoin Connect script loaded')}
        onError={(e) => console.error('Error loading Bitcoin Connect script:', e)}
      />
      
      <Component {...pageProps} />
      <Toaster />
    </>
  );
}

export default MyApp;
