"use client";

import { useImageUpload } from "./use-image-upload";

interface UseEventImageUploadParams {
  initialUrl?: string | null;
  initialPath?: string | null;
  delayDelete?: boolean;
}

export function useEventImageUpload({
  initialUrl = null,
  initialPath = null,
  delayDelete = false,
}: UseEventImageUploadParams = {}) {
  return useImageUpload({
    bucket: "event_images",
    folderPath: "event-main-image",
    initialUrl,
    initialPath,
    successMessage: "이미지가 업로드되었습니다.",
    delayDelete,
  });
}
