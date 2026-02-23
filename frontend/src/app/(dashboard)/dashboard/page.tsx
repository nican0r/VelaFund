import { Layers, Users, Grid3X3, ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ElementType;
  active?: boolean;
}

function StatCard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  active = false,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-6 transition-shadow duration-150',
        active
          ? 'border-transparent bg-ocean-600 text-white shadow-md'
          : 'border-gray-200 bg-white shadow-sm',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-wide',
            active ? 'text-white/80' : 'text-gray-500',
          )}
        >
          {label}
        </span>
        <Icon
          className={cn('h-5 w-5', active ? 'text-white/80' : 'text-gray-400')}
        />
      </div>
      <p
        className={cn(
          'mt-2 text-stat',
          active ? 'text-white' : 'text-navy-900',
        )}
      >
        {value}
      </p>
      {change && (
        <div className="mt-1 flex items-center gap-x-1">
          {changeType === 'positive' && (
            <TrendingUp
              className={cn('h-3.5 w-3.5', active ? 'text-white/80' : 'text-celadon-700')}
            />
          )}
          {changeType === 'negative' && (
            <TrendingDown
              className={cn('h-3.5 w-3.5', active ? 'text-white/80' : 'text-[#DC2626]')}
            />
          )}
          <span
            className={cn(
              'text-xs font-medium',
              active
                ? 'text-white/80'
                : changeType === 'positive'
                  ? 'text-celadon-700'
                  : changeType === 'negative'
                    ? 'text-[#DC2626]'
                    : 'text-gray-500',
            )}
          >
            {change}
          </span>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-navy-900">
          Dashboard
        </h1>
        <p className="mt-1 text-[13px] text-gray-500">
          Overview of your company cap table and recent activity.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Shares"
          value="1.000.000"
          change="+10.000 this month"
          changeType="positive"
          icon={Layers}
          active
        />
        <StatCard
          label="Shareholders"
          value="12"
          change="+2 this month"
          changeType="positive"
          icon={Users}
        />
        <StatCard
          label="Share Classes"
          value="3"
          icon={Grid3X3}
        />
        <StatCard
          label="Transactions"
          value="24"
          change="+5 this month"
          changeType="positive"
          icon={ArrowLeftRight}
        />
      </div>

      {/* Content section placeholders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Ownership chart placeholder */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800">
            Ownership Distribution
          </h2>
          <p className="mt-1 text-[13px] text-gray-500">
            Share distribution by shareholder
          </p>
          <div className="mt-6 flex h-[240px] items-center justify-center rounded-lg bg-gray-50">
            <p className="text-sm text-gray-400">Chart will be rendered here</p>
          </div>
        </div>

        {/* Recent transactions placeholder */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800">
                Recent Transactions
              </h2>
              <p className="mt-1 text-[13px] text-gray-500">
                Last 5 transactions
              </p>
            </div>
            <button className="text-sm font-medium text-ocean-600 hover:text-ocean-700 transition-colors duration-150">
              View all
            </button>
          </div>
          <div className="mt-6 space-y-3">
            {[
              { type: 'Issuance', shares: '10.000', date: '20/02/2026', to: 'Fund Alpha' },
              { type: 'Transfer', shares: '5.000', date: '18/02/2026', to: 'Maria Santos' },
              { type: 'Issuance', shares: '15.000', date: '15/02/2026', to: 'Investor B' },
              { type: 'Transfer', shares: '2.000', date: '10/02/2026', to: 'Employee Pool' },
              { type: 'Issuance', shares: '8.000', date: '05/02/2026', to: 'Angel Investor' },
            ].map((tx, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">{tx.type}</p>
                  <p className="text-xs text-gray-500">{tx.to}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums text-gray-700">
                    {tx.shares} shares
                  </p>
                  <p className="text-xs text-gray-500">{tx.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Quick Actions</h2>
        <p className="mt-1 text-[13px] text-gray-500">Common tasks for cap table management</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-x-2 rounded-md bg-ocean-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-ocean-500 active:bg-ocean-700">
            Issue Shares
          </button>
          <button className="inline-flex items-center gap-x-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50">
            Add Shareholder
          </button>
          <button className="inline-flex items-center gap-x-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50">
            Record Transfer
          </button>
          <button className="inline-flex items-center gap-x-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50">
            Export Cap Table
          </button>
        </div>
      </div>
    </div>
  );
}
