'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { Arrival } from '@/types';
import { utcToAirportLocal } from '@/utils/airportTime';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController
);

interface ArrivalScatterPlotProps {
  arrivals: Arrival[];
  airportCode: string;
  onPointClick?: (arrival: Arrival) => void;
}

// Aircraft category colors (matching stats-viewer.html)
const getAircraftCategory = (aircraftType: string | null): string => {
  if (!aircraftType) return 'other';
  
  const smallTypes = ['C208', 'C25A', 'C25B', 'C310', 'C525', 'C550', 'C560', 'C56X', 'C680', 'C68A', 'C700', 'C750', 'BE20', 'BE40', 'BE9L', 'PC12', 'SF50', 'LJ31', 'LJ35', 'LJ45', 'LJ60', 'CL30', 'CL35', 'CL60', 'E545', 'E550', 'E55P', 'FA20', 'FA50', 'FA7X', 'FA8X', 'F2TH', 'F900', 'G280', 'GA5C', 'GA6C', 'GALX', 'GL5T', 'GL7T', 'GLEX', 'GLF4', 'GLF5', 'GLF6', 'H25B', 'HA4T', 'HDJT', 'B350'];
  const regionalTypes = ['CRJ2', 'CRJ7', 'CRJ9', 'E135', 'E145', 'E170', 'E190', 'E35L', 'E45X', 'E75L', 'E75S', 'BCS1', 'BCS3'];
  const narrowbodyTypes = ['A20N', 'A21N', 'A319', 'A320', 'A321', 'B712', 'B734', 'B737', 'B738', 'B739', 'B38M', 'B39M', 'B752', 'B753'];
  const widebodyTypes = ['A306', 'A332', 'A333', 'A339', 'A343', 'A346', 'A359', 'A35K', 'B762', 'B763', 'B772', 'B77L', 'B77W', 'B788', 'B789', 'B78X', 'B744', 'B748', 'MD11'];
  
  if (smallTypes.includes(aircraftType)) return 'small';
  if (regionalTypes.includes(aircraftType)) return 'regional';
  if (narrowbodyTypes.includes(aircraftType)) return 'narrowbody';
  if (widebodyTypes.includes(aircraftType)) return 'widebody';
  return 'other';
};

const categoryColors: Record<string, string> = {
  small: 'rgba(201, 203, 207, 1)',
  regional: 'rgba(54, 162, 235, 1)',
  narrowbody: 'rgba(255, 159, 64, 1)',
  widebody: 'rgba(75, 192, 192, 1)',
  other: 'rgba(153, 102, 255, 1)',
};

const categoryNames: Record<string, string> = {
  small: 'Small/Light',
  regional: 'Regional',
  narrowbody: 'Narrow-body',
  widebody: 'Wide-body',
  other: 'Other',
};

export function ArrivalScatterPlot({ arrivals, airportCode, onPointClick }: ArrivalScatterPlotProps) {
  const chartRef = useRef<ChartJS<'scatter'>>(null);

  // Process arrivals into scatter plot data
  const chartData = useMemo(() => {
    if (!arrivals || arrivals.length === 0) {
      return null;
    }

    // Group arrivals by category
    const categoryData: Record<string, Arrival[]> = {};
    arrivals.forEach(arrival => {
      const category = getAircraftCategory(arrival.aircraftType);
      if (!categoryData[category]) {
        categoryData[category] = [];
      }
      categoryData[category].push(arrival);
    });

    // Create datasets for each category
    const datasets: any[] = [];
    const categoryOrder = ['narrowbody', 'widebody', 'regional', 'small', 'other'];

    categoryOrder.forEach(category => {
      const categoryArrivals = categoryData[category];
      if (categoryArrivals && categoryArrivals.length > 0) {
        const scatterData = categoryArrivals.map(arrival => {
          // Calculate hours since midnight in local time
          const landingTime = new Date(arrival.timestampLanding);
          const localTime = utcToAirportLocal(landingTime, airportCode);
          const hours = localTime.getUTCHours();
          const minutes = localTime.getUTCMinutes();
          const seconds = localTime.getUTCSeconds();
          const hoursSinceMidnight = hours + minutes / 60 + seconds / 3600;

          return {
            x: hoursSinceMidnight,
            y: arrival.durationMinutes,
            arrival: arrival, // Store full arrival object for click handling
          };
        });

        datasets.push({
          label: `${categoryNames[category]} (${categoryArrivals.length})`,
          data: scatterData,
          backgroundColor: categoryColors[category].replace('1)', '0.6)'),
          borderColor: categoryColors[category],
          pointRadius: 4,
          pointHoverRadius: 6,
          category: category,
        });
      }
    });

    return { datasets };
  }, [arrivals, airportCode]);

  const options = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: 0,
          max: 24,
          title: {
            display: true,
            text: 'Landing Time (Local)',
            color: '#e2e8f0',
            font: {
              size: 12,
            },
          },
          ticks: {
            color: '#94a3b8',
            callback: function(value: any) {
              if (typeof value !== 'number') return '';
              if (value >= 24) return '24:00';
              const hours = Math.floor(value);
              const minutes = Math.floor((value - hours) * 60);
              return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            },
            stepSize: 1,
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Time from 50nm (minutes)',
            color: '#e2e8f0',
            font: {
              size: 12,
            },
          },
          ticks: {
            color: '#94a3b8',
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: '#e2e8f0',
            font: {
              size: 11,
            },
            usePointStyle: true,
            padding: 10,
          },
        },
        tooltip: {
          callbacks: {
            title: function(context: any) {
              const point = context[0];
              const arrival = point.raw?.arrival as Arrival | undefined;
              if (arrival) {
                const landingTime = new Date(arrival.timestampLanding);
                return landingTime.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
              }
              return '';
            },
            label: function(context: any) {
              const arrival = context.raw?.arrival as Arrival | undefined;
              if (arrival) {
                const hours = Math.floor(arrival.durationMinutes / 60);
                const minutes = Math.round(arrival.durationMinutes % 60);
                return [
                  `Duration from 50nm: ${hours}h ${minutes}m (${arrival.durationMinutes.toFixed(1)} min)`,
                  `Aircraft: ${arrival.aircraftType || 'Unknown'}`,
                  `Callsign: ${arrival.callsign}`,
                  `ICAO: ${arrival.icao}`,
                ];
              }
              return '';
            },
          },
        },
      },
      onClick: (event: any, elements: any) => {
        if (elements.length > 0 && onPointClick) {
          const element = elements[0];
          const datasetIndex = element.datasetIndex;
          const dataIndex = element.index;
          const dataset = chartData?.datasets[datasetIndex];
          if (dataset && dataset.data[dataIndex]) {
            const arrival = dataset.data[dataIndex].arrival as Arrival;
            if (arrival) {
              onPointClick(arrival);
            }
          }
        }
      },
    };
  }, [chartData, onPointClick]);

  if (!chartData || chartData.datasets.length === 0) {
    return (
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Arrival Times (Last Hour)</h3>
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
          No arrival data available
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
      <h3 className="text-sm font-semibold text-slate-200 mb-2">Arrival Times (Last Hour)</h3>
      <div className="h-64">
        <Scatter ref={chartRef} data={chartData} options={options} />
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Click on any point to view the ground track on the map
      </p>
    </div>
  );
}

