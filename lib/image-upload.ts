import { supabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { toast } from "sonner";

export async function uploadBase64Images(htmlContent: string): Promise<string> {
  if (!htmlContent || !htmlContent.includes("data:image/")) return htmlContent;
  
  let updatedHtml = htmlContent;
  
  // Find all image tags with base64 sources
  const imgRegex = /<img[^>]+src=["'](data:(image\/[a-zA-Z]*);base64,([^"']+))["'][^>]*>/g;
  const matches: { fullMatch: string; dataUrl: string; mimeType: string; base64Data: string }[] = [];
  let match;
  
  // Reset regex
  imgRegex.lastIndex = 0;
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    matches.push({
      fullMatch: match[0],
      dataUrl: match[1],
      mimeType: match[2],
      base64Data: match[3]
    });
  }
  
  if (matches.length === 0) return htmlContent;
  
  const toastId = toast.loading(`${matches.length}개의 붙여넣은 이미지를 업로드 중입니다...`);
  
  try {
    for (const item of matches) {
      try {
        // Decode base64 to binary
        const base64DataClean = item.base64Data.replace(/\s/g, '');
        const byteCharacters = atob(base64DataClean);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: item.mimeType });
        
        const fileExt = item.mimeType.split("/")[1] || "png";
        const tmpName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const compressed = await compressImage(
          new File([blob], tmpName, { type: item.mimeType })
        );
        const fileName = compressed.name;
        const filePath = `description/${fileName}`;

        const { data, error } = await supabase.storage
          .from('event_images')
          .upload(filePath, compressed, {
            contentType: compressed.type
          });
          
        if (error) {
          console.error("Supabase base64 image upload error:", error);
          continue;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('event_images')
          .getPublicUrl(filePath);
          
        // Replace the base64 URL with the public Supabase storage URL
        updatedHtml = updatedHtml.replace(item.dataUrl, publicUrl);
      } catch (uploadErr) {
        console.error("Failed to process single base64 image:", uploadErr);
      }
    }
    toast.success("붙여넣은 이미지가 성공적으로 업로드되었습니다.", { id: toastId });
  } catch (err) {
    console.error("Failed to upload base64 images:", err);
    toast.error("이미지 업로드 중 오류가 발생했습니다.", { id: toastId });
  }
  
  return updatedHtml;
}
