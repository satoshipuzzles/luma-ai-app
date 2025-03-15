// pages/api/check-status.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Maximum number of retry attempts for video verification
const MAX_VIDEO_RETRIES = 3;
// Delay between retries (ms)
const RETRY_DELAY = 500;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Generation ID is required' });
  }

  try {
    // Get API key from environment
    const apiKey = process.env.LUMA_API_KEY;
    if (!apiKey) {
      console.error('LUMA_API_KEY is not set');
      return res.status(500).json({ message: 'API configuration error' });
    }

    // First try - fetch generation status
    const response = await fetchGenerationWithRetry(id, apiKey);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch generation status: ${errorText}`);
      throw new Error('Failed to check generation status');
    }

    const data = await response.json();
    console.log('Generation status response:', {
      id: data.id,
      state: data.state,
      hasVideo: !!data.assets?.video,
      hasImage: !!data.assets?.image
    });

    // If completed, verify video accessibility with retries
    if (data.state === 'completed' && data.assets?.video) {
      try {
        let videoAccessible = false;
        let retryCount = 0;
        
        // Retry up to MAX_VIDEO_RETRIES times with delay
        while (!videoAccessible && retryCount < MAX_VIDEO_RETRIES) {
          try {
            const videoCheck = await fetch(data.assets.video, { method: 'HEAD' });
            
            if (videoCheck.ok) {
              videoAccessible = true;
              console.log(`Video verified accessible after ${retryCount} retries`);
            } else {
              console.log(`Video not accessible on attempt ${retryCount + 1}, status: ${videoCheck.status}`);
              retryCount++;
              
              if (retryCount < MAX_VIDEO_RETRIES) {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              }
            }
          } catch (e) {
            console.error(`Error checking video URL on attempt ${retryCount + 1}:`, e);
            retryCount++;
            
            if (retryCount < MAX_VIDEO_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
          }
        }
        
        // If video still not accessible after retries, mark as still processing
        if (!videoAccessible) {
          console.log('Video not accessible after all retries, marking as still processing');
          data.state = 'processing';
          data.assets.video = null;
        }
      } catch (e) {
        console.error('Error in video verification process:', e);
        // If video check fails completely, mark as still processing
        data.state = 'processing';
        data.assets.video = null;
      }
    }
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in status check:', error);
    return res.status(500).json({ 
      message: 'Error checking generation status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Helper function to fetch generation with retry logic
async function fetchGenerationWithRetry(
  id: string, 
  apiKey: string, 
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(
        `https://api.lumalabs.ai/dream-machine/v1/generations/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          },
        }
      );
      
      // If successful or client error (4xx), return immediately
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      
      // For server errors (5xx), retry after delay
      console.log(`Server error on attempt ${attempt + 1}, status: ${response.status}`);
      lastError = new Error(`Server returned ${response.status}`);
      
      // Wait before retry, with exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    } catch (error) {
      console.error(`Network error on attempt ${attempt + 1}:`, error);
      lastError = error instanceof Error ? error : new Error('Network error');
      
      // Wait before retry, with exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError || new Error('Failed to fetch after multiple attempts');
}
