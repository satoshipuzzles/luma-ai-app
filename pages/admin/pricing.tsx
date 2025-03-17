// pages/admin/pricing.tsx
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { toast } from "@/components/ui/use-toast";

// Types for pricing structure
interface DurationPricing {
  '3s': number;
  '5s': number;
  '8s': number;
  '10s': number;
}

interface Ray2Pricing {
  '540p': DurationPricing;
  '720p': DurationPricing;
  '1080p': DurationPricing;
  '4k': DurationPricing;
}

interface PricingConfig {
  base: number;  // Base price for Ray 1
  ray2: Ray2Pricing;
  photon: number; // Base price for Photon (still images)
}

// Admin Password (with fallback for development)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'temporary-dev-password';

export default function AdminPricing() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pricing, setPricing] = useState<PricingConfig>({
    base: 1000,
    photon: 500,
    ray2: {
      '540p': {
        '3s': 1000,
        '5s': 1500,
        '8s': 2000,
        '10s': 2500
      },
      '720p': {
        '3s': 1500,
        '5s': 2000,
        '8s': 2500,
        '10s': 3000
      },
      '1080p': {
        '3s': 2000,
        '5s': 2500,
        '8s': 3000,
        '10s': 3500
      },
      '4k': {
        '3s': 3000,
        '5s': 3500,
        '8s': 4000,
        '10s': 5000
      }
    }
  });

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Admin password in development mode:', ADMIN_PASSWORD);
    }
    
    if (!ADMIN_PASSWORD) {
      toast({
        variant: "destructive",
        title: "Configuration Error",
        description: "Admin password not configured. Please check environment variables."
      });
    }
  }, []);

  // Load existing pricing on mount
  useEffect(() => {
    const loadPricing = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/pricing');
        
        if (response.ok) {
          const data = await response.json();
          setPricing(data);
        }
      } catch (error) {
        console.error('Error loading pricing:', error);
        toast({
          variant: "destructive",
          title: "Failed to load pricing",
          description: "Could not load current pricing configuration"
        });
      } finally {
        setLoading(false);
      }
    };

    if (authenticated) {
      loadPricing();
    }
  }, [authenticated]);

  // Handle login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting login with provided password');
    
    if (!ADMIN_PASSWORD) {
      toast({
        variant: "destructive",
        title: "Configuration Error",
        description: "Admin password not configured. Please check server environment variables."
      });
      return;
    }
    
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      toast({
        title: "Authenticated",
        description: "Welcome to the admin panel"
      });
    } else {
      toast({
        variant: "destructive",
        title: "Authentication failed",
        description: "Invalid password"
      });
    }
  };

  // Handle save pricing
  const savePricing = async () => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          pricing,
          adminPassword: ADMIN_PASSWORD // Simple validation
        }),
      });
      
      if (response.ok) {
        toast({
          title: "Pricing saved",
          description: "The pricing configuration has been updated"
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save pricing');
      }
    } catch (error) {
      console.error('Error saving pricing:', error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save pricing configuration"
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle pricing update for Ray 2
  const updateRay2Price = (
    resolution: '540p' | '720p' | '1080p' | '4k',
    duration: '3s' | '5s' | '8s' | '10s',
    value: number
  ) => {
    setPricing(prev => ({
      ...prev,
      ray2: {
        ...prev.ray2,
        [resolution]: {
          ...prev.ray2[resolution],
          [duration]: value
        }
      }
    }));
  };

  // Login form
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center">
        <Head>
          <title>Admin - Animal Sunset</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        
        <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-xl w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <Settings className="w-8 h-8 text-purple-500 mr-2" />
            <h1 className="text-2xl font-bold">Admin Login</h1>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Admin pricing panel
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Head>
        <title>Pricing Admin - Animal Sunset</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <header className="bg-[#1a1a1a] p-4 border-b border-gray-800">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center">
            <Settings className="mr-2 w-5 h-5" />
            Animal Sunset Admin
          </h1>
          
          <button
            onClick={() => setAuthenticated(false)}
            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm"
          >
            Logout
          </button>
        </div>
      </header>
      
      <main className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Pricing Configuration</h2>
          
          <button
            onClick={savePricing}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg flex items-center"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Base pricing for Ray 1 */}
            <div className="bg-[#1a1a1a] p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-4">Ray 1 Base Price</h3>
              <div className="flex items-center">
                <label className="w-36">Base Price (sats):</label>
                <input
                  type="number"
                  value={pricing.base}
                  onChange={(e) => setPricing(prev => ({ ...prev, base: parseInt(e.target.value) || 0 }))}
                  className="bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white w-32"
                  min="0"
                />
              </div>
            </div>
            
            {/* Base pricing for Photon (stills) */}
            <div className="bg-[#1a1a1a] p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-4">Photon (Still Images) Price</h3>
              <div className="flex items-center">
                <label className="w-36">Base Price (sats):</label>
                <input
                  type="number"
                  value={pricing.photon}
                  onChange={(e) => setPricing(prev => ({ ...prev, photon: parseInt(e.target.value) || 0 }))}
                  className="bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white w-32"
                  min="0"
                />
              </div>
            </div>
            
            {/* Ray 2 detailed pricing */}
            <div className="bg-[#1a1a1a] p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-6">Ray 2 Pricing Matrix</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-2 border-b border-gray-700">Resolution</th>
                      <th className="text-center p-2 border-b border-gray-700">3 seconds</th>
                      <th className="text-center p-2 border-b border-gray-700">5 seconds</th>
                      <th className="text-center p-2 border-b border-gray-700">8 seconds</th>
                      <th className="text-center p-2 border-b border-gray-700">10 seconds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(['540p', '720p', '1080p', '4k'] as const).map(resolution => (
                      <tr key={resolution} className="border-b border-gray-800">
                        <td className="p-2 font-medium">{resolution}</td>
                        {(['3s', '5s', '8s', '10s'] as const).map(duration => (
                          <td key={`${resolution}-${duration}`} className="p-2">
                            <input
                              type="number"
                              value={pricing.ray2[resolution][duration]}
                              onChange={(e) => updateRay2Price(
                                resolution, 
                                duration, 
                                parseInt(e.target.value) || 0
                              )}
                              className="bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white w-full"
                              min="0"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
