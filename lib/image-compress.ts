// 업로드 전 클라이언트에서 이미지를 리사이즈/압축한다.
// - 저장 원본 자체를 줄여 스토리지 + CDN egress를 절감한다.
// - canvas 기반이라 별도 의존성이 없다.
// - 애니메이션(gif/webp)·svg 등 손상 위험이 있는 포맷은 원본 그대로 둔다.

export interface CompressOptions {
  /** 가로/세로 중 긴 변의 최대 픽셀 (기본 1600) */
  maxSize?: number;
  /** 0~1 품질 (기본 0.82) */
  quality?: number;
  /** 이 바이트 미만이면 압축 생략 (기본 60KB) */
  skipUnderBytes?: number;
}

const PASSTHROUGH_TYPES = new Set([
  "image/gif",
  "image/svg+xml",
  "image/apng",
]);

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * 이미지 File을 리사이즈 + WebP 재인코딩하여 새 File로 반환한다.
 * 압축이 불가능하거나 이득이 없으면 원본 File을 그대로 반환한다(안전 폴백).
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<File> {
  const { maxSize = 1600, quality = 0.82, skipUnderBytes = 60 * 1024 } = opts;

  if (!isBrowser()) return file;
  if (!file.type.startsWith("image/")) return file;
  if (PASSTHROUGH_TYPES.has(file.type)) return file;
  if (file.size <= skipUnderBytes) return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    const blob = await canvasToBlob(canvas, "image/webp", quality);
    if (!blob) return file;

    // 압축 결과가 원본보다 크면(이미 잘 압축된 원본 등) 원본 유지
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], newName, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn("compressImage 실패, 원본 업로드로 폴백:", err);
    return file;
  }
}

async function loadBitmap(
  file: File
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // 일부 브라우저/포맷에서 실패 시 <img> 폴백
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
