import { useEffect, useCallback, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Stack, ui } from '../ui/layout';
import { ForbiddenEmptyState } from '../ui/empty-states';
import { useAccess } from '../hooks/useAccess';
import WizardStepper, { STEP_ORDER, type WizardStep } from '../components/data-import-wizard/WizardStepper';
import HelpPanel from '../components/data-import-wizard/HelpPanel';
import DatasetSelectStep from '../components/data-import-wizard/DatasetSelectStep';
import TemplateStep from '../components/data-import-wizard/TemplateStep';
import UploadStep from '../components/data-import-wizard/UploadStep';
import ValidateStep from '../components/data-import-wizard/ValidateStep';
import ReviewApproveStep from '../components/data-import-wizard/ReviewApproveStep';
import PublishStep from '../components/data-import-wizard/PublishStep';

type DatasetType = 'EMPLOYEES' | 'EMPLOYMENTS' | 'MANAGER_RELATIONSHIPS';

const DATASET_RULES: Record<DatasetType, string[]> = {
  EMPLOYEES: ['employee_no must be unique', 'first_name and last_name required'],
  EMPLOYMENTS: ['employee_no must exist', 'legal_entity_code and pay_group_code must exist', 'hire_date and employment_status required'],
  MANAGER_RELATIONSHIPS: ['employee_no must exist', 'manager_employee_no must exist when provided', 'no self-manager', 'no circular hierarchy'],
};

