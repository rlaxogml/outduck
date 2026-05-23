"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

interface UseImageUploadParams {
  bucket?: string;
  folderPath?: string; // e.g. "event-main-image" or "channel-requests"
  initialUrl?: string | null;
  initialPath?: string | null;
  successMessage?: string;
  prefix?: string; // e.g. "request-" or ""
  delayDelete?: boolean;
}

export function useImageUpload({
  bucket = "event_images",
  folderPath = "event-main-image",
  initialUrl = null,
  initialPath = null,
  successMessage = "이미지가 업로드되었습니다.",
  prefix = "",
  delayDelete = false,
}: UseImageUploadParams = {}) {
  const [imageUrl, setImageUrl] = useState<string | null>(initialUrl);
  const [imagePath, setImagePath] = useState<string | null>(initialPath);
  const [isUploading, setIsUploading] = useState(false);
  const [deletedPaths, setDeletedPaths] = useState<string[]>([]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드 가능합니다.");
      return;
    }

    setIsUploading(true);
    try {
      // Clean up previous image if exists
      if (imagePath) {
        if (delayDelete) {
          setDeletedPaths(prev => [...prev, imagePath]);
        } else {
          const { error: delErr } = await supabase.storage.from(bucket).remove([imagePath]);
          if (delErr) {
            console.error("Failed to delete previous image from storage:", delErr);
          }
        }
      }

      const fileExt = file.name.split(".").pop();
      const randomPart = Math.random().toString(36).substring(2);
      const fileName = `${prefix}${randomPart}-${Date.now()}.${fileExt}`;
      const filePath = `${folderPath}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      setImagePath(filePath);
      toast.success(successMessage);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("이미지 업로드에 실패했습니다: " + (error.message || "알 수 없는 오류"));
    } finally {
      setIsUploading(false);
    }
  };

  const clearImage = async () => {
    if (imagePath) {
      if (delayDelete) {
        setDeletedPaths(prev => [...prev, imagePath]);
      } else {
        try {
          const { error: delErr } = await supabase.storage.from(bucket).remove([imagePath]);
          if (delErr) {
            console.error("Error removing file:", delErr);
            toast.error("이미지 삭제 실패: " + delErr.message);
          }
        } catch (err) {
          console.error("Error removing file:", err);
        }
      }
    }
    setImageUrl(null);
    setImagePath(null);
  };

  return {
    imageUrl,
    setImageUrl,
    imagePath,
    setImagePath,
    isUploading,
    handleImageUpload,
    clearImage,
    deletedPaths,
    setDeletedPaths,
  };
}
