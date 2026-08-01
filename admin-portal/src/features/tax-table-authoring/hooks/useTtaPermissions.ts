import { useAccess } from '../../../hooks/useAccess';
import { P } from '../../../constants/permissions';
import type { AuthoringVersion } from '../types';

export function useTtaPermissions() {
  const { can, permissions, role } = useAccess();

  const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null;

  const canCreate = can(P.TTA_CREATE);
  const canEdit = can(P.TTA_EDIT);
  /** Backend: validate + simulate use `tax_table_authoring_view`. */
  const canValidate = can(P.TTA_VIEW);
  const canSimulate = can(P.TTA_VIEW);
  const canSubmitApproval = can(P.TTA_SUBMIT_APPROVAL);
  const canApprove = can(P.TTA_APPROVE);
  const canPublish = can(P.TTA_PUBLISH);
  const canArchive = can(P.TTA_ARCHIVE);
  const canViewRuntime = can(P.TTA_VIEW);

  function canPerformAction(
    action: string,
    version?: AuthoringVersion | null,
  ): { allowed: boolean; reason?: string } {
    switch (action) {
      case 'edit':
        if (!canEdit) return { allowed: false, reason: 'You do not have edit permission' };
        if (version && version.status !== 'DRAFT')
          return { allowed: false, reason: 'Only drafts can be edited' };
        return { allowed: true };

      case 'validate':
        if (!canValidate) return { allowed: false, reason: 'You do not have validation permission' };
        if (version && version.status === 'PUBLISHED')
          return { allowed: false, reason: 'Published versions cannot be validated' };
        return { allowed: true };

      case 'simulate':
        if (!canSimulate) return { allowed: false, reason: 'You do not have simulation permission' };
        return { allowed: true };

      case 'submit_approval':
        if (!canSubmitApproval)
          return { allowed: false, reason: 'You do not have submission permission' };
        if (version && version.status !== 'DRAFT')
          return { allowed: false, reason: 'Only drafts can be submitted' };
        return { allowed: true };

      case 'approve':
        if (!canApprove) return { allowed: false, reason: 'You do not have approval permission' };
        if (version && version.status !== 'PENDING_APPROVAL')
          return { allowed: false, reason: 'Only pending versions can be approved' };
        if (version && userId && version.createdByUserId === userId)
          return { allowed: false, reason: 'You cannot approve your own draft (Segregation of Duties)' };
        return { allowed: true };

      case 'publish':
        if (!canPublish) return { allowed: false, reason: 'You do not have publish permission' };
        if (version && version.status !== 'APPROVED')
          return { allowed: false, reason: 'Only approved versions can be published' };
        return { allowed: true };

      case 'archive':
        if (!canArchive) return { allowed: false, reason: 'You do not have archive permission' };
        if (version && (version.status === 'PUBLISHED' || version.status === 'ARCHIVED'))
          return { allowed: false, reason: 'Cannot archive this version' };
        return { allowed: true };

      default:
        return { allowed: false, reason: 'Unknown action' };
    }
  }

  return {
    canCreate,
    canEdit,
    canValidate,
    canSimulate,
    canSubmitApproval,
    canApprove,
    canPublish,
    canArchive,
    canViewRuntime,
    canPerformAction,
    userId,
  };
}
