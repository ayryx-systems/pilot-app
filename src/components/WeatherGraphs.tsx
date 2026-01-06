'use client';

import React, { useEffect, useRef, useState, useMemo, memo } from 'react';
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
import { getCurrentUTCTime } from '@/utils/airportTime';

/**
 * Component to render weather event bars aligned with Chart.js x-axis
 * Uses Chart.js scale API to get exact pixel positions for alignment
 */
const EventBarsOverlay = memo(function EventBarsOverlay({
  events,
  graphData,
  chartRef,
  headerHeight,
  rowHeight,
  bottomPadding,
  getWeatherEventColor,
  getWeatherEventLabel,
}: {
  events: Array<{ startIndex: number; endIndex: number; rowIndex: number; weather: string; category: string }>;
  graphData: { timeSlots: string[] };
  chartRef: React.RefObject<ChartJS<'line'> | null>;
  headerHeight: number;
  rowHeight: number;
  bottomPadding: number;
  getWeatherEventColor: (category: string) => string;
  getWeatherEventLabel: (weather: string) => string;
}) {
  const [positions, setPositions] = useState<Map<number, { left: number; width: number }>>(new Map());
  
  const calculatePositions = React.useCallback(() => {
    if (!chartRef.current || !graphData) {
      setPositions(new Map());
      return;
    }
    
    const chart = chartRef.current;
    const xScale = chart.scales.x;
    if (!xScale || !chart.chartArea) {
      setPositions(new Map());
      return;
    }
    
    const newPositions = new Map<number, { left: number; width: number }>();
    // Hacky offset
    const containerLeft = chart.chartArea.left - 12;
    
    events.forEach((event) => {
      try {
        const startPixel = xScale.getPixelForValue(event.startIndex);
        const endIndexForPixel = Math.min(event.endIndex + 1, graphData.timeSlots.length - 1);
        const endPixel = xScale.getPixelForValue(endIndexForPixel);
        
        const left = startPixel - containerLeft;
        const width = endPixel - startPixel;
        
        if (width > 0 && left >= 0) {
          newPositions.set(event.startIndex * 10000 + event.endIndex, { left, width });
        }
      } catch (e) {
        console.warn('Error calculating event position:', e, event);
      }
    });
    
    setPositions(newPositions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, graphData]); // chartRef is a ref and doesn't need to be in dependencies
  
  useEffect(() => {
    const timer = setTimeout(() => {
      calculatePositions();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [calculatePositions]); // chartRef is a ref and doesn't need to be in dependencies
  
  useEffect(() => {
    if (!chartRef.current) return;
    
    const handleResize = () => {
      calculatePositions();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatePositions]); // chartRef is a ref and doesn't need to be in dependencies
  
  return (
    <div className="absolute inset-0 pointer-events-none z-10" style={{ paddingBottom: `${bottomPadding}px` }}>
      {events.map((event, idx) => {
        const startTime = graphData.timeSlots[event.startIndex];
        const endTime = graphData.timeSlots[event.endIndex];
        const positionKey = event.startIndex * 10000 + event.endIndex;
        const position = positions.get(positionKey);
        const topPosition = headerHeight + (event.rowIndex * rowHeight);
        
        if (!position || position.width <= 0) {
          return null;
        }
        
        return (
          <div
            key={`event-${idx}`}
            className="absolute pointer-events-auto"
            style={{ 
              height: `${rowHeight - 4}px`,
              top: `${topPosition + 1}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
              minWidth: '3px',
            }}
          >
            <div
              className={`h-full ${getWeatherEventColor(event.category)} rounded opacity-85 transition-opacity border border-gray-600 shadow-sm`}
              title={`${getWeatherEventLabel(event.weather)} - ${startTime} to ${endTime}`}
            />
          </div>
        );
      })}
    </div>
  );
});

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

interface WeatherGraphsProps {
  weather?: {
    metar?: string;
    metarFriendly?: string;
    visibility?: number | string;
    clouds?: Array<{ coverage: string; altitude: number }>;
    ceiling?: number | null;
    cloudbase?: number | null;
    wind?: {
      direction: number;
      speed: number;
      gust?: number;
    };
    taf?: {
      rawTAF?: string;
      tafFriendly?: string;
      forecast?: {
        periods: Array<{
          timeFrom: string;
          timeTo: string;
          changeType: string;
          wind?: { direction: number; speed: number; gust?: number };
          visibility?: number | string;
          weather?: string;
          clouds?: Array<{ coverage: string; altitude: number }>;
          ceiling?: number | null;
    cloudbase?: number | null;
        }>;
        summary?: string;
      };
    };
    graph?: {
      timeSlots: string[];
      visibility: (number | null)[];
      ceiling: (number | null)[];
      cloudbase?: (number | null)[];
      wind: (number | null)[];
      metarRaw: string | null;
      tafRaw: string | null;
      weatherEvents?: Array<{
        startIndex: number;
        endIndex: number;
        weather: string;
        category: string;
        changeType: string;
      }>;
    } | null;
  };
  selectedTime: Date;
  isNow: boolean;
}

export const WeatherGraphs = memo(function WeatherGraphs({
  weather,
  selectedTime,
  isNow,
}: WeatherGraphsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [visibilityData, setVisibilityData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ceilingData, setCeilingData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [windData, setWindData] = useState<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollPositionRef = useRef<number>(0);
  const eventChartRef = useRef<ChartJS<'line'>>(null);

  // Memoize graph data to prevent unnecessary recalculations
  const graphData = useMemo(() => {
    if (!weather?.graph) return null;
    return weather.graph;
  }, [weather?.graph]);

  // Create formatted labels with round hour values, showing only unique hours
  const formattedLabels = useMemo(() => {
    if (!graphData?.timeSlots) return null;
    
    const labels: string[] = [];
    let lastHour = '';
    
    graphData.timeSlots.forEach((label) => {
      if (label === 'NOW') {
        labels.push('NOW');
        return;
      }
      
      const [hours, minutes] = label.split(':').map(Number);
      
      // Round to nearest hour for display
      const roundedHour = minutes >= 30 ? (hours + 1) % 24 : hours;
      const hourLabel = `${String(roundedHour).padStart(2, '0')}:00`;
      
      // Only include label if it's a new hour (avoid duplicates)
      if (hourLabel !== lastHour) {
        labels.push(hourLabel);
        lastHour = hourLabel;
      } else {
        labels.push('');
      }
    });
    
    return labels;
  }, [graphData?.timeSlots]);

  // Memoize selected index calculation
  // Backend provides timeSlots as local time strings (e.g., "08:00", "08:15", "NOW")
  // Slots are aligned to 15-minute boundaries in UTC, then converted to local time for labels
  // We calculate the slot index based on minutes from current UTC time
  const selectedIndex = useMemo(() => {
    if (!graphData) return -1;
    
    const { timeSlots } = graphData;
    const nowIndex = timeSlots.indexOf('NOW');
    
    if (isNow && nowIndex >= 0) {
      return nowIndex;
    }
    
    // Calculate slot index based on time difference from now
    // Backend aligns slots to 15-min boundaries, so we use the same calculation
    const slotIntervalMinutes = 15;
    const now = getCurrentUTCTime();
    const selectedMinutes = Math.floor((selectedTime.getTime() - now.getTime()) / (1000 * 60));
    const targetSlot = Math.round(selectedMinutes / slotIntervalMinutes);
    
    if (targetSlot >= 0 && targetSlot < timeSlots.length) {
      return targetSlot;
    } else if (targetSlot < 0) {
      return nowIndex >= 0 ? nowIndex : 0;
    } else {
      return timeSlots.length - 1;
    }
  }, [graphData, selectedTime, isNow]);

  useEffect(() => {
    if (!graphData) {
      setVisibilityData(null);
      setCeilingData(null);
      setWindData(null);
      return;
    }

    const { timeSlots, visibility, ceiling, cloudbase, wind } = graphData;
    const ceilingData = ceiling || cloudbase;

    if (visibility.some(v => v !== null)) {
      setVisibilityData({
        labels: formattedLabels || timeSlots,
        data: visibility,
        selectedIndex,
        selectedTime: selectedIndex >= 0 ? timeSlots[selectedIndex] : 'NOW',
      });
    } else {
      setVisibilityData(null);
    }

    if (ceilingData && ceilingData.some((c: number | null) => c !== null)) {
      setCeilingData({
        labels: formattedLabels || timeSlots,
        data: ceilingData,
        selectedIndex,
        selectedTime: selectedIndex >= 0 ? timeSlots[selectedIndex] : 'NOW',
      });
    } else {
      setCeilingData(null);
    }

    if (wind.some(w => w !== null)) {
      setWindData({
        labels: formattedLabels || timeSlots,
        data: wind,
        selectedIndex,
        selectedTime: selectedIndex >= 0 ? timeSlots[selectedIndex] : 'NOW',
      });
    } else {
      setWindData(null);
    }
  }, [graphData, selectedIndex, formattedLabels]);

  useEffect(() => {
    if (scrollContainerRef.current && savedScrollPositionRef.current > 0) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = savedScrollPositionRef.current;
        }
      });
    }
  }, [graphData]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    savedScrollPositionRef.current = e.currentTarget.scrollTop;
  };

  if (!weather?.graph) {
    return null;
  }

  const { metarRaw, tafRaw, weatherEvents } = weather.graph;

  const graphs = [
    { data: visibilityData, title: 'Visibility', yTitle: 'Kilometers', isBottom: false },
    { data: ceilingData, title: 'Ceiling', yTitle: 'Feet', isBottom: false },
    { data: windData, title: 'Wind Speed', yTitle: 'Knots', isBottom: true },
  ].filter(g => g.data !== null);

  const getWeatherEventColor = (category: string) => {
    switch (category) {
      case 'thunderstorm':
        return 'bg-purple-500';
      case 'snow':
        return 'bg-blue-400';
      case 'rain':
        return 'bg-blue-500';
      case 'fog':
        return 'bg-gray-400';
      case 'freezing':
        return 'bg-cyan-400';
      case 'volcanic':
        return 'bg-red-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getWeatherEventLabel = (weather: string) => {
    const upper = weather.toUpperCase();
    if (upper.includes('TS')) return 'Thunderstorm';
    if (upper.includes('SN')) return 'Snow';
    if (upper.includes('RA') || upper.includes('DZ')) return 'Rain';
    if (upper.includes('FG') || upper.includes('BR') || upper.includes('HZ')) return 'Fog';
    if (upper.includes('PL') || upper.includes('GR') || upper.includes('GS')) return 'Freezing';
    if (upper.includes('VA')) return 'Volcanic';
    return weather;
  };

  return (
    <div className="space-y-4">
      {metarRaw && (
        <div className="text-xs font-mono text-gray-400 bg-gray-900 p-2 rounded">
          <div className="text-gray-500 mb-1">METAR (CURRENT)</div>
          {metarRaw}
        </div>
      )}
      
      {tafRaw && (
        <div className="text-xs font-mono text-gray-400 bg-gray-900 p-2 rounded">
          <div className="text-gray-500 mb-1">TAF (FORECAST)</div>
          {tafRaw}
        </div>
      )}

      {graphs.length > 0 && (
        <div className="space-y-0.5">
          {graphs.map((graph, index) => {
            const isBottom = index === graphs.length - 1;
            const isVisibility = graph.title === 'Visibility';
            const isCeiling = graph.title === 'Ceiling';

            return (
              <div key={graph.title} className={isBottom ? '' : 'mb-0'}>
                <div className="flex justify-between items-center mb-0.5">
                  <h3 className="text-xs font-semibold text-gray-300">{graph.title}</h3>
                </div>
                <div className="h-20 -mt-1">
                  <Line
                    data={{
                      labels: graph.data.labels,
                      datasets: [
                        {
                          label: `${graph.title} (${graph.yTitle.toLowerCase()})`,
                          data: graph.data.data,
                          borderColor: 'rgb(59, 130, 246)',
                          backgroundColor: isCeiling 
                            ? 'rgba(59, 130, 246, 0.1)'
                            : 'rgba(59, 130, 246, 0.1)',
                          fill: isCeiling 
                            ? { target: 'origin', above: 'rgba(59, 130, 246, 0.1)' }
                            : true,
                          tension: 0.4,
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          pointRadius: (ctx: any) => {
                            const value = graph.data.data[ctx.dataIndex];
                            if (value === null || value === undefined) return 0;
                            return ctx.dataIndex === selectedIndex ? 6 : 0;
                          },
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          pointBackgroundColor: (ctx: any) => {
                            const value = graph.data.data[ctx.dataIndex];
                            if (value === null || value === undefined) return 'transparent';
                            return ctx.dataIndex === selectedIndex ? '#ffffff' : 'transparent';
                          },
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          pointBorderColor: (ctx: any) => {
                            const value = graph.data.data[ctx.dataIndex];
                            if (value === null || value === undefined) return 'transparent';
                            return ctx.dataIndex === selectedIndex ? 'rgb(59, 130, 246)' : 'transparent';
                          },
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          pointBorderWidth: (ctx: any) => {
                            const value = graph.data.data[ctx.dataIndex];
                            if (value === null || value === undefined) return 0;
                            return ctx.dataIndex === selectedIndex ? 2 : 0;
                          },
                          spanGaps: false,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      animation: { duration: 0 },
                      transitions: {
                        active: {
                          animation: { duration: 0 },
                        },
                      },
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          enabled: false
                        },
                      },
                      layout: {
                        padding: {
                          left: 0,
                          right: 0,
                          top: isVisibility ? 16 : 0,
                          bottom: 0,
                        },
                      },
                      scales: {
                        x: {
                          display: true,
                          border: {
                            display: isBottom,
                          },
                          grid: {
                            display: true,
                            color: 'rgba(255, 255, 255, 0.1)',
                          },
                          ticks: {
                            display: isBottom,
                            color: 'rgba(255, 255, 255, 0.6)',
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            callback: function(value: any) {
                              const label = this.getLabelForValue(value);
                              return label || undefined;
                            },
                          },
                        },
                        y: {
                          min: isVisibility ? 0 : isCeiling ? 0 : undefined,
                          max: isVisibility ? 10 : undefined,
                          border: {
                            display: false,
                          },
                          grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                          },
                          ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            stepSize: isVisibility ? 2 : undefined,
                            autoSkip: isVisibility ? false : true,
                            maxTicksLimit: isVisibility ? undefined : undefined,
                            includeBounds: isVisibility ? false : true,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            callback: function(value: any) {
                              if (isVisibility) {
                                if (value > 10) return undefined;
                                if (value === 10) return '10+';
                                return value.toString();
                              }
                              if (isCeiling) {
                                if (value === 0) return 'ground';
                                return value.toString();
                              }
                              return value.toString();
                            },
                          },
                          title: {
                            display: true,
                            text: graph.yTitle,
                            color: 'rgba(255, 255, 255, 0.6)',
                            font: {
                              size: 9,
                            },
                            padding: {
                              top: 0,
                              bottom: 0,
                            },
                          },
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          afterFit: function(scaleInstance: any) {
                            scaleInstance.width = 70;
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {weatherEvents && weatherEvents.length > 0 && graphData && (() => {
        const validEvents = weatherEvents.filter((event) => 
          graphData.timeSlots && 
          event.startIndex >= 0 && 
          event.endIndex < graphData.timeSlots.length &&
          event.startIndex <= event.endIndex
        );

        if (validEvents.length === 0) return null;

        const layoutEvents = (events: typeof validEvents) => {
          const eventsByCategory = new Map<string, typeof validEvents>();
          
          events.forEach(event => {
            const category = event.category || 'other';
            if (!eventsByCategory.has(category)) {
              eventsByCategory.set(category, []);
            }
            eventsByCategory.get(category)!.push(event);
          });

          const categoryRows: Array<{ category: string; events: Array<typeof events[0] & { rowIndex: number }> }> = [];
          let globalRowIndex = 0;

          const categoryOrder = ['thunderstorm', 'snow', 'rain', 'fog', 'freezing', 'volcanic', 'other'];
          const sortedCategories = Array.from(eventsByCategory.entries()).sort((a, b) => {
            const idxA = categoryOrder.indexOf(a[0]);
            const idxB = categoryOrder.indexOf(b[0]);
            if (idxA === -1 && idxB === -1) return a[0].localeCompare(b[0]);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });

          sortedCategories.forEach(([category, categoryEvents]) => {
            const sortedEvents = [...categoryEvents].sort((a, b) => {
              if (a.startIndex !== b.startIndex) {
                return a.startIndex - b.startIndex;
              }
              return a.endIndex - b.endIndex;
            });

            const rows: Array<Array<typeof events[0]>> = [];

            for (const event of sortedEvents) {
              let placed = false;
              
              for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
                const row = rows[rowIdx];
                const overlaps = row.some(existingEvent => {
                  return !(event.endIndex < existingEvent.startIndex || event.startIndex > existingEvent.endIndex);
                });
                
                if (!overlaps) {
                  row.push(event);
                  placed = true;
                  break;
                }
              }
              
              if (!placed) {
                rows.push([event]);
              }
            }

            rows.forEach((row, localRowIdx) => {
              categoryRows.push({
                category,
                events: row.map(event => ({ ...event, rowIndex: globalRowIndex + localRowIdx }))
              });
            });

            globalRowIndex += rows.length;
          });

          return categoryRows.flatMap(cr => cr.events);
        };

        const laidOutEvents = layoutEvents(validEvents);
        const maxRows = Math.max(...laidOutEvents.map(e => e.rowIndex), -1) + 1;
        const rowHeight = 18;
        const maxVisibleRows = 8;
        const headerHeight = 0;
        const xAxisHeight = 30;
        const bottomPadding = xAxisHeight;
        const totalHeight = headerHeight + (maxRows * rowHeight) + bottomPadding;
        const visibleHeight = Math.min(totalHeight, headerHeight + (maxVisibleRows * rowHeight) + bottomPadding);
        const chartLabels = formattedLabels || graphData.timeSlots;
        const emptyData = new Array(graphData.timeSlots.length).fill(null);

        const eventRows: Array<Array<typeof laidOutEvents[0]>> = [];
        laidOutEvents.forEach(event => {
          if (!eventRows[event.rowIndex]) {
            eventRows[event.rowIndex] = [];
          }
          eventRows[event.rowIndex].push(event);
        });

        const getRowLabel = (row: Array<typeof laidOutEvents[0]>) => {
          const typeLabel = getWeatherEventLabel(row[0].weather);
          return typeLabel;
        };

        return (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-semibold text-gray-300">Weather Events</h3>
              {maxRows > maxVisibleRows && (
                <span className="text-[10px] text-gray-500">
                  {maxRows} rows (scrollable)
                </span>
              )}
            </div>
            <div className="relative rounded pt-2 px-2">
              <div 
                ref={scrollContainerRef}
                className="relative overflow-y-auto"
                style={{ 
                  maxHeight: `${visibleHeight}px`,
                }}
                onScroll={handleScroll}
              >
                <div className="flex relative" style={{ height: `${totalHeight}px` }}>
                  <div className="flex-shrink-0 relative" style={{ width: '45px', height: `${totalHeight}px` }}>
                    {eventRows.map((row, rowIdx) => {
                      const topPosition = headerHeight + (rowIdx * rowHeight);
                      return (
                        <div
                          key={`label-row-${rowIdx}`}
                          className="absolute flex items-center justify-end pr-2"
                          style={{ 
                            top: `${topPosition}px`,
                            height: `${rowHeight}px`,
                            width: '100%',
                          }}
                        >
                          <span className="text-[10px] text-gray-400 truncate w-full text-right font-medium">
                            {getRowLabel(row)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex-1 relative" style={{ minWidth: 0, height: `${totalHeight}px` }}>
                    <div className="absolute pointer-events-none z-0" style={{ top: `${headerHeight}px`, bottom: '0px', left: '0px', right: '0px', paddingBottom: '0px' }}>
                      <Line
                        ref={eventChartRef}
                        data={{
                          labels: chartLabels,
                          datasets: [{
                            data: emptyData,
                            borderColor: 'transparent',
                            backgroundColor: 'transparent',
                            pointRadius: 0,
                            pointHoverRadius: 0,
                          }],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          animation: { duration: 0 },
                          plugins: {
                            legend: { display: false },
                            tooltip: { enabled: false },
                          },
                          layout: {
                            padding: {
                              top: 0,
                              bottom: 3,
                              left: 0,
                              right: 0,
                            },
                          },
                          scales: {
                            x: {
                              display: true,
                              position: 'bottom',
                              offset: false,
                              grid: {
                                display: true,
                                color: 'rgba(255, 255, 255, 0.1)',
                              },
                              ticks: {
                                display: true,
                                color: 'rgba(255, 255, 255, 0.6)',
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 8,
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            callback: function(value: any) {
                                  const label = this.getLabelForValue(value);
                                  return label || undefined;
                                },
                              },
                            },
                            y: {
                              display: false,
                            },
                          },
                        }}
                      />
                    </div>
                    <EventBarsOverlay
                      events={laidOutEvents}
                      graphData={graphData}
                      chartRef={eventChartRef}
                      headerHeight={headerHeight}
                      rowHeight={rowHeight}
                      bottomPadding={bottomPadding}
                      getWeatherEventColor={getWeatherEventColor}
                      getWeatherEventLabel={getWeatherEventLabel}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
});


