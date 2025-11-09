import { useEffect, useState } from 'react';
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

  // Trigger search on any form change if all fields are filled
  useEffect(() => {
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
  }, [fromStopId, toStopId, date, timeHour, onSearch]);

  // Generate time options (2-hour increments)
  const timeOptions = [];
  for (let hour = 0; hour < 24; hour += 2) {
    const timeStr = `${String(hour).padStart(2, '0')}:00`;
    timeOptions.push(timeStr);
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Plan Your Journey</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From
          </label>
          <select
            value={fromStopId}
            onChange={(e) => setFromStopId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSearching}
          >
            <option value="">Select departure stop...</option>
            {parentStops.map((stop) => (
              <option key={stop.stop_id} value={stop.stop_id}>
                {stop.stop_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To
          </label>
          <select
            value={toStopId}
            onChange={(e) => setToStopId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSearching}
          >
            <option value="">Select arrival stop...</option>
            {parentStops.map((stop) => (
              <option key={stop.stop_id} value={stop.stop_id}>
                {stop.stop_name}
              </option>
            ))}
          </select>
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
          <select
            value={timeHour}
            onChange={(e) => setTimeHour(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSearching}
          >
            {timeOptions.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isSearching && (
        <div className="mt-4 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Searching for itineraries...</span>
        </div>
      )}
    </div>
  );
}
