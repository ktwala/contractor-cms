import { AlertTriangle } from 'lucide-react';

interface BudgetProgressProps {
  budget: number;
  spent: number;
  currency?: string;
  showAmounts?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function BudgetProgress({
  budget,
  spent,
  currency = 'ZAR',
  showAmounts = true,
  size = 'md',
}: BudgetProgressProps) {
  const utilization = budget === 0 ? 0 : (spent / budget) * 100;
  const remaining = budget - spent;

  const getColor = () => {
    if (utilization >= 100) return 'bg-red-600';
    if (utilization >= 80) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  const getTextColor = () => {
    if (utilization >= 100) return 'text-red-600';
    if (utilization >= 80) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getHeight = () => {
    switch (size) {
      case 'sm':
        return 'h-1';
      case 'lg':
        return 'h-3';
      default:
        return 'h-2';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="space-y-2">
      {showAmounts && (
        <div className="flex items-center justify-between text-xs">
          <div className="space-y-1">
            <div className="text-gray-600">
              <span className="font-medium">Budget:</span> {formatCurrency(budget)}
            </div>
            <div className="text-gray-600">
              <span className="font-medium">Spent:</span> {formatCurrency(spent)}
            </div>
            <div className="text-gray-600">
              <span className="font-medium">Remaining:</span> {formatCurrency(remaining)}
            </div>
          </div>
          <div className={`font-bold text-lg ${getTextColor()}`}>{utilization.toFixed(1)}%</div>
        </div>
      )}

      {!showAmounts && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Budget Utilization</span>
          <span className={`font-medium ${getTextColor()}`}>{utilization.toFixed(1)}%</span>
        </div>
      )}

      <div className={`w-full bg-gray-200 rounded-full ${getHeight()} overflow-hidden`}>
        <div
          className={`${getHeight()} rounded-full transition-all ${getColor()}`}
          style={{ width: `${Math.min(utilization, 100)}%` }}
        />
      </div>

      {utilization >= 80 && (
        <div className="flex items-center space-x-1 text-xs">
          <AlertTriangle
            className={`w-3 h-3 ${utilization >= 100 ? 'text-red-600' : 'text-yellow-600'}`}
          />
          <span className={utilization >= 100 ? 'text-red-600' : 'text-yellow-600'}>
            {utilization >= 100 ? 'Budget exceeded!' : 'Approaching budget limit'}
          </span>
        </div>
      )}
    </div>
  );
}
