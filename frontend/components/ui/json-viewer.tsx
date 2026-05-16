'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

/**
 * Sensitive field names for defense-in-depth UI masking.
 * Primary redaction happens server-side — this is a safety net.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'secret',
  'apikey',
  'refreshtoken',
  'accesstoken',
  'privatekey',
]);

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

interface JsonNodeProps {
  keyName?: string;
  value: unknown;
  depth: number;
  defaultExpanded?: boolean;
}

function JsonNode({ keyName, value, depth, defaultExpanded = true }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded && depth < 2);

  // Sensitive field — show redacted
  if (keyName && isSensitiveKey(keyName) && typeof value === 'string') {
    return (
      <div className="flex items-start" style={{ paddingLeft: `${depth * 16}px` }}>
        <span className="text-purple-600 font-medium text-xs">&quot;{keyName}&quot;</span>
        <span className="text-gray-400 text-xs mx-1">:</span>
        <span className="text-red-500 font-mono text-xs bg-red-50 px-1 rounded">
          &quot;***REDACTED***&quot;
        </span>
      </div>
    );
  }

  // Null
  if (value === null || value === undefined) {
    return (
      <div className="flex items-start" style={{ paddingLeft: `${depth * 16}px` }}>
        {keyName && (
          <>
            <span className="text-purple-600 font-medium text-xs">&quot;{keyName}&quot;</span>
            <span className="text-gray-400 text-xs mx-1">:</span>
          </>
        )}
        <span className="text-gray-400 italic text-xs">null</span>
      </div>
    );
  }

  // Primitive values
  if (typeof value !== 'object') {
    const valueClass =
      typeof value === 'string'
        ? 'text-green-700'
        : typeof value === 'number'
          ? 'text-blue-600'
          : typeof value === 'boolean'
            ? 'text-amber-600'
            : 'text-gray-700';

    const displayValue =
      typeof value === 'string' ? `"${value}"` : String(value);

    return (
      <div className="flex items-start" style={{ paddingLeft: `${depth * 16}px` }}>
        {keyName && (
          <>
            <span className="text-purple-600 font-medium text-xs">&quot;{keyName}&quot;</span>
            <span className="text-gray-400 text-xs mx-1">:</span>
          </>
        )}
        <span className={`font-mono text-xs ${valueClass}`}>{displayValue}</span>
      </div>
    );
  }

  // Arrays and Objects
  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);

  const bracketOpen = isArray ? '[' : '{';
  const bracketClose = isArray ? ']' : '}';

  if (entries.length === 0) {
    return (
      <div className="flex items-start" style={{ paddingLeft: `${depth * 16}px` }}>
        {keyName && (
          <>
            <span className="text-purple-600 font-medium text-xs">&quot;{keyName}&quot;</span>
            <span className="text-gray-400 text-xs mx-1">:</span>
          </>
        )}
        <span className="text-gray-500 font-mono text-xs">
          {bracketOpen}{bracketClose}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center cursor-pointer hover:bg-gray-50 rounded"
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
        )}
        {keyName && (
          <>
            <span className="text-purple-600 font-medium text-xs ml-1">&quot;{keyName}&quot;</span>
            <span className="text-gray-400 text-xs mx-1">:</span>
          </>
        )}
        <span className="text-gray-500 font-mono text-xs">
          {bracketOpen}
          {!expanded && (
            <span className="text-gray-400 ml-1">
              {entries.length} {entries.length === 1 ? 'item' : 'items'}
            </span>
          )}
          {!expanded && bracketClose}
        </span>
      </div>
      {expanded && (
        <>
          {entries.map(([k, v]) => (
            <JsonNode
              key={k}
              keyName={isArray ? undefined : k}
              value={v}
              depth={depth + 1}
              defaultExpanded={depth < 1}
            />
          ))}
          <div
            className="text-gray-500 font-mono text-xs"
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            {bracketClose}
          </div>
        </>
      )}
    </div>
  );
}

interface JsonViewerProps {
  data: unknown;
  label?: string;
}

export default function JsonViewer({ data, label }: JsonViewerProps) {
  if (data === null || data === undefined) {
    return (
      <div className="text-sm text-gray-400 italic py-2">
        {label ? `No ${label.toLowerCase()} data` : 'No data'}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono text-xs overflow-auto max-h-64">
      {label && (
        <div className="text-xs font-semibold text-gray-600 mb-2 font-sans uppercase tracking-wide">
          {label}
        </div>
      )}
      <JsonNode value={data} depth={0} />
    </div>
  );
}
