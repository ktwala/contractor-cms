import React from 'react';
import { Play } from 'lucide-react';
import * as styles from '../../../../styles/common';
import { Card } from '../../../../ui/layout';

interface FilterValue {
  basisMode: 'LAST_CLOSED_PAYRUN' | 'PAYRUN_ID';
  payGroupId: string;
  payrunId: string;
  limit: number;
  affectedOnly: boolean;
  minAbsoluteDelta: number;
}

interface Props {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  payGroups: Array<{ id: string; name: string; code: string }>;
  onRun: () => void;
  loading: boolean;
}

export function ImpactAnalysisFilters({ value, onChange, payGroups, onRun, loading }: Props) {
  function set<K extends keyof FilterValue>(key: K, val: FilterValue[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <Card>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={styles.formLabel}>Basis Mode</label>
          <select
            style={{ ...styles.formSelect, width: 180 }}
            value={value.basisMode}
            onChange={(e) => set('basisMode', e.target.value as any)}
          >
            <option value="LAST_CLOSED_PAYRUN">Last Closed Payrun</option>
            <option value="PAYRUN_ID">Specific Payrun</option>
          </select>
        </div>

        {value.basisMode === 'LAST_CLOSED_PAYRUN' ? (
          <div>
            <label style={styles.formLabel}>Pay Group</label>
            <select
              style={{ ...styles.formSelect, width: 200 }}
              value={value.payGroupId}
              onChange={(e) => set('payGroupId', e.target.value)}
            >
              <option value="">Select…</option>
              {payGroups.map((pg) => (
                <option key={pg.id} value={pg.id}>
                  {pg.name} ({pg.code})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label style={styles.formLabel}>Payrun ID</label>
            <input
              type="text"
              style={{ ...styles.formInput, width: 240 }}
              placeholder="Enter payrun UUID"
              value={value.payrunId}
              onChange={(e) => set('payrunId', e.target.value)}
            />
          </div>
        )}

        <div>
          <label style={styles.formLabel}>Limit</label>
          <input
            type="number"
            style={{ ...styles.formInput, width: 80 }}
            value={value.limit}
            onChange={(e) => set('limit', Number(e.target.value) || 400)}
          />
        </div>

        <div>
          <label style={styles.formLabel}>Min Delta</label>
          <input
            type="number"
            style={{ ...styles.formInput, width: 80 }}
            value={value.minAbsoluteDelta}
            onChange={(e) => set('minAbsoluteDelta', Number(e.target.value) || 0)}
          />
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: '#64748b',
            cursor: 'pointer',
            paddingBottom: 8,
          }}
        >
          <input
            type="checkbox"
            checked={value.affectedOnly}
            onChange={(e) => set('affectedOnly', e.target.checked)}
          />
          Affected only
        </label>

        <button
          style={{
            ...styles.buttonPrimary,
            padding: '8px 20px',
            opacity: loading ? 0.5 : 1,
          }}
          onClick={onRun}
          disabled={loading}
        >
          <Play size={14} /> {loading ? 'Analyzing…' : 'Run Analysis'}
        </button>
      </div>
    </Card>
  );
}
