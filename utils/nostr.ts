export const getNostrPublicKey = async () => {
  const win = window as any;
  if (!win.nostr) {
    throw new Error('Nostr extension not found. Please install a NIP-07 browser extension.');
  }
  return await win.nostr.getPublicKey();
};
