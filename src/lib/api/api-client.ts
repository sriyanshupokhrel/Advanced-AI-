import type { ApiErrorBody, CvImageDto, CvInput, CvProfileDto } from "@/types/cv";
import type { ImageUpdateInput } from "@/lib/validation/image-schema";
import type { TargetConfirmationInput } from "@/lib/validation/job-schema";
import type { CvJobTargetDto, JobDescriptionDto, JobDescriptionInput } from "@/types/job";

/** Browser-side wrapper around the app's API. Never throws; returns a result. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: ApiErrorBody };

async function request<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return {
      ok: false,
      status: 0,
      error: { error: "Could not reach the server. Check that the app is running and try again." },
    };
  }

  if (response.ok) {
    const data = response.status === 204 ? undefined : await response.json();
    return { ok: true, data: data as T };
  }

  const error: ApiErrorBody = await response
    .json()
    .catch(() => ({ error: `Request failed (HTTP ${response.status}).` }));
  return { ok: false, status: response.status, error };
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const cvApi = {
  create: (input: CvInput) => request<CvProfileDto>("/api/cvs", jsonInit("POST", input)),
  update: (id: string, input: CvInput) =>
    request<CvProfileDto>(`/api/cvs/${encodeURIComponent(id)}`, jsonInit("PUT", input)),
  remove: (id: string) => request<void>(`/api/cvs/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

const imagePath = (cvId: string, imageId?: string) =>
  `/api/cvs/${encodeURIComponent(cvId)}/images${imageId ? `/${encodeURIComponent(imageId)}` : ""}`;

/** All image calls name the CV, so the server can reject cross-CV access. */
export const imageApi = {
  upload: (cvId: string, form: FormData) => request<CvImageDto>(imagePath(cvId), { method: "POST", body: form }),
  update: (cvId: string, imageId: string, changes: ImageUpdateInput) =>
    request<CvImageDto>(imagePath(cvId, imageId), jsonInit("PATCH", changes)),
  replaceFile: (cvId: string, imageId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<CvImageDto>(imagePath(cvId, imageId), { method: "PUT", body: form });
  },
  remove: (cvId: string, imageId: string) => request<void>(imagePath(cvId, imageId), { method: "DELETE" }),
};

export const jobApi = {
  create: (input: JobDescriptionInput) =>
    request<JobDescriptionDto>("/api/jobs", jsonInit("POST", input)),
  update: (id: string, input: JobDescriptionInput) =>
    request<JobDescriptionDto>(`/api/jobs/${encodeURIComponent(id)}`, jsonInit("PUT", input)),
  remove: (id: string) => request<void>(`/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const targetApi = {
  create: (cvProfileId: string, jobDescriptionId: string) =>
    request<CvJobTargetDto>("/api/targets", jsonInit("POST", { cvProfileId, jobDescriptionId })),
  /** Confirm or withdraw sections; omit `sections` for all seven. */
  setConfirmation: (id: string, input: TargetConfirmationInput) =>
    request<CvJobTargetDto>(`/api/targets/${encodeURIComponent(id)}`, jsonInit("PATCH", input)),
  remove: (id: string) => request<void>(`/api/targets/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
