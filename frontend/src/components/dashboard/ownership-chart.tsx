'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { CapTableEntry } from '@/types/company';

// Chart color palette per design-system.md §8.2
const CHART_COLORS = [
  '#1B6B93', // Ocean
  '#0A2342', // Navy
  '#9DCE94', // Celadon
  '#D4B96A', // Darkened cream
  '#2BBBB0', // Teal
  '#E07A5F', // Coral
  '#7B8CDE', // Lavender
  '#F2A65A', // Peach
];

interface ChartDataItem {
  name: string;
  value: number;
}

interface OwnershipChartProps {
  entries: CapTableEntry[];
  othersLabel: string;
}

function aggregateEntries(entries: CapTableEntry[]): ChartDataItem[] {
  // Aggregate by shareholder (a shareholder may hold multiple share classes)
  const byHolder = new Map<string, { name: string; value: number }>();

  for (const entry of entries) {
    const existing = byHolder.get(entry.shareholderId);
    const pct = parseFloat(entry.ownershipPercentage);
    if (existing) {
      existing.value += pct;
    } else {
      byHolder.set(entry.shareholderId, {
        name: entry.shareholderName,
        value: pct,
      });
    }
  }

  // Sort descending by ownership
  return Array.from(byHolder.values()).sort((a, b) => b.value - a.value);
}

function prepareChartData(
  entries: CapTableEntry[],
  othersLabel: string,
): ChartDataItem[] {
  const sorted = aggregateEntries(entries);

  if (sorted.length <= 7) return sorted;

  // Show top 6 individually, group the rest as "Others"
  const top = sorted.slice(0, 6);
  const othersValue = sorted.slice(6).reduce((sum, s) => sum + s.value, 0);
  return [...top, { name: othersLabel, value: othersValue }];
}

function formatPct(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  return (
    <div className="rounded-md bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-gray-200">
      <p className="font-medium text-gray-700">{item.name}</p>
      <p className="text-gray-500">{formatPct(item.value)}%</p>
    </div>
  );
}

export function OwnershipChart({ entries, othersLabel }: OwnershipChartProps) {
  const data = prepareChartData(entries, othersLabel);

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-lg bg-gray-50">
        <p className="text-sm text-gray-400">—</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* Donut chart */}
      <div className="h-[240px] w-full sm:w-[240px] sm:shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-1 flex-col gap-2">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{
                backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
              }}
            />
            <span className="flex-1 truncate text-sm text-gray-600">
              {item.name}
            </span>
            <span className="text-sm font-medium tabular-nums text-gray-700">
              {formatPct(item.value)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
