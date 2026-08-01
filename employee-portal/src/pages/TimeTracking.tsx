import { useState, useEffect } from 'react';
import api from '../services/api';

interface AttendanceStatus {
  is_clocked_in: boolean;
  clock_in_time?: string;
  clock_out_time?: string;
  total_hours?: number;
  minutes_late?: number;
  status?: string;
  shift?: {
    name: string;
    start_time: string;
    end_time: string;
  };
}

interface AttendanceRecord {
  id: string;
  attendance_date: string;
  clock_in_time: string;
  clock_out_time: string;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  minutes_late: number;
  status: string;
  shift_name: string;
}

export default function TimeTracking() {
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState('');

  useEffect(() => {
    loadStatus();
    loadRecentRecords();

    // Update clock every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Get location if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLocation(`${position.coords.latitude},${position.coords.longitude}`);
      });
    }

    return () => clearInterval(timer);
  }, []);

  const loadStatus = async () => {
    try {
      const response = await api.get('/time-attendance/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  };

  const loadRecentRecords = async () => {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);

      const response = await api.get('/time-attendance/attendance/current', {
        params: {
          date_from: dateFrom.toISOString().split('T')[0],
          date_to: new Date().toISOString().split('T')[0],
        },
      });
      setRecentRecords(response.data);
    } catch (error) {
      console.error('Failed to load records:', error);
    }
  };

  const handleClockIn = async () => {
    setLoading(true);
    try {
      await api.post('/time-attendance/clock-in', {
        location,
        device_type: 'web',
      });
      await loadStatus();
      await loadRecentRecords();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to clock in');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      await api.post('/time-attendance/clock-out', {
        location,
      });
      await loadStatus();
      await loadRecentRecords();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to clock out');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
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

  const calculateWorkingTime = () => {
    if (!status?.is_clocked_in || !status.clock_in_time) return '00:00:00';

    const clockIn = new Date(status.clock_in_time);
    const diff = currentTime.getTime() - clockIn.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Time Tracking</h1>
        <p className="text-gray-600 mt-1">Clock in and out, view your attendance</p>
      </div>

      {/* Current Time */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm mb-2">Current Time</p>
            <h2 className="text-5xl font-bold">
              {currentTime.toLocaleTimeString('en-ZA', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </h2>
            <p className="text-blue-100 mt-2">
              {currentTime.toLocaleDateString('en-ZA', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Clock In/Out Button */}
          <div className="text-center">
            {status?.is_clocked_in ? (
              <div>
                <div className="bg-white bg-opacity-20 rounded-lg p-6 mb-4">
                  <p className="text-sm text-blue-100 mb-2">Working Time</p>
                  <p className="text-4xl font-bold">{calculateWorkingTime()}</p>
                </div>
                <button
                  onClick={handleClockOut}
                  disabled={loading}
                  className="w-full px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-lg transition-colors disabled:bg-gray-400 text-lg"
                >
                  {loading ? 'Clocking Out...' : 'Clock Out'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleClockIn}
                disabled={loading}
                className="px-12 py-6 bg-white hover:bg-gray-50 text-blue-600 font-bold rounded-lg shadow-xl transition-colors disabled:bg-gray-200 text-xl"
              >
                {loading ? 'Clocking In...' : 'Clock In'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Today's Status */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">Clock In</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.is_clocked_in ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {status.is_clocked_in ? 'Clocked In' : 'Not Clocked In'}
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {status.clock_in_time ? formatTime(status.clock_in_time) : '--:--'}
            </p>
            {status.minutes_late > 0 && (
              <p className="text-sm text-yellow-600 mt-2">
                Late by {status.minutes_late} minutes
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="font-semibold text-gray-700 mb-4">Clock Out</h3>
            <p className="text-3xl font-bold text-gray-900">
              {status.clock_out_time ? formatTime(status.clock_out_time) : '--:--'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="font-semibold text-gray-700 mb-4">Total Hours</h3>
            <p className="text-3xl font-bold text-gray-900">
              {status.total_hours ? status.total_hours.toFixed(2) : '0.00'}
            </p>
            <p className="text-sm text-gray-500 mt-2">hours today</p>
          </div>
        </div>
      )}

      {/* Assigned Shift */}
      {status?.shift && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Your Shift Today</h3>
          <p className="text-gray-700">
            <span className="font-medium">{status.shift.name}</span> - {status.shift.start_time} to {status.shift.end_time}
          </p>
        </div>
      )}

      {/* Recent Attendance */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Attendance (Last 30 Days)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overtime</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No attendance records found
                  </td>
                </tr>
              ) : (
                recentRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(record.attendance_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {record.shift_name || '-'}
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
                        {record.minutes_late > 0 && ` (${record.minutes_late}m late)`}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
