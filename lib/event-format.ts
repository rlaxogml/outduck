// 행사 리스트 화면(찜/팔로우/홈 등)에서 공통으로 쓰는 포맷·가공 헬퍼.
// 여러 페이지에 흩어져 중복되던 로직을 한곳으로 모았다.

export const imageColors = [
  "bg-gradient-to-br from-indigo-400 to-indigo-600",
  "bg-gradient-to-br from-pink-400 to-pink-600",
  "bg-gradient-to-br from-green-400 to-green-600",
  "bg-gradient-to-br from-orange-400 to-orange-600",
  "bg-gradient-to-br from-purple-400 to-purple-600",
  "bg-gradient-to-br from-red-400 to-red-600",
];

export const formatEventDate = (start: string, end: string | null) => {
  if (!start) return "상시";
  const startPt = start.replaceAll("-", ".").split("T")[0];
  const endPt = end ? end.replaceAll("-", ".").split("T")[0] : null;
  if (startPt === endPt || !endPt) {
    const parts = startPt.split(".");
    if (parts.length === 3) {
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return `${month}월 ${day}일`;
    }
    return startPt;
  }
  return `${startPt} - ${endPt}`;
};

export const formatOnlineEventDate = (start: string | null, end: string | null) => {
  if (!start) return "상시";
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${month}.${day}`;
  };

  const startFormatted = formatDate(start);
  if (!end) {
    const d = new Date(start);
    if (!isNaN(d.getTime())) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    return startFormatted;
  }
  const endFormatted = formatDate(end);
  if (startFormatted === endFormatted) {
    const d = new Date(start);
    if (!isNaN(d.getTime())) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    return startFormatted;
  }
  return `${startFormatted} ~ ${endFormatted}`;
};

export const extractChannels = (eventChannels: any[]) => {
  return (eventChannels || [])
    .map((ec: any) => ec.channels)
    .filter(Boolean) as { id: number; name: string; type: string; image_url: string }[];
};

export const getCategory = (type?: string) => {
  if (!type) return "기타";
  const t = type.trim().toLowerCase();
  if (t === "game") return "게임";
  if (t === "youtuber") return "유튜버";
  if (t === "vtuber") return "버튜버";
  if (t === "festival") return "축제";
  return "기타";
};

export const dedupeById = <T extends { id: number }>(rows: T[]): T[] => {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const row of rows) {
    if (row && !seen.has(row.id)) {
      seen.add(row.id);
      out.push(row);
    }
  }
  return out;
};
