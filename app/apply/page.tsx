"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  UserCircle2,
  Building2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Search,
  Check,
  ChevronDown,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { User } from "@supabase/supabase-js";

type Team = {
  id: number;
  name: string;
  image_url: string | null;
};

export default function ApplyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  const [mode, setMode] = useState<"selection" | "admin" | "organizer">("selection");
  
  // Organizer form state
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("none");
  const [links, setLinks] = useState("");
  const [company, setCompany] = useState("");
  const [openTeamPopover, setOpenTeamPopover] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("로그인이 필요합니다.");
        router.push("/");
        return;
      }
      setUser(session.user);
      setIsLoadingAuth(false);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, image_url")
        .eq("is_team", true)
        .order("name");
      
      if (error) {
        console.error("Error fetching teams:", error);
      } else if (data) {
        setTeams(data);
      }
    };

    if (mode === "organizer") {
      fetchTeams();
    }
  }, [mode]);

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
        await supabase.storage.from("event_images").remove([imagePath]);
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `request-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `channel-requests/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("event_images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("event_images")
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      setImagePath(filePath);
      toast.success("프로필 이미지가 업로드되었습니다.");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("이미지 업로드에 실패했습니다: " + (error.message || "알 수 없는 오류"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    if (!type) {
      toast.error("유형을 선택해주세요.");
      return;
    }
    if (!user) {
      toast.error("로그인 정보가 확인되지 않습니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const isYoutuberType = type === "youtuber" || type === "youtuber_team";
      const insertData = {
        user_id: user.id,
        name: name.trim(),
        type: isYoutuberType ? "youtuber" : type,
        is_team: type === "youtuber_team",
        team_id: type === "youtuber" && teamId !== "none" ? parseInt(teamId) : null,
        company: isYoutuberType ? company.trim() || null : null,
        links: links.trim() || null,
        image_url: imageUrl,
        status: "pending",
      };

      const { error } = await supabase
        .from("channel_requests")
        .insert([insertData]);

      if (error) throw error;

      setIsSuccess(true);
      toast.success("신청이 성공적으로 접수되었습니다.");
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error("신청 과정에서 오류가 발생했습니다: " + (error.message || "다시 시도해주세요."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-background rounded-3xl border border-border shadow-xl p-8 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2">신청 접수 완료</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              주최자 신청이 성공적으로 접수되었습니다.<br />
              관리자 승인 후 활성화될 예정입니다.
            </p>
            <Button className="w-full h-12 text-base font-semibold rounded-xl" onClick={() => router.push("/")}>
              홈으로 돌아가기
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background flex flex-col pb-20">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-12">
        
        {mode === "selection" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">신청하기</h1>
              <p className="text-muted-foreground text-lg">활동하려는 유형에 맞춰 신청을 진행해주세요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
              {/* Admin Option */}
              <button
                onClick={() => setMode("admin")}
                className="group relative flex flex-col items-center justify-center p-8 bg-background border-2 border-border rounded-3xl shadow-sm transition-all duration-300 hover:border-orange-500/50 hover:shadow-lg hover:-translate-y-1 text-left"
              >
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Building2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-center">관리자(회사) 신청</h3>
                <p className="text-muted-foreground text-sm text-center">소속사 또는 기업 단위로<br/>다양한 계정을 통합 관리</p>
              </button>

              {/* Organizer Option */}
              <button
                onClick={() => setMode("organizer")}
                className="group relative flex flex-col items-center justify-center p-8 bg-background border-2 border-border rounded-3xl shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 text-left"
              >
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <UserCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-center">주최자 신청</h3>
                <p className="text-muted-foreground text-sm text-center">개인 크리에이터, 게임 등<br/>행사를 주최하고 싶으신 분</p>
              </button>
            </div>
          </div>
        )}

        {mode === "admin" && (
          <div className="flex flex-col items-center justify-center pt-20 space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">준비 중입니다.</h2>
              <p className="text-muted-foreground">관리자(회사) 신청 서비스는 현재 준비 중입니다.<br/>빠른 시일 내에 찾아뵙겠습니다.</p>
            </div>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={() => setMode("selection")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> 뒤로가기
            </Button>
          </div>
        )}

        {mode === "organizer" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button 
              onClick={() => setMode("selection")}
              className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> 신청 유형 다시 선택
            </button>
            
            <div className="bg-background border border-border rounded-3xl p-6 sm:p-10 shadow-xl">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">주최자 신청서</h2>
              
              <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* Profile Image Section */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">프로필 이미지</Label>
                  <div className="flex items-center gap-6">
                    <div className="relative w-24 h-24 flex-shrink-0 bg-muted rounded-2xl overflow-hidden group border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                      {imageUrl ? (
                        <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="relative">
                        <input
                          type="file"
                          id="image-upload"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={isUploading}
                        />
                        <label htmlFor="image-upload">
                          <Button type="button" variant="outline" className="cursor-pointer rounded-xl" asChild disabled={isUploading}>
                            <span>
                              <Upload className="w-4 h-4 mr-2" /> {imageUrl ? "이미지 변경" : "이미지 업로드"}
                            </span>
                          </Button>
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">주최자 프로필에 표시될 대표 이미지입니다.<br/>(정사각형 비율 권장)</p>
                    </div>
                  </div>
                </div>

                {/* Basic Fields */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-base font-semibold">이름 <span className="text-destructive">*</span></Label>
                    <Input
                      id="name"
                      placeholder="활동명 혹은 주최명을 입력하세요"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-12 text-base rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="type" className="text-base font-semibold">유형 선택 <span className="text-destructive">*</span></Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="h-12 text-base rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20">
                          <SelectValue placeholder="활동 유형" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="game">게임</SelectItem>
                          <SelectItem value="youtuber">유튜버</SelectItem>
                          <SelectItem value="youtuber_team">유튜버 단체 팀</SelectItem>
                          <SelectItem value="festival">동인 행사</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(type === "youtuber" || type === "youtuber_team") && (
                      <>
                        {type === "youtuber" && (
                          <div className="space-y-2 animate-in fade-in duration-300">
                            <Label className="text-base font-semibold">소속 팀</Label>
                            <Popover open={openTeamPopover} onOpenChange={setOpenTeamPopover}>
                              <PopoverTrigger asChild>
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
                                  <Input
                                    placeholder="소속 없음"
                                    value={teamSearch || (teamId !== "none" ? teams.find(t => t.id.toString() === teamId)?.name : "")}
                                    onFocus={() => {
                                      setOpenTeamPopover(true);
                                      setTeamSearch("");
                                    }}
                                    onChange={(e) => {
                                      setTeamSearch(e.target.value);
                                      if (!openTeamPopover) setOpenTeamPopover(true);
                                    }}
                                    className="w-full h-12 text-base rounded-xl bg-muted/30 border-border/50 pl-10 pr-10 font-medium focus:ring-primary/20 transition-all"
                                  />
                                  <ChevronDown className={cn("absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none transition-transform duration-200", openTeamPopover && "rotate-180")} />
                                </div>
                              </PopoverTrigger>
                              <PopoverContent 
                                className="w-[--radix-popover-trigger-width] p-1 rounded-2xl shadow-2xl border-border/50 overflow-hidden" 
                                align="start"
                                onOpenAutoFocus={(e) => e.preventDefault()}
                              >
                                <div className="flex flex-col max-h-[280px] overflow-y-auto custom-scrollbar bg-card">
                                  {/* Show interactive search prompt when empty */}
                                  {!teamSearch.trim() && (
                                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground/60 animate-in fade-in duration-200">
                                      <Search className="w-8 h-8 opacity-30" />
                                      <span className="text-sm font-medium">팀 이름을 입력하여 검색하세요</span>
                                    </div>
                                  )}
                                  
                                  {/* Only show matching teams if user has typed something */}
                                  {teamSearch.trim() !== "" && teams
                                    .filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()))
                                    .map((t) => (
                                      <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => {
                                          setTeamId(t.id.toString());
                                          setTeamSearch(t.name);
                                          setOpenTeamPopover(false);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/60 active:bg-muted/80 rounded-xl my-0.5 text-left text-base font-medium transition-colors"
                                      >
                                        <Avatar className="w-6 h-6 flex-shrink-0">
                                          <AvatarImage src={t.image_url || undefined} />
                                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">{t.name.slice(0,1)}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate text-foreground flex-1">{t.name}</span>
                                        {teamId === t.id.toString() && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                                      </button>
                                    ))
                                  }
                                  {/* Empty state for filtering */}
                                  {teamSearch.trim() !== "" && teams.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase())).length === 0 && !("소속 없음".includes(teamSearch)) && (
                                    <div className="py-6 text-center text-sm text-muted-foreground font-medium">검색 결과가 없습니다.</div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}

                        <div className="space-y-2 animate-in fade-in duration-300">
                          <Label htmlFor="company" className="text-base font-semibold">소속사</Label>
                          <Input
                            id="company"
                            placeholder="소속 없음"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            className="h-12 text-base rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="links" className="text-base font-semibold">관련 링크</Label>
                    <Textarea
                      id="links"
                      placeholder={"유튜브: https://...\n인스타그램: https://..."}
                      value={links}
                      onChange={(e) => setLinks(e.target.value)}
                      className="min-h-[120px] text-base rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20 py-3"
                    />
                    <p className="text-xs text-muted-foreground">본인 인증 및 활동 확인이 가능한 링크를 작성해주세요.</p>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full h-14 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                    disabled={isSubmitting || isUploading}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 처리 중...</>
                    ) : (
                      "신청 완료하기"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
        
      </main>
    </div>
  );
}
