import { Calendar } from 'lucide-react';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear?: () => void;
  label?: string;
}

export default function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  label = 'Date Range',
}: DateRangeFilterProps) {
  const handleClear = () => {
    onStartDateChange('');
    onEndDateChange('');
    onClear?.();
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-600 whitespace-nowrap">{label}:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 w-full sm:w-32"
            placeholder="Start"
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 w-full sm:w-32"
            placeholder="End"
            min={startDate}
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={handleClear}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 hover:bg-gray-100 rounded whitespace-nowrap"
            type="button"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
