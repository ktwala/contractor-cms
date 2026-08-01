import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Shift {
  id: string;
  shift_name: string;
  shift_code: string;
  start_time: string;
  end_time: string;
  break_duration_minutes: number;
  break_paid: boolean;
  shift_type: string;
  total_hours: number;
  overtime_multiplier: number;
  late_grace_period: number;
  is_active: boolean;
  country: string;
  created_at: string;
}

interface ShiftAssignment {
  id: string;
  employee_id: string;
  employee_name: string;
  shift_id: string;
  shift_name: string;
  effective_from: string;
  effective_to: string | null;
  work_days: number[];
  status: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
}

export default function ShiftManagement() {
  const [activeTab, setActiveTab] = useState<'shifts' | 'assignments'>('shifts');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments] = useState<ShiftAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  // Shift form state
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState({
    shift_name: '',
    shift_code: '',
    start_time: '08:00',
    end_time: '17:00',
    break_duration_minutes: 60,
    break_paid: false,
    shift_type: 'regular',
    overtime_multiplier: 1.5,
    late_grace_period: 15,
    country: 'ZA',
    legal_entity_id: '',
  });

  // Assignment form state
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    employee_id: '',
    shift_id: '',
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    work_days: [1, 2, 3, 4, 5], // Mon-Fri
  });

  useEffect(() => {
    loadShifts();
    loadEmployees();
  }, []);

  const loadShifts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/time-attendance/shifts');
      setShifts(response.data);
    } catch (error) {
      console.error('Failed to load shifts:', error);
      alert('Failed to load shifts');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/time-attendance/shifts', shiftForm);
      alert('Shift created successfully!');
      setShowShiftForm(false);
      resetShiftForm();
      await loadShifts();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create shift');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/time-attendance/shifts/assign', {
        ...assignmentForm,
        effective_to: assignmentForm.effective_to || null,
      });
      alert('Shift assigned successfully!');
      setShowAssignmentForm(false);
      resetAssignmentForm();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to assign shift');
    } finally {
      setLoading(false);
    }
  };

  const resetShiftForm = () => {
    setShiftForm({
      shift_name: '',
      shift_code: '',
      start_time: '08:00',
      end_time: '17:00',
      break_duration_minutes: 60,
      break_paid: false,
      shift_type: 'regular',
      overtime_multiplier: 1.5,
      late_grace_period: 15,
      country: 'ZA',
      legal_entity_id: '',
    });
    setEditingShift(null);
  };

  const resetAssignmentForm = () => {
    setAssignmentForm({
      employee_id: '',
      shift_id: '',
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: '',
      work_days: [1, 2, 3, 4, 5],
    });
  };

  const formatTime = (time: string) => {
    if (!time) return '-';
    return time.substring(0, 5); // HH:mm
  };

  const calculateShiftHours = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return 0;
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diff < 0) diff += 24; // Handle overnight shifts
    return diff.toFixed(2);
  };

  const getShiftTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      regular: 'bg-blue-100 text-blue-800',
      night: 'bg-purple-100 text-purple-800',
      weekend: 'bg-orange-100 text-orange-800',
      public_holiday: 'bg-red-100 text-red-800',
      flexible: 'bg-green-100 text-green-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getDayName = (day: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[day];
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shift Management</h1>
          <p className="text-gray-600 mt-1">Manage work shifts and employee assignments</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowShiftForm(true)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
          >
            + Create Shift
          </button>
          <button
            onClick={() => setShowAssignmentForm(true)}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm transition-colors"
          >
            Assign Shift
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('shifts')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'shifts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Shifts ({shifts.length})
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'assignments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Assignments ({assignments.length})
          </button>
        </nav>
      </div>

      {/* Shifts Tab */}
      {activeTab === 'shifts' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Break</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">OT Multiplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grace Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      Loading shifts...
                    </td>
                  </tr>
                ) : shifts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      No shifts found. Create your first shift to get started.
                    </td>
                  </tr>
                ) : (
                  shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{shift.shift_name}</div>
                        <div className="text-xs text-gray-500">{shift.country}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {shift.shift_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getShiftTypeColor(shift.shift_type)}`}>
                          {shift.shift_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {calculateShiftHours(shift.start_time, shift.end_time)}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {shift.break_duration_minutes}m
                        {shift.break_paid && <span className="text-green-600 ml-1">(paid)</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-medium">
                        {shift.overtime_multiplier}x
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {shift.late_grace_period} min
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          shift.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {shift.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-500 text-center py-12">
            Assignment management coming soon. Use the "Assign Shift" button to create new assignments.
          </p>
        </div>
      )}

      {/* Create Shift Modal */}
      {showShiftForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingShift ? 'Edit Shift' : 'Create New Shift'}
              </h2>
            </div>

            <form onSubmit={handleCreateShift} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shift Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={shiftForm.shift_name}
                    onChange={(e) => setShiftForm({ ...shiftForm, shift_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Day Shift"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shift Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={shiftForm.shift_code}
                    onChange={(e) => setShiftForm({ ...shiftForm, shift_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., DAY-01"
                  />
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Break */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Break Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={shiftForm.break_duration_minutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, break_duration_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center pt-8">
                  <input
                    type="checkbox"
                    id="break_paid"
                    checked={shiftForm.break_paid}
                    onChange={(e) => setShiftForm({ ...shiftForm, break_paid: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="break_paid" className="ml-2 text-sm text-gray-700">
                    Break is paid
                  </label>
                </div>
              </div>

              {/* Shift Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shift Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={shiftForm.shift_type}
                    onChange={(e) => setShiftForm({ ...shiftForm, shift_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="regular">Regular</option>
                    <option value="night">Night Shift</option>
                    <option value="weekend">Weekend</option>
                    <option value="public_holiday">Public Holiday</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={shiftForm.country}
                    onChange={(e) => setShiftForm({ ...shiftForm, country: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="ZA"
                  />
                </div>
              </div>

              {/* Overtime & Grace Period */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Overtime Multiplier
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="3.0"
                    value={shiftForm.overtime_multiplier}
                    onChange={(e) => setShiftForm({ ...shiftForm, overtime_multiplier: parseFloat(e.target.value) || 1.5 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Standard is 1.5x (time and a half)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Late Grace Period (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={shiftForm.late_grace_period}
                    onChange={(e) => setShiftForm({ ...shiftForm, late_grace_period: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Allowed late arrival before marking as late</p>
                </div>
              </div>

              {/* Calculated Hours Display */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900">
                  Total Shift Hours: {calculateShiftHours(shiftForm.start_time, shiftForm.end_time)} hours
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  (Break time: {shiftForm.break_duration_minutes} minutes {shiftForm.break_paid ? '- Paid' : '- Unpaid'})
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowShiftForm(false);
                    resetShiftForm();
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {loading ? 'Creating...' : editingShift ? 'Update Shift' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Shift Modal */}
      {showAssignmentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full m-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Assign Shift to Employee</h2>
            </div>

            <form onSubmit={handleAssignShift} className="p-6 space-y-6">
              {/* Employee Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={assignmentForm.employee_id}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_number} - {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shift <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={assignmentForm.shift_id}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, shift_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Shift</option>
                  {shifts.filter(s => s.is_active).map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.shift_name} ({formatTime(shift.start_time)} - {formatTime(shift.end_time)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Effective Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective From <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={assignmentForm.effective_from}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, effective_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective To (Optional)
                  </label>
                  <input
                    type="date"
                    value={assignmentForm.effective_to}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, effective_to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Work Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Days <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <label key={day} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={assignmentForm.work_days.includes(day)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignmentForm({
                              ...assignmentForm,
                              work_days: [...assignmentForm.work_days, day].sort(),
                            });
                          } else {
                            setAssignmentForm({
                              ...assignmentForm,
                              work_days: assignmentForm.work_days.filter(d => d !== day),
                            });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{getDayName(day)}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {assignmentForm.work_days.map(d => getDayName(d)).join(', ') || 'None'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignmentForm(false);
                    resetAssignmentForm();
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {loading ? 'Assigning...' : 'Assign Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
