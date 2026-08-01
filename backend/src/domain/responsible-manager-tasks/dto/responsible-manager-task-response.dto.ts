import { ResponsibleManagerTaskStatus, ResponsibleManagerTaskType } from '@prisma/client';

export class ResponsibleManagerTaskResponseDto {
  id: string;
  organizationId: string;
  engagementId: string;
  contractorId: string;
  responsibleManagerEmployeeId: string;
  taskType: ResponsibleManagerTaskType;
  status: ResponsibleManagerTaskStatus;
  title: string;
  description?: string | null;
  dueAt?: Date | null;
  completedAt?: Date | null;
  outcome?: unknown;
  createdAt: Date;
  updatedAt: Date;
  engagement?: {
    id: string;
    role: string;
    responsibleManagerStatus?: string | null;
    contractor?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      accessIntent?: string | null;
    };
    contract?: {
      contractNumber: string;
      title: string;
    };
  };
}

export class PaginatedResponsibleManagerTaskResponseDto {
  data: ResponsibleManagerTaskResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
