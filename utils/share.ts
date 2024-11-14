import { NDKEvent } from '@nostr-dev-kit/ndk';

export const handleShare = async (
  ndk: any,
  content: string,
  targetEventId: string,
  type: 'note' | 'gallery' = 'note'
): Promise<NDKEvent> => {
  if (!ndk) {
    throw new Error('NDK instance is required');
  }

  const event = new NDKEvent(ndk);
  event.kind = type === 'note' ? 1 : 75757;
  event.content = content;
  event.tags = [
    ['t', 'animalsunset'],
    ['e', targetEventId, '', type === 'note' ? 'mention' : 'reference']
  ];

  await event.publish();
  return event;
};
