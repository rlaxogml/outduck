"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  User,
  Users,
  Calendar,
  Building2,
  Filter
} from "lucide-react";

const ALLOWED_UID = "4080180c-0607-4273-b2b7-959f99b85e3a";

type ChannelRequest = {
  id: number;
  created_at: string;
  user_id: string;
  name: string;
  type: string;
  is_team: boolean;
  team_id: number | null;
  company: string | null;
  links: string | null;
  image_url: string | null;
  status: "pending" | "approved" | "rejected";
  request_type?: "organizer" | "company";
  contact?: string | null;
  business_number?: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [requests, setRequests] = useState<ChannelRequest[]>([]);
  const [teams, setTeams] = useState<Record<number, string>>({});
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session || session.user.id !== ALLOWED_UID) {
          toast.error("접근 권한이 없습니다.");
          router.replace("/");
          return;
        }

        setIsAuthorized(true);
        setIsLoadingAuth(false);

        fetchInitialData();
      } catch (err) {
        router.replace("/");
      }
    };

    checkAdminAuth();
  }, [router]);

  const fetchInitialData = async () => {
    setIsLoadingData(true);
    try {
      const { data: teamData } = await supabase
        .from("channels")
        .select("id, name")
        .eq("is_team", true);

      const lookup: Record<number, string> = {};
      if (teamData) {
        teamData.forEach(t => {
          lookup[t.id] = t.name;
        });
        setTeams(lookup);
      }

      const { data: reqData, error } = await supabase
        .from("channel_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(reqData || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleAction = async (request: ChannelRequest, action: "approve" | "reject") => {
    setProcessingId(request.id);

    try {
      const newStatus = action === "approve" ? "approved" : "rejected";

      const { error: updateError } = await supabase
        .from("channel_requests")
        .update({ status: newStatus })
        .eq("id", request.id);

      if (updateError) throw updateError;

      if (action === "approve") {
        if (request.request_type === "company") {
          const { error: insertError } = await supabase
            .from("companies")
            .insert([{
              user_id: request.user_id,
              name: request.name,
              profile_image_url: request.image_url
            }]);

          if (insertError) {
            console.error("Company insert error:", insertError);
            toast.warning("상태는 변경되었으나 회사 생성 실패: " + insertError.message);
          } else {
            toast.success("관리자(회사)가 승인되어 즉시 등록되었습니다!");
          }
        } else {
          const { error: insertError } = await supabase
            .from("channels")
            .insert([{
              name: request.name,
              type: request.type,
              image_url: request.image_url,
              is_team: request.is_team,
              team_id: request.team_id,
              owner_id: request.user_id,
              links: request.links,
              company: request.company
            }]);

          if (insertError) {
            console.error("Channel insert error:", insertError);
            toast.warning("상태는 변경되었으나 채널 생성 실패: " + insertError.message);
          } else {
            toast.success("채널이 승인되어 시스템에 즉시 등록되었습니다!");
          }
        }
      } else {
        toast.success("신청 건을 거절 처리했습니다.");
      }

      setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: newStatus } : r));

    } catch (error: any) {
      console.error("Action error:", error);
      toast.error("오류 발생: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(r => filter === "all" ? true : r.status === filter);

  if (isLoadingAuth || !isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">관리자 권한 확인 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0B0B0E] text-foreground flex flex-col pb-20">
      <Header />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-10">

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div className="space-y-1">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 mb-2 px-3 py-1">Admin Console</Badge>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">신청 현황 관리</h1>
            <p className="text-muted-foreground text-sm">주최자 신청을 검토하고 승인/거절을 관리합니다.</p>
          </div>

          <div className="bg-background border border-border shadow-sm rounded-2xl p-4 flex items-center gap-6">
            <div className="text-center px-2">
              <div className="text-xs text-muted-foreground font-medium mb-1">대기 중</div>
              <div className="text-xl font-bold text-amber-500">{requests.filter(r => r.status === "pending").length}</div>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div className="text-center px-2">
              <div className="text-xs text-muted-foreground font-medium mb-1">전체</div>
              <div className="text-xl font-bold">{requests.length}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-border/50">
            {(["all", "pending", "approved", "rejected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${filter === f ? "bg-background text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
              >
                {f === "all" && "전체 목록"}
                {f === "pending" && "⏳ 대기 중"}
                {f === "approved" && "✅ 승인됨"}
                {f === "rejected" && "❌ 거절됨"}
              </button>
            ))}
          </div>
        </div>

        {isLoadingData ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4 opacity-50" />
            <p>데이터 동기화 중...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-20 border-2 border-dashed border-border rounded-3xl bg-background/50 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Filter className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-bold mb-1">신청 내역이 없습니다.</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredRequests.map((req) => (
              <div key={req.id} className="group bg-background border border-border rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${req.status === "approved" ? "bg-green-500" : req.status === "rejected" ? "bg-destructive" : "bg-amber-400"}`} />
                <div className="flex gap-5 mb-6">
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-16 h-16 rounded-2xl border border-border/50">
                      <AvatarImage src={req.image_url || undefined} className="object-cover" />
                      <AvatarFallback className="rounded-2xl bg-muted font-bold">{req.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    {req.is_team && <div className="absolute -bottom-1 -right-1 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">Team</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold truncate">{req.name}</h3>
                      <Badge variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}>
                        {req.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-1.5 text-xs text-muted-foreground">
                      {req.request_type === "company" ? (
                        <div className="flex items-center font-bold text-orange-500"><Building2 className="w-3 h-3 mr-1" /> 관리자(회사)</div>
                      ) : (
                        <div className="flex items-center"><User className="w-3 h-3 mr-1" /> {req.type === "youtuber" ? "유튜버" : req.type === "festival" ? "동인 행사" : "게임"}</div>
                      )}
                      <div className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {new Date(req.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 mb-6 flex-1 bg-muted/20 rounded-2xl p-4 border border-border/50">
                  {req.request_type === "company" ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground mb-1">연락처</div>
                        <div className="font-semibold flex items-center gap-1.5">{req.contact || "미기재"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground mb-1">사업자등록번호</div>
                        <div className="font-semibold flex items-center gap-1.5">{req.business_number || "미기재"}</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground mb-1">소속사</div>
                          <div className="font-semibold flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 opacity-50" /> {req.company || <span className="text-muted-foreground font-normal italic">없음</span>}</div>
                        </div>
                        {!req.is_team && (
                          <div>
                            <div className="text-[10px] font-bold text-muted-foreground mb-1">소속 팀</div>
                            <div className="font-semibold flex items-center gap-1.5"><Users className="w-3.5 h-3.5 opacity-50" /> {req.team_id ? (teams[req.team_id] || "...") : <span className="text-muted-foreground font-normal italic">없음</span>}</div>
                          </div>
                        )}
                      </div>
                      {req.links && (
                        <div className="pt-2 border-t border-border/40">
                          <div className="text-[10px] font-bold text-muted-foreground mb-1">링크</div>
                          <div className="text-xs bg-background/80 rounded-lg p-2 break-all flex items-start gap-2">
                            <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-50" /> <span className="whitespace-pre-wrap">{req.links}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  {req.status === "pending" ? (
                    <>
                      <Button onClick={() => handleAction(req, "approve")} disabled={processingId !== null} className="flex-1 h-11 font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl">
                        {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-2" /> 승인</>}
                      </Button>
                      <Button variant="outline" onClick={() => handleAction(req, "reject")} disabled={processingId !== null} className="flex-1 h-11 font-bold border-destructive/20 hover:bg-destructive/5 text-destructive hover:text-destructive rounded-xl">
                        <XCircle className="w-4 h-4 mr-2" /> 거절
                      </Button>
                    </>
                  ) : (
                    <div className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold border ${req.status === "approved" ? "bg-green-500/5 text-green-600 border-green-500/20" : "bg-red-500/5 text-red-600 border-red-500/20"}`}>
                      {req.status === "approved" ? "승인 완료" : "거절 처리 완료"}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
