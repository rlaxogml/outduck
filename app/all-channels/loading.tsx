import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400" />
      <span className="mt-4 text-sm font-semibold text-muted-foreground">채널 목록을 불러오는 중...</span>
    </div>
  );
}
