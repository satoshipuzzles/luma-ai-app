import Filter from 'bad-words';

const filter = new Filter();

// Add custom words specific to video generation that shouldn't be allowed
const additionalBadWords = [
  'nude',
  'explicit',
  'nsfw',
  'porn',
  'xxx',
  // Add any other words that should be filtered
];

filter.addWords(...additionalBadWords);

// Add exceptions for words that might be legitimate in animal context
const exceptions = [
  'breed',
  'mate',
  'tail',
  // Add other legitimate words that might be falsely flagged
];

filter.removeWords(...exceptions);

export const containsProfanity = (text: string): boolean => {
  return filter.isProfane(text.toLowerCase());
};

export const filterProfanity = (text: string): string => {
  return filter.clean(text);
};

// This function checks if the prompt is safe for the Luma AI API
export const isPromptSafe = (prompt: string): boolean => {
  // Check for profanity
  if (containsProfanity(prompt)) {
    return false;
  }

  // Check for specific patterns that might indicate inappropriate content
  const unsafePatterns = [
    /nsfw/i,
    /explicit/i,
    /inappropriate/i,
    /naked/i,
    /nude/i,
    /adult/i,
  ];

  for (const pattern of unsafePatterns) {
    if (pattern.test(prompt)) {
      return false;
    }
  }

  return true;
};

// Helper function to give feedback about why a prompt was rejected
export const getPromptFeedback = (prompt: string): string => {
  if (containsProfanity(prompt)) {
    return 'Your prompt contains inappropriate language. Please revise and try again.';
  }

  const unsafePatterns = [
    { pattern: /nsfw/i, message: 'NSFW content is not allowed.' },
    { pattern: /explicit/i, message: 'Explicit content is not allowed.' },
    { pattern: /inappropriate/i, message: 'Inappropriate content is not allowed.' },
    { pattern: /naked/i, message: 'Nudity is not allowed.' },
    { pattern: /nude/i, message: 'Nudity is not allowed.' },
    { pattern: /adult/i, message: 'Adult content is not allowed.' },
  ];

  for (const { pattern, message } of unsafePatterns) {
    if (pattern.test(prompt)) {
      return message;
    }
  }

  return 'Your prompt contains inappropriate content. Please revise and try again.';
};
