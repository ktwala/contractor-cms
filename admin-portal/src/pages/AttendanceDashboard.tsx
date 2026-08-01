import { useState, useEffect } from 'react';
import api from '../services/api';

interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_number: string;
  attendance_date: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  minutes_late: number;
  status: string;
  shift_name: string;
}

interface AttendanceSummary {
  employee_id: string;
  employee_name: string;
  total_days: number;
  days_present: number;
  days_absent: number;
  days_late: number;
  attendance_percentage: number;
  total_hours: number;
  overtime_hours: number;
}

interface DashboardStats {
  total_employees: number;
  present_today: number;
  absent_today: number;
  late_today: number;
  clocked_in_now: number;
  average_attendance: number;
}

export default function AttendanceDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [view, setView] = useState<'daily' | 'monthly'>('daily');

  const [stats, setStats] = useState<DashboardStats>({
    total_employees: 0,
    present_today: 0,
    absent_today: 0,
    late_today: 0,
    clocked_in_now: 0,
    average_attendance: 0,
  });

  const [dailyRecords, setDailyRecords] = useState<AttendanceRecord[]>([]);
  const [monthlySummaries, setMonthlySummaries] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (view === 'daily') {
      loadDailyAttendance();
      loadStats();
    } else {
      loadMonthlySummaries();
    }
  }, [view, selectedDate, selectedMonth]);

  const loadStats = async () => {
    try {
      // For demo: calculate stats from records
      // In production, this would be a dedicated stats endpoint
      const response = await api.get('/employees');
      const employees = response.data;

      const attendanceResponse = await api.get('/time-attendance/attendance/all', {
        params: { date: selectedDate }
      });
      const records = attendanceResponse.data || [];

      const present = records.filter((r: any) => r.status === 'present' || r.status === 'late').length;
      const late = records.filter((r: any) => r.status === 'late').length;
      const clockedIn = records.filter((r: any) => r.clock_in_time && !r.clock_out_time).length;

      setStats({
        total_employees: employees.length,
        present_today: present,
        absent_today: employees.length - present,
        late_today: late,
        clocked_in_now: clockedIn,
        average_attendance: employees.length > 0 ? ((present / employees.length) * 100) : 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadDailyAttendance = async () => {
    try {
      setLoading(true);

      // Get all employees
      const employeesResponse = await api.get('/employees');
      const employees = employeesResponse.data;

      // Get attendance for each employee on selected date
      const records: AttendanceRecord[] = [];

      for (const emp of employees) {
        try {
          const response = await api.get(`/time-attendance/attendance/${emp.id}`, {
            params: {
              date_from: selectedDate,
              date_to: selectedDate,
            }
          });

          if (response.data && response.data.length > 0) {
            const record = response.data[0];
            records.push({
              ...record,
              employee_name: `${emp.first_name} ${emp.last_name}`,
              employee_number: emp.employee_number,
            });
          } else {
            // Employee didn't clock in - mark as absent
            records.push({
              id: `absent-${emp.id}`,
              employee_id: emp.id,
              employee_name: `${emp.first_name} ${emp.last_name}`,
              employee_number: emp.employee_number,
              attendance_date: selectedDate,
              clock_in_time: null,
              clock_out_time: null,
              total_hours: 0,
              regular_hours: 0,
              overtime_hours: 0,
              minutes_late: 0,
              status: 'absent',
              shift_name: '-',
            });
          }
        } catch (error) {
          console.error(`Failed to load attendance for ${emp.id}:`, error);
        }
      }

      setDailyRecords(records);
    } catch (error) {
      console.error('Failed to load daily attendance:', error);
      alert('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlySummaries = async () => {
    try {
      setLoading(true);

      // Get all employees
      const employeesResponse = await api.get('/employees');
      const employees = employeesResponse.data;

      const summaries: AttendanceSummary[] = [];

      for (const emp of employees) {
        try {
          const response = await api.get(`/time-attendance/summary/${emp.id}/${selectedMonth}`);

          summaries.push({
            employee_id: emp.id,
            employee_name: `${emp.first_name} ${emp.last_name}`,
            total_days: response.data.total_days || 0,
            days_present: response.data.days_present || 0,
            days_absent: response.data.days_absent || 0,
            days_late: response.data.days_late || 0,
            attendance_percentage: response.data.total_days > 0
              ? ((response.data.days_present / response.data.total_days) * 100)
              : 0,
            total_hours: response.data.total_hours_worked || 0,
            overtime_hours: response.data.overtime_hours || 0,
          });
        } catch (error) {
          console.error(`Failed to load summary for ${emp.id}:`, error);
        }
      }

      setMonthlySummaries(summaries);
    } catch (error) {
      console.error('Failed to load monthly summaries:', error);
      alert('Failed to load monthly summaries');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    return new Date(timeString).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      present: 'bg-green-100 text-green-800',
      late: 'bg-yellow-100 text-yellow-800',
      absent: 'bg-red-100 text-red-800',
      half_day: 'bg-blue-100 text-blue-800',
      on_leave: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 95) return 'text-green-600';
    if (percentage >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Attendance Dashboard</h1>
        <p className="text-gray-600 mt-1">Monitor team attendance and manage records</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Employees</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total_employees}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Present Today</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.present_today}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✓</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Absent Today</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.absent_today}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✗</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Late Today</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.late_today}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">⏰</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Clocked In</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.clocked_in_now}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🕐</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Attendance %</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">
                {stats.average_attendance.toFixed(0)}%
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* View Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setView('daily')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                view === 'daily'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Daily View
            </button>
            <button
              onClick={() => setView('monthly')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                view === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Monthly Summary
            </button>
          </div>

          {/* Date/Month Selector */}
          <div className="flex items-center gap-3">
            {view === 'daily' ? (
              <>
                <label className="text-sm font-medium text-gray-700">Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </>
            ) : (
              <>
                <label className="text-sm font-medium text-gray-700">Month:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </>
            )}

            <button
              onClick={() => {
                if (view === 'daily') {
                  setSelectedDate(new Date().toISOString().split('T')[0]);
                } else {
                  const now = new Date();
                  setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                }
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Today
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={() => alert('Export functionality coming soon')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Export Report
          </button>
        </div>
      </div>

      {/* Daily View */}
      {view === 'daily' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Attendance for {formatDate(selectedDate)}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overtime</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Loading attendance records...
                    </td>
                  </tr>
                ) : dailyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No attendance records found for this date
                    </td>
                  </tr>
                ) : (
                  dailyRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{record.employee_name}</div>
                        <div className="text-xs text-gray-500">{record.employee_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {record.shift_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.clock_in_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.clock_out_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.total_hours ? record.total_hours.toFixed(2) : '0.00'}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-medium">
                        {record.overtime_hours > 0 ? `${record.overtime_hours.toFixed(2)}h` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                          {record.status}
                          {record.minutes_late > 0 && ` (${record.minutes_late}m)`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => alert(`View details for ${record.employee_name}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Summary View */}
      {view === 'monthly' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Monthly Summary for {new Date(selectedMonth + '-01').toLocaleDateString('en-ZA', { year: 'numeric', month: 'long' })}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Present</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Absent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Late</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance %</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overtime</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Loading monthly summaries...
                    </td>
                  </tr>
                ) : monthlySummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No data available for this month
                    </td>
                  </tr>
                ) : (
                  monthlySummaries.map((summary) => (
                    <tr key={summary.employee_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{summary.employee_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {summary.total_days}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {summary.days_present}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        {summary.days_absent}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">
                        {summary.days_late}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-bold ${getAttendanceColor(summary.attendance_percentage)}`}>
                          {summary.attendance_percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {summary.total_hours.toFixed(2)}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-medium">
                        {summary.overtime_hours > 0 ? `${summary.overtime_hours.toFixed(2)}h` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
