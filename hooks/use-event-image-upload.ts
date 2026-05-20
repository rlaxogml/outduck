"use client";

import { useImageUpload } from "./use-image-upload";

interface UseEventImageUploadParams {
  initialUrl?: string | null;
  initialPath?: string | null;
}

export function useEventImageUpload({
  initialUrl = null,
  initialPath = null,
}: UseEventImageUploadParams = {}) {
  return useImageUpload({
    bucket: "event_images",
    folderPath: "event-covers",
    initialUrl,
    initialPath,
    successMessage: "이미지가 업로드되었습니다.",
  });
}
