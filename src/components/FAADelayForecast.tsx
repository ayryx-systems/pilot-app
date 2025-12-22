'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { formatAirportLocalTimeShort } from '@/utils/airportTime';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DelayForecast {
  sequence: number;
  delayMinutes: number;
}

interface FAADelayForecastProps {
  delayForecast: DelayForecast[] | null;
  forecastStartTime: string | null;
  airportCode?: string;
}

export function FAADelayForecast({ delayForecast, forecastStartTime, airportCode }: FAADelayForecastProps) {
  const chartData = useMemo(() => {
    if (!delayForecast || delayForecast.length === 0 || !forecastStartTime) {
      return null;
    }

    const startTime = new Date(forecastStartTime);
    const labels: string[] = [];
    const delays: number[] = [];

    delayForecast.forEach((forecast) => {
      const forecastTime = new Date(startTime);
      forecastTime.setUTCMinutes(forecastTime.getUTCMinutes() + ((forecast.sequence - 1) * 15));
      
      if (airportCode) {
        labels.push(formatAirportLocalTimeShort(forecastTime.toISOString(), airportCode));
      } else {
        const hours = forecastTime.getUTCHours();
        const minutes = forecastTime.getUTCMinutes();
        labels.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
      }
      delays.push(forecast.delayMinutes);
    });

    return {
      labels,
      datasets: [
        {
          label: 'Delay Forecast (minutes)',
          data: delays,
          borderColor: 'rgb(251, 146, 60)',
          backgroundColor: 'rgba(251, 146, 60, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    };
  }, [delayForecast, forecastStartTime]);

  if (!chartData) {
    return null;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: 'rgb(203, 213, 225)',
          font: {
            size: 11,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: 'rgb(203, 213, 225)',
        bodyColor: 'rgb(203, 213, 225)',
        borderColor: 'rgb(51, 65, 85)',
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            return `${context.parsed.y} minutes`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: 'rgb(148, 163, 184)',
          font: {
            size: 10,
          },
          maxRotation: 45,
          minRotation: 45,
        },
        grid: {
          color: 'rgba(51, 65, 85, 0.5)',
        },
      },
      y: {
        ticks: {
          color: 'rgb(148, 163, 184)',
          font: {
            size: 10,
          },
          callback: (value: any) => `${value} min`,
        },
        grid: {
          color: 'rgba(51, 65, 85, 0.5)',
        },
        title: {
          display: true,
          text: 'Delay (minutes)',
          color: 'rgb(148, 163, 184)',
          font: {
            size: 11,
          },
        },
      },
    },
  };

  return (
    <div className="p-2 bg-slate-800/50 border border-slate-700 rounded text-sm mt-2">
      <h4 className="text-xs font-semibold text-slate-300 mb-2">Delay Forecast</h4>
      <div style={{ height: '150px', position: 'relative' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

