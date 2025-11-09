import { useState, useMemo, useRef, useEffect } from 'react';
import type { Stop } from '../gtfs.worker';

interface SearchableSelectProps {
  stops: Stop[];
  value: string;
  onChange: (stopId: string) => void;
  placeholder: string;
  disabled?: boolean;
}

export function SearchableSelect({ stops, value, onChange, placeholder, disabled }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter stops by search term
  const filteredStops = useMemo(() => {
    if (!searchTerm) return stops;
    const term = searchTerm.toLowerCase();
    return stops.filter(stop =>
      stop.stop_name.toLowerCase().includes(term)
    );
  }, [stops, searchTerm]);

  // Get selected stop name
  const selectedStop = stops.find(s => s.stop_id === value);
  const displayValue = selectedStop?.stop_name || placeholder;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (stopId: string) => {
    onChange(stopId);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {displayValue}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md border border-gray-300 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search stops..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Options List */}
          <div className="overflow-auto max-h-48">
            {filteredStops.length === 0 ? (
              <div className="px-4 py-3 text-gray-500 text-center">
                No stops found
              </div>
            ) : (
              filteredStops.map((stop) => (
                <button
                  key={stop.stop_id}
                  type="button"
                  onClick={() => handleSelect(stop.stop_id)}
                  className={`w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${
                    stop.stop_id === value ? 'bg-blue-100 font-semibold' : ''
                  }`}
                >
                  {stop.stop_name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
