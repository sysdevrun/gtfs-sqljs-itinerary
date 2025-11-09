import { useEffect, useState } from 'react';
import { SearchableSelect } from './SearchableSelect';
import type { Stop } from '../gtfs.worker';

interface ItineraryFormProps {
  stops: Stop[];
  onSearch: (params: {
    fromStopId: string;
    toStopId: string;
    date: string;
    departureTime: number;
  }) => void;
  isSearching: boolean;
}

export function ItineraryForm({ stops, onSearch, isSearching }: ItineraryFormProps) {
  const [fromStopId, setFromStopId] = useState('');
  const [toStopId, setToStopId] = useState('');
  const [date, setDate] = useState('');
  const [timeHour, setTimeHour] = useState('06:00');

  // Initialize with current date
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setDate(`${year}-${month}-${day}`);
  }, []);

  // Parent stops (stations) for selection
  const parentStops = stops.filter(s => !s.parent_station);

  // Manual search handler
  const handleSearch = () => {
    if (fromStopId && toStopId && date && timeHour) {
      const [hours, minutes] = timeHour.split(':').map(Number);
      const departureTime = hours * 3600 + minutes * 60;

      onSearch({
        fromStopId,
        toStopId,
        date: date.replace(/-/g, ''), // Convert YYYY-MM-DD to YYYYMMDD
        departureTime
      });
    }
  };

  // Trigger search on any form change if all fields are filled
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromStopId, toStopId, date, timeHour]);

  // Generate time options (1-hour increments)
  const timeOptions = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const timeStr = `${String(hour).padStart(2, '0')}:00`;
    timeOptions.push(timeStr);
  }

  // Handle time increment/decrement
  const adjustTime = (increment: number) => {
    const [hours, minutes] = timeHour.split(':').map(Number);
    let newHour = hours + increment;

    // Wrap around at boundaries
    if (newHour < 0) newHour = 23;
    if (newHour > 23) newHour = 0;

    setTimeHour(`${String(newHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Plan Your Journey</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From
          </label>
          <SearchableSelect
            stops={parentStops}
            value={fromStopId}
            onChange={setFromStopId}
            placeholder="Select departure stop..."
            disabled={isSearching}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To
          </label>
          <SearchableSelect
            stops={parentStops}
            value={toStopId}
            onChange={setToStopId}
            placeholder="Select arrival stop..."
            disabled={isSearching}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSearching}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Departure Time
          </label>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => adjustTime(-1)}
              disabled={isSearching}
              className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous hour"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <select
              value={timeHour}
              onChange={(e) => setTimeHour(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSearching}
            >
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => adjustTime(1)}
              disabled={isSearching}
              className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next hour"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={handleSearch}
          disabled={isSearching || !fromStopId || !toStopId || !date || !timeHour}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSearching ? 'Searching...' : 'Search Itineraries'}
        </button>
      </div>

      {isSearching && (
        <div className="mt-4 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Finding best routes...</span>
        </div>
      )}
    </div>
  );
}
