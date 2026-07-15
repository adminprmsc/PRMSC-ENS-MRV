import api from "../api/api";
import type { UserRole } from "../constants/roles";

export type TrainingVideo = {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  sort_order: number;
  is_published: boolean;
  audience_roles: UserRole[];
  created_by_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CreateTrainingVideoPayload = {
  title: string;
  description?: string | null;
  youtube_url: string;
  sort_order?: number;
  is_published?: boolean;
  audience_roles?: UserRole[];
};

export type UpdateTrainingVideoPayload = Partial<CreateTrainingVideoPayload>;

export async function listTrainingVideos(includeUnpublished = false) {
  const { data } = await api.get<{ videos: TrainingVideo[] }>(
    "/training/videos",
    {
      params: includeUnpublished ? { include_unpublished: "1" } : undefined,
    },
  );
  return data.videos ?? [];
}

export async function createTrainingVideo(payload: CreateTrainingVideoPayload) {
  const { data } = await api.post<{ video: TrainingVideo }>(
    "/training/videos",
    payload,
  );
  return data.video;
}

export async function updateTrainingVideo(
  id: string,
  payload: UpdateTrainingVideoPayload,
) {
  const { data } = await api.patch<{ video: TrainingVideo }>(
    `/training/videos/${id}`,
    payload,
  );
  return data.video;
}

export async function deleteTrainingVideo(id: string) {
  await api.delete(`/training/videos/${id}`);
}

export type UploadProgress = {
  /** 0–100 */
  percent: number;
  loaded: number;
  total: number;
};

export async function uploadTrainingVideoFile(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<{
    video_url: string;
    object_key: string;
    bucket: string;
  }>("/training/videos/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    // ~200 MB uploads over slower links can take several minutes.
    timeout: 10 * 60 * 1000,
    onUploadProgress: (event) => {
      if (!onProgress) return;
      const total = event.total && event.total > 0 ? event.total : file.size;
      const loaded = event.loaded ?? 0;
      const percent =
        total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      onProgress({ percent, loaded, total });
    },
  });
  return data;
}
