'use client';

import React, { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  ScatterController,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { ExampleDay, FlightCategory } from '@/types';
import { pilotApi } from '@/services/api';
import { ChevronDown, ChevronUp, Calendar, Loader2 } from 'lucide-react';
import { FLIGHT_CATEGORY_COLORS } from '@/utils/weatherCategory';

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  ScatterController
);

interface ExampleDayCardProps {
  example: ExampleDay;
  airportCode: string;
  onClose?: () => void;
}

interface HistoricalArrival {
  hour: number;
  duration: number;
  type: string | null;
}

export function ExampleDayCard({ example, airportCode }: ExampleDayCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [arrivals, setArrivals] = useState<HistoricalArrival[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryColors = FLIGHT_CATEGORY_COLORS[example.category] || FLIGHT_CATEGORY_COLORS.unknown;

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);

    if (arrivals) return;

    setLoading(true);
    setError(null);

    try {
      const data = await pilotApi.getHistoricalDayData(airportCode, example.date);
      setArrivals(data.arrivals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!arrivals) return null;

    const scatterData = arrivals.map(a => ({
      x: a.hour,
      y: a.duration,
    }));

    return {
      datasets: [{
        data: scatterData,
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        borderColor: 'rgba(99, 102, 241, 0.8)',
        pointRadius: 2,
        pointHoverRadius: 4,
      }],
    };
  }, [arrivals]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { parsed: { x: number; y: number } }) => {
            const hour = Math.floor(context.parsed.x);
            const min = Math.round((context.parsed.x - hour) * 60);
            return `${hour}:${String(min).padStart(2, '0')} - ${context.parsed.y.toFixed(1)}min`;
          },
        },
      },
    },
    scales: {
      x: {
        min: 6,
        max: 24,
        title: { display: false },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: 'rgba(156, 163, 175, 0.7)',
          font: { size: 9 },
          callback: (value: number | string) => `${value}:00`,
        },
      },
      y: {
        min: 10,
        max: 40,
        title: { display: false },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: 'rgba(156, 163, 175, 0.7)',
          font: { size: 9 },
        },
      },
    },
  }), []);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${day}, ${year}`;
  };

  return (
    <div className="bg-slate-800/60 rounded-lg border border-slate-700 overflow-hidden">
      <button
        onClick={handleExpand}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm font-medium text-gray-200">{formatDate(example.date)}</span>
          <span
            className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
            style={{
              backgroundColor: categoryColors.bg,
              color: categoryColors.color,
              border: `1px solid ${categoryColors.border}`,
            }}
          >
            {example.category}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-gray-400">{example.arrivalCount} arrivals</div>
            <div className="text-sm font-medium text-gray-200">P50: {example.p50}m</div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-700/50">
          {loading && (
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="ml-2 text-sm text-gray-400">Loading arrivals...</span>
            </div>
          )}

          {error && (
            <div className="h-32 flex items-center justify-center">
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {chartData && !loading && !error && (
            <div className="mt-2">
              <div className="h-36 bg-slate-900/50 rounded p-2">
                <Scatter data={chartData} options={chartOptions} />
              </div>
              {example.weather && (
                <WeatherTimelineBar timeline={example.weather} />
              )}
              <div className="mt-1 flex justify-between text-[10px] text-gray-500">
                <span>Time of day (local)</span>
                <span>Duration from 50nm (min)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WeatherTimelineBar({ timeline }: { timeline: Record<number, FlightCategory> }) {
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);
  
  return (
    <div className="mt-1 mx-2">
      <div className="flex h-3 rounded overflow-hidden">
        {hours.map(hour => {
          const category = timeline[hour] || 'VFR';
          const colors = FLIGHT_CATEGORY_COLORS[category] || FLIGHT_CATEGORY_COLORS.unknown;
          return (
            <div
              key={hour}
              className="flex-1"
              style={{ backgroundColor: colors.color }}
              title={`${hour}:00 - ${category}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[8px] text-gray-500 mt-0.5 px-0.5">
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}

export default ExampleDayCard;

