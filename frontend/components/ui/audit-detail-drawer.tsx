'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Clock, User, Target, Shield, Globe, Monitor, Hash } from 'lucide-react';
import { AuditLog, getAuditLog } from '@/lib/api-audit';
import JsonViewer from './json-viewer';

interface AuditDetailDrawerProps {
  logId: string | null;
  onClose: () => void;
}

export default function AuditDetailDrawer({ logId, onClose }: AuditDetailDrawerProps) {
  const [log, setLog] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!logId) {
      setLog(null);
      return;
    }

    setLoading(true);
    setError(null);

    getAuditLog(logId)
      .then(setLog)
      .catch((err) => setError(err?.response?.data?.message || 'Failed to load audit event'))
      .finally(() => setLoading(false));
  }, [logId]);

  // Click outside to close
  useEffect(() => {
    if (!logId) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Escape key to close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [logId, onClose]);

  const isOpen = logId !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${
          isOpen ? 'bg-opacity-30 pointer-events-auto' : 'bg-opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out w-full sm:w-[480px] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Audit Event Detail</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-200 transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-64px)] px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Loading...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          {log && !loading && (
            <div className="space-y-5">
              {/* Event ID */}
              <DetailRow icon={Hash} label="Event ID" value={log.id} mono />

              {/* Timestamp */}
              <DetailRow
                icon={Clock}
                label="Timestamp"
                value={new Date(log.createdAt).toLocaleString()}
              />

              {/* Actor */}
              <DetailRow
                icon={User}
                label="Actor"
                value={
                  log.actor
                    ? `${log.actor.firstName} ${log.actor.lastName} (${log.actor.email})`
                    : log.actorUserId || 'SYSTEM'
                }
              />

              {/* Action */}
              <DetailRow icon={Shield} label="Action">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-indigo-100 text-indigo-800">
                  {log.action}
                </span>
              </DetailRow>

              {/* Target */}
              <DetailRow icon={Target} label="Target Type" value={log.targetType} />
              <DetailRow icon={Target} label="Target ID" value={log.targetId || 'N/A'} mono />

              {/* Result */}
              <DetailRow icon={Shield} label="Result">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    log.result === 'success'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {log.result === 'success' ? '✓ Success' : '✗ Failed'}
                </span>
              </DetailRow>

              {/* IP & User Agent */}
              <DetailRow
                icon={Globe}
                label="IP Address"
                value={log.ipAddress || 'N/A'}
                mono
              />
              <DetailRow
                icon={Monitor}
                label="User Agent"
                value={log.userAgent || 'N/A'}
                small
              />

              {/* Divider */}
              <hr className="border-gray-200" />

              {/* Before / After */}
              <div className="space-y-3">
                <JsonViewer data={log.before} label="Before" />
                <JsonViewer data={log.after} label="After" />
              </div>

              {/* Metadata */}
              {log.metadata != null ? (
                <>
                  <hr className="border-gray-200" />
                  <JsonViewer data={log.metadata} label="Metadata" />
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Detail Row component
// ---------------------------------------------------------------------------

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
  small,
  children,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  mono?: boolean;
  small?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
          {label}
        </div>
        {children || (
          <div
            className={`text-sm text-gray-900 break-all ${mono ? 'font-mono' : ''} ${
              small ? 'text-xs text-gray-600' : ''
            }`}
          >
            {value}
          </div>
        )}
      </div>
    </div>
  );
}
