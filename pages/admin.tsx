// pages/admin.tsx
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { MODEL_CONFIGS, ModelConfig } from '@/types/luma';
import { Lock, Save, RefreshCw } from 'lucide-react';
import { toast } from "@/components/ui/use-toast";

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [fees, setFees] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCurrentFees();
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        setIsAuthenticated(true);
        loadCurrentFees();
      } else {
        toast({
          variant: "destructive",
          title: "Authentication failed",
          description: "Invalid password"
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to authenticate"
      });
    }
  };

  const loadCurrentFees = async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const response = await fetch('/api/admin/fees', {
        headers: {
          'Authorization': `Bearer ${password}`
        }
      });

      if (response.ok) {
        const currentFees = await response.json();
        setFees(currentFees);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load fees"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/fees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify(fees)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Fees updated successfully"
        });
      } else {
        throw new Error('Failed to update fees');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save fees"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4">
        <Head>
          <title>Admin - Animal Sunset</title>
        </Head>
        
        <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-xl w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <Lock className="w-12 h-12 text-purple-500" />
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#2a2a2a] rounded-lg px-4 py-2 text-white border border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                placeholder="Enter admin password"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Log In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111111] text-white p-4 md:p-8">
      <Head>
        <title>Admin - Animal Sunset</title>
      </Head>

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <div className="flex gap-4">
            <button
              onClick={loadCurrentFees}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              <Save size={16} />
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(MODEL_CONFIGS).map(([modelId, config]) => (
            <div key={modelId} className="bg-[#1a1a1a] p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-2">{config.name}</h2>
              <p className="text-gray-400 mb-4">{config.description}</p>
              <ul className="list-disc list-inside text-sm text-gray-300 mb-4">
                {config.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Fee (sats)
                </label>
                <input
                  type="number"
                  value={fees[modelId] || config.defaultFee}
                  onChange={(e) => setFees(prev => ({
                    ...prev,
                    [modelId]: parseInt(e.target.value)
                  }))}
                  min="0"
                  step="100"
                  className="w-full bg-[#2a2a2a] rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