export default function DataImportWizard() {
  const { canAny } = useAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const canUseWizard = canAny(['data_import:write', 'data_import:approve', 'data_import:publish', 'iam:legal_entities:manage']);

  const [step, setStep] = useState<WizardStep>('SELECT_DATASET');
  const [dataset, setDataset] = useState<DatasetType | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [employmentsReady, setEmploymentsReady] = useState(false);
  const [managersReady, setManagersReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'success' | 'failed'>('idle');
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorRowsPreview, setErrorRowsPreview] = useState<Array<{ rowNumber: number; message: string }>>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [validationPhase, setValidationPhase] = useState<string>('');
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [pipelineProgress, setPipelineProgress] = useState<number | null>(null);

  const loadPrerequisites = useCallback(async () => {
    try {
      const [empRes, mgrRes] = await Promise.all([
        api.get('/api/enterprise/data-imports/wizard/prerequisites', {
          params: { dataset: 'EMPLOYMENTS' },
        }),
        api.get('/api/enterprise/data-imports/wizard/prerequisites', {
          params: { dataset: 'MANAGER_RELATIONSHIPS' },
        }),
      ]);
      setEmploymentsReady(empRes.data?.ready ?? false);
      setManagersReady(mgrRes.data?.ready ?? false);
    } catch {
      setEmploymentsReady(false);
      setManagersReady(false);
    }
  }, []);

  useEffect(() => {
    void loadPrerequisites();
  }, [loadPrerequisites]);

  useEffect(() => {
    const state = location.state as { startFresh?: boolean } | null;
    if (state?.startFresh) {
      setStep('SELECT_DATASET');
      setDataset(null);
      setJobId(null);
      setFileName(null);
      setFile(null);
      setJob(null);
      setPublishStatus('idle');
      setErrorMessage(null);
      setErrorRowsPreview([]);
      setDetectedColumns([]);
      navigate('/enterprise/data-imports/wizard', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (step !== 'VALIDATE' || !jobId) return;
    const status = (job as { status?: string })?.status;
    if (status === 'VALIDATED' || status === 'HAS_ERRORS') {
      setValidating(false);
      return;
    }
    let cancelled = false;
    setValidating(true);
    setPipelineProgress(null);
    setValidationPhase('Enqueuing validation...');

    (async () => {
      try {
        await api.post(`/api/enterprise/data-imports/${jobId}/validate?mode=pipeline`);
        if (cancelled) return;
        setValidationPhase('Validating rows...');

        while (!cancelled) {
          await new Promise((r) => setTimeout(r, 1500));
          if (cancelled) break;

          const statusRes = await api.get(`/api/enterprise/data-imports/${jobId}/status`);
          const ps = statusRes.data as {
            status: string;
            stage: string;
            progress_pct: number;
            rows_total: number;
            rows_processed: number;
            rows_valid: number;
            rows_invalid: number;
            summary: unknown;
          };

          setPipelineProgress(ps.progress_pct);

          if (ps.stage === 'validating') {
            setValidationPhase(`Validating rows... ${ps.rows_processed}/${ps.rows_total}`);
          }

          if (ps.status === 'VALIDATED' || ps.status === 'HAS_ERRORS' || ps.status === 'FAILED') {
            const jobRes = await api.get(`/api/enterprise/data-imports/${jobId}`);
            if (cancelled) break;
            setJob(jobRes.data);

            const [invalidRes, firstRowRes] = await Promise.all([
              api.get(`/api/enterprise/data-imports/${jobId}/rows`, { params: { status: 'INVALID' } }),
              api.get(`/api/enterprise/data-imports/${jobId}/rows`, { params: { limit: 1 } }),
            ]);
            const invalidItems = invalidRes.data?.items ?? invalidRes.data ?? [];
            const invalidRows = Array.isArray(invalidItems) ? invalidItems : [];
            setErrorRowsPreview(
              invalidRows.slice(0, 10).map((r: { rowNumber: number; errors?: Array<{ message: string }> }) => ({
                rowNumber: r.rowNumber,
                message: r.errors?.[0]?.message ?? 'Validation error',
              }))
            );
            const firstItems = firstRowRes.data?.items ?? firstRowRes.data ?? [];
            const firstRow = Array.isArray(firstItems) ? firstItems[0] : null;
            const payload = firstRow?.payloadJson as Record<string, unknown> | undefined;
            setDetectedColumns(payload ? Object.keys(payload) : []);

            setValidating(false);
            setPipelineProgress(100);
            setValidationPhase('');
            break;
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setValidating(false);
          setPipelineProgress(null);
          setValidationPhase('');
          const err = e as { response?: { data?: { message?: string } } };
          setErrorMessage(err?.response?.data?.message ?? 'Validation failed.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [step, jobId, job?.status, dataset]);

  const completedSteps = new Set<WizardStep>(
    STEP_ORDER.slice(0, STEP_ORDER.indexOf(step))
  );
  const blockedSteps = new Set<WizardStep>();

  const handleSelectDataset = (ds: DatasetType) => {
    setDataset(ds);
    setStep('DOWNLOAD_TEMPLATE');
    setJobId(null);
    setFileName(null);
    setFile(null);
    setJob(null);
    setPublishStatus('idle');
    setErrorMessage(null);
  };

  const handleReupload = () => {
    setStep('UPLOAD_FILE');
    setJobId(null);
    setFileName(null);
    setFile(null);
    setJob(null);
    setErrorMessage(null);
  };

  const handleUpload = async () => {
    if (!file || !dataset) return;
    setUploading(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dataset_type', dataset);
      const res = await api.post('/api/enterprise/data-imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data;
      setJobId(data?.id);
      setFileName(data?.fileName ?? file.name);
      setJob(data);
      setRowCount((data as { rowCount?: number })?.rowCount ?? null);
      setStep('VALIDATE');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setErrorMessage(err?.response?.data?.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleValidateContinue = () => {
    const summary = (job?.summaryJson as Record<string, number>) ?? {};
    const errCount = summary.errors ?? summary.error_rows ?? summary.invalid_rows ?? 0;
    if (errCount > 0) return;
    setStep('REVIEW_APPROVE');
  };

  const handleApprove = async () => {
    if (!jobId) return;
    setApproving(true);
    setErrorMessage(null);
    try {
      await api.post(`/api/enterprise/data-imports/${jobId}/approve`);
      setStep('PUBLISH');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setErrorMessage(err?.response?.data?.message ?? 'Approval failed.');
    } finally {
      setApproving(false);
    }
  };

  const handlePublish = async () => {
    if (!jobId) return;
    setPublishStatus('publishing');
    setErrorMessage(null);
    setPipelineProgress(0);
    try {
      await api.post(`/api/enterprise/data-imports/${jobId}/publish?mode=pipeline`);

      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 1500));
        const statusRes = await api.get(`/api/enterprise/data-imports/${jobId}/status`);
        const ps = statusRes.data as { status: string; progress_pct: number };
        setPipelineProgress(ps.progress_pct);

        if (ps.status === 'PUBLISHED') {
          const jobRes = await api.get(`/api/enterprise/data-imports/${jobId}`);
          setJob(jobRes.data);
          setPublishStatus('success');
          setEmploymentsReady(true);
          if (dataset === 'MANAGER_RELATIONSHIPS') {
            setManagersReady(true);
          }
          done = true;
        } else if (ps.status === 'FAILED') {
          setPublishStatus('failed');
          done = true;
        }
      }
    } catch {
      setPublishStatus('failed');
    } finally {
      setPipelineProgress(null);
    }
  };

  const handleExportErrors = async (format: 'csv' | 'xlsx') => {
    if (!jobId) return;
    setExporting(true);
    try {
      const res = await api.get(`/api/enterprise/data-imports/${jobId}/export-errors`, {
        params: { format },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `validation-errors-${jobId}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMessage('Failed to export.');
    } finally {
      setExporting(false);
    }
  };

  if (!canUseWizard) {
    return (
      <Page title="Data Import Wizard" subtitle="Guided onboarding for workforce data.">
        <ForbiddenEmptyState
          feature="Data Import Wizard"
          description="You need data import permissions to use the wizard."
        />
      </Page>
    );
  }

  const summary = (job?.summaryJson as Record<string, number>) ?? {};
  const rawPublish = job?.publishSummaryJson as { created?: number; updated?: number; skipped?: number } | undefined;
  const publishSummary = rawPublish
    ? {
        created: rawPublish.created ?? 0,
        updated: rawPublish.updated ?? 0,
        skipped: rawPublish.skipped ?? 0,
      }
    : undefined;

  return (
    <Page
      title="Data Import Wizard"
      subtitle="Import workforce data into Hubsec Workforce Platform using guided validation, approval, and publish steps."
      actions={
        <Link to="/enterprise/data-imports" style={{ ...styles.buttonSecondary, textDecoration: 'none' }}>
          Data Imports Console
        </Link>
      }
    >
      <Stack gap={ui.space.lg}>
        <WizardStepper
          currentStep={step}
          completedSteps={completedSteps}
          blockedSteps={blockedSteps}
        />

        {errorMessage && (
          <div
            style={{
              padding: 12,
              background: '#fef2f2',
              borderLeft: `4px solid ${styles.colors.danger}`,
              borderRadius: 8,
              color: '#991b1b',
              fontSize: 13,
            }}
          >
            {errorMessage}
          </div>
        )}

        <div style={{ display: 'flex', gap: ui.space.xl, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {step === 'SELECT_DATASET' && (
              <DatasetSelectStep onSelect={handleSelectDataset} employmentsReady={employmentsReady} managersReady={managersReady} />
            )}
            {step === 'DOWNLOAD_TEMPLATE' && dataset && (
              <TemplateStep
                dataset={dataset}
                onBack={() => setStep('SELECT_DATASET')}
                onContinue={() => setStep('UPLOAD_FILE')}
              />
            )}
            {step === 'UPLOAD_FILE' && dataset && (
              <UploadStep
                dataset={dataset}
                file={file}
                onFileSelect={setFile}
                onClear={() => setFile(null)}
                onBack={() => setStep('DOWNLOAD_TEMPLATE')}
                onUpload={() => void handleUpload()}
                uploading={uploading}
              />
            )}
            {step === 'VALIDATE' && jobId && fileName && dataset && (
              <ValidateStep
                fileName={fileName}
                dataset={dataset}
                rowCount={rowCount}
                validating={validating}
                validationPhase={validationPhase}
                pipelineProgress={pipelineProgress}
                detectedColumns={detectedColumns}
                summary={{
                  total_rows: summary.total_rows ?? 0,
                  valid_rows: summary.valid_rows ?? 0,
                  warning_rows: summary.warnings,
                  error_rows: summary.errors ?? summary.invalid_rows,
                }}
                errorRowsPreview={errorRowsPreview}
                onBack={() => setStep('UPLOAD_FILE')}
                onReupload={handleReupload}
                onContinue={handleValidateContinue}
                onExportErrors={handleExportErrors}
                exporting={exporting}
              />
            )}
            {step === 'REVIEW_APPROVE' && jobId && fileName && dataset && (
              <ReviewApproveStep
                dataset={dataset}
                fileName={fileName}
                uploadedBy={(job as { uploadedByUserId?: string })?.uploadedByUserId}
                uploadedAt={(job as { uploadedAt?: string })?.uploadedAt}
                summary={{
                  total_rows: summary.total_rows ?? 0,
                  valid_rows: summary.valid_rows ?? 0,
                  warning_rows: summary.warnings,
                  error_rows: summary.errors ?? summary.invalid_rows,
                }}
                onBack={() => setStep('VALIDATE')}
                onApprove={() => void handleApprove()}
                approving={approving}
              />
            )}
            {step === 'PUBLISH' && jobId && fileName && dataset && (
              <PublishStep
                dataset={dataset}
                fileName={fileName}
                status={publishStatus}
                publishSummary={publishSummary}
                pipelineProgress={pipelineProgress}
                onBack={() => setStep('REVIEW_APPROVE')}
                onPublish={() => void handlePublish()}
                onImportEmploymentsNext={() => navigate('/enterprise/data-imports/wizard', { state: { startFresh: true } })}
              />
            )}
          </div>
          <HelpPanel
            dataset={dataset}
            rules={dataset ? DATASET_RULES[dataset] : undefined}
          />
        </div>
      </Stack>

      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </Page>
  );
}
