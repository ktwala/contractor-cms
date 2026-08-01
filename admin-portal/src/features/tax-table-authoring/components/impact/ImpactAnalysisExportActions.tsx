import React, { useState } from 'react';
import { Download } from 'lucide-react';
import * as styles from '../../../../styles/common';
import { exportImpactAnalysisRunCsv } from '../../api';
import { downloadBlob } from '../../utils/downloadBlob';

interface Props {
  runId: string;
  countryCode: string;
}

export function ImpactAnalysisExportActions({ runId, countryCode }: Props) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportImpactAnalysisRunCsv(runId);
      downloadBlob(blob, `tax_table_impact_analysis_${countryCode}_${runId}.csv`);
    } catch {
      // toast or ignore
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      style={{
        ...styles.buttonSecondary,
        padding: '6px 14px',
        fontSize: 13,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        opacity: exporting ? 0.5 : 1,
      }}
    >
      <Download size={13} />
      {exporting ? 'Exporting…' : 'Export CSV'}
    </button>
  );
}
