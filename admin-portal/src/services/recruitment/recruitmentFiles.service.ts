import api from '../api';

export type RecruitmentUploadResult = {
  stored_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
};

export const recruitmentFilesService = {
  upload: async (file: File): Promise<RecruitmentUploadResult> => {
    const body = new FormData();
    body.append('file', file);
    const res = await api.post<RecruitmentUploadResult>('/api/recruitment/files/upload', body, {
      maxContentLength: 20 * 1024 * 1024,
      maxBodyLength: 20 * 1024 * 1024,
    });
    return res.data;
  },
};
