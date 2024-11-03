interface StoredGeneration {
  id: string;
  prompt: string;
  videoUrl?: string;
  state: string;
  createdAt: string;
  pubkey: string;
}

export const saveGeneration = (generation: StoredGeneration) => {
  const generations = getGenerations();
  generations.unshift(generation);
  localStorage.setItem('generations', JSON.stringify(generations));
};

export const getGenerations = (): StoredGeneration[] => {
  const stored = localStorage.getItem('generations');
  return stored ? JSON.parse(stored) : [];
};
