import { useState } from 'react';
import Head from 'next/head';

interface GenerationResult {
  id: string;
  state: string;
  assets?: {
    video?: string;
  };
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState('');

  const generateVideo = async () => {
    if (!prompt) return;
    
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate video');
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError('Failed to generate video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>Luma AI Video Generator</title>
        <meta name="description" content="Generate videos using Luma AI" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Luma AI Video Generator
        </h1>

        <div className="max-w-2xl mx-auto space-y-6">
          <div className="relative">
            <textarea
              className="w-full p-4 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors resize-none"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt here... (e.g., 'a serene lake surrounded by mountains at sunset')"
              disabled={loading}
            />
          </div>

          <button
            onClick={generateVideo}
            disabled={loading || !prompt}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : (
              'Generate Video'
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-bold mb-3">Generation Status: {result.state}</h2>
              {result.assets?.video && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Generated Video:</h3>
                  <video 
                    className="w-full rounded-lg" 
                    controls 
                    src={result.assets.video}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Generation Details:</h3>
                <pre className="whitespace-pre-wrap bg-gray-900 p-3 rounded-lg text-sm">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
