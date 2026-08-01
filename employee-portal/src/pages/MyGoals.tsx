import { useEffect, useState } from 'react';
import { Plus, Target, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface Goal {
  id: string;
  title: string;
  description?: string;
  goal_type: string;
  category: string;
  metric?: string;
  target_value?: string;
  current_value?: string;
  unit?: string;
  start_date: string;
  due_date: string;
  weight: number;
  status: string;
  completion_percentage: number;
  cycle_name: string;
  manager_name?: string;
  employee_comments?: string;
  manager_comments?: string;
}

export default function MyGoals() {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);

  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [currentValue, setCurrentValue] = useState('');
  const [progress, setProgress] = useState(0);
  const [comments, setComments] = useState('');

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/performance/goals?employee_id=current');
      setGoals(response.data || []);
    } catch (error) {
      console.error('Failed to load goals', error);
      // In test mode or when API fails, use empty array so page still renders
      setGoals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgress = (goal: Goal) => {
    setSelectedGoal(goal);
    setCurrentValue(goal.current_value || '');
    setProgress(goal.completion_percentage || 0);
    setComments(goal.employee_comments || '');
    setShowUpdateModal(true);
  };

  const submitUpdate = async () => {
    if (!selectedGoal) return;

    try {
      await api.put(`/performance/goals/${selectedGoal.id}/progress`, {
        current_value: currentValue,
        completion_percentage: progress,
        employee_comments: comments,
      });
      alert('Goal updated successfully');
      setShowUpdateModal(false);
      await loadGoals();
    } catch (error: any) {
      alert('Failed to update goal');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: any }> = {
      active: { color: 'bg-blue-100 text-blue-800', icon: Clock },
      in_progress: { color: 'bg-yellow-100 text-yellow-800', icon: TrendingUp },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    };
    const badge = badges[status] || badges.active;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.replace('_', ' ')}
      </span>
    );
  };

  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'in_progress');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const avgProgress = activeGoals.length > 0 ? activeGoals.reduce((sum, g) => sum + g.completion_percentage, 0) / activeGoals.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Goals</h1>
        <p className="text-gray-600 mt-1">Track and update your performance goals</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Goals</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{activeGoals.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full"><Target className="w-6 h-6 text-blue-600" /></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Progress</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{Math.round(avgProgress)}%</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full"><TrendingUp className="w-6 h-6 text-yellow-600" /></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{completedGoals.length}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full"><CheckCircle className="w-6 h-6 text-green-600" /></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Goals</h2>
          {goals.length === 0 ? (
            <div className="text-center py-12">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No goals yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => (
                <div key={goal.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{goal.title}</h3>
                      <p className="text-sm text-gray-600">{goal.description}</p>
                    </div>
                    {getStatusBadge(goal.status)}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-600">Target</p>
                      <p className="text-sm font-medium">{goal.target_value} {goal.unit}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Current</p>
                      <p className="text-sm font-medium">{goal.current_value || 'Not set'} {goal.unit}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Due Date</p>
                      <p className="text-sm font-medium">{format(new Date(goal.due_date), 'dd MMM yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Weight</p>
                      <p className="text-sm font-medium">{goal.weight}%</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{goal.completion_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${goal.completion_percentage}%` }} />
                    </div>
                  </div>

                  {goal.status !== 'completed' && (
                    <button
                      onClick={() => handleUpdateProgress(goal)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Update Progress
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showUpdateModal && selectedGoal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Update Goal Progress</h3>
              <p className="text-sm text-gray-600">{selectedGoal.title}</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Value ({selectedGoal.unit})
                </label>
                <input
                  type="text"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder={`Target: ${selectedGoal.target_value}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Completion %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(e) => setProgress(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Add notes about your progress..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitUpdate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
