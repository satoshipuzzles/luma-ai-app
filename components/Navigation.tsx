import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronDown } from 'lucide-react';

export const Navigation = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-xl font-bold hover:text-purple-400 transition-colors"
      >
        <span>{router.pathname === '/' ? 'Animal Sunset 🌞🦒' : 'Gallery'}</span>
        <ChevronDown className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full mt-2 w-48 bg-[#1a1a1a] rounded-lg shadow-lg overflow-hidden z-50">
          <Link
            href="/"
            className={`block px-4 py-2 hover:bg-purple-600 transition-colors ${
              router.pathname === '/' ? 'bg-purple-700' : ''
            }`}
            onClick={() => setIsOpen(false)}
          >
            Animal Sunset 🌞🦒
          </Link>
          <Link
            href="/gallery"
            className={`block px-4 py-2 hover:bg-purple-600 transition-colors ${
              router.pathname === '/gallery' ? 'bg-purple-700' : ''
            }`}
            onClick={() => setIsOpen(false)}
          >
            Gallery
          </Link>
        </div>
      )}
    </div>
  );
};
