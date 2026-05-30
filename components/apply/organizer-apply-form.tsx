"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  ImageIcon,
  Search,
  Check,
  ChevronDown,
  Plus,
  Trash2,
  ArrowLeft
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useImageUpload } from "@/hooks/use-image-upload";

interface Team {
  id: number;
  name: string;
  image_url: string | null;
}

interface Company {
  id: number;
  name: string;
  profile_image_url: string | null;
  invite_code: string | null;
  is_auto_approved: boolean | null;
}

interface ChannelLink {
  id: string;
  name: string;
  url: string;
}

interface OrganizerApplyFormProps {
  user: User;
  onBack: () => void;
  onSuccess: () => void;
}

const moveStorageImage = async (imageUrl: string): Promise<string> => {
  try {
    const bucketName = "channel-images";
    const oldFolder = "channel-requests";
    const newFolder = "channel-profile";
    
    if (!imageUrl || !imageUrl.includes(`/storage/v1/object/public/${bucketName}/${oldFolder}/`)) {
      return imageUrl;
    }
    
    const parts = imageUrl.split(`${oldFolder}/`);
    const fileName = parts[parts.length - 1];
    if (!fileName) return imageUrl;
    
    const oldPath = `${oldFolder}/${fileName}`;
    const newPath = `${newFolder}/${fileName}`;
    
    // Copy the file
    const { error: copyError } = await supabase.storage
      .from(bucketName)
      .copy(oldPath, newPath);
      
    if (copyError) {
      console.error("Storage copy error, trying move fallback:", copyError);
      const { error: moveError } = await supabase.storage
        .from(bucketName)
        .move(oldPath, newPath);
        
      if (moveError) {
        throw new Error(`Failed to copy or move image: ${moveError.message}`);
      }
    } else {
      // Delete old file
      const { error: removeError } = await supabase.storage
        .from(bucketName)
        .remove([oldPath]);
        
      if (removeError) {
        console.warn("Failed to remove old request image:", removeError);
      }
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(newPath);
      
    return publicUrl;
  } catch (err) {
    console.error("Error moving image in storage:", err);
    return imageUrl;
  }
};

export function OrganizerApplyForm({ user, onBack, onSuccess }: OrganizerApplyFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("none");
  const [linksForm, setLinksForm] = useState<ChannelLink[]>([{ id: "default", name: "", url: "" }]);
  
  // Company & Invite Code States
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [openCompanyPopover, setOpenCompanyPopover] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");

  const [openTeamPopover, setOpenTeamPopover] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);

  const {
    imageUrl,
    imagePath,
    isUploading,
    handleImageUpload,
  } = useImageUpload({
    bucket: "channel-images",
    folderPath: "channel-requests",
    prefix: "request-",
    successMessage: "프로필 이미지가 업로드되었습니다.",
  });

  // Fetch teams & companies for auto-complete on mount
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

    const fetchCompanies = async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, profile_image_url, invite_code, is_auto_approved")
        .order("name");
      
      if (error) {
        console.error("Error fetching companies:", error);
      } else if (data) {
        setCompanies(data);
      }
    };

    fetchTeams();
    fetchCompanies();
  }, []);


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

    // Invite Code validation if company is selected
    if (selectedCompany) {
      if (!selectedCompany.invite_code) {
        toast.error("선택한 소속사의 초대 코드가 설정되지 않았습니다. 관리자에게 문의하세요.");
        return;
      }
      if (inviteCodeInput.trim().toUpperCase() !== selectedCompany.invite_code.toUpperCase()) {
        toast.error("입력하신 소속 코드가 일치하지 않습니다. 다시 확인해주세요.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const isYoutuberType = type === "youtuber" || type === "youtuber_team";
      // Auto-approved only if company exists and has is_auto_approved turned on
      const isAutoApproved = !!selectedCompany && selectedCompany.is_auto_approved === true;
      const finalStatus = isAutoApproved ? "approved" : "pending";

      let finalImageUrl = imageUrl;
      if (isAutoApproved && imageUrl) {
        finalImageUrl = await moveStorageImage(imageUrl);
      }

      const insertData = {
        user_id: user.id,
        name: name.trim(),
        type: isYoutuberType ? "youtuber" : type,
        is_team: type === "youtuber_team",
        team_id: type === "youtuber" && teamId !== "none" ? parseInt(teamId) : null,
        company: selectedCompany ? selectedCompany.name : null,
        company_id: selectedCompany ? selectedCompany.id : null,
        links: linksForm.filter(l => l.name.trim() || l.url.trim()).length > 0 
          ? linksForm.filter(l => l.name.trim() || l.url.trim()).map(({ name, url }) => ({ name, url })) 
          : null,
        image_url: finalImageUrl,
        request_type: "organizer",
        status: finalStatus,
      };

      const { error: requestError } = await supabase
        .from("channel_requests")
        .insert([insertData]);

      if (requestError) throw requestError;

      if (isAutoApproved && selectedCompany) {
        toast.success("소속 코드가 인증되어 주최자 권한이 즉시 부여되었습니다!");
      } else {
        toast.success("신청이 성공적으로 접수되었습니다. 관리자 승인 후 완료됩니다.");
        
        // Asynchronously notify admins without awaiting
        import("@/app/actions/email").then(({ notifyAdminsNewApplication }) => {
          notifyAdminsNewApplication({
            name: name.trim(),
            type: isYoutuberType ? "youtuber" : type,
            createdAt: new Date().toISOString()
          }).catch(console.error);
        }).catch(console.error);
      }

      onSuccess();
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error("신청 과정에서 오류가 발생했습니다: " + (error.message || "다시 시도해주세요."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button 
        onClick={onBack}
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
                  // eslint-disable-next-line @next/next/no-img-element
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
                    <SelectItem value="festival">축제</SelectItem>
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
                    <Label className="text-base font-semibold">소속사</Label>
                    <Popover open={openCompanyPopover} onOpenChange={setOpenCompanyPopover}>
                      <PopoverTrigger asChild>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
                          <Input
                            placeholder="소속 없음"
                            value={companySearch || (selectedCompany ? selectedCompany.name : "")}
                            onFocus={() => {
                              setOpenCompanyPopover(true);
                              setCompanySearch("");
                            }}
                            onChange={(e) => {
                              setCompanySearch(e.target.value);
                              if (!openCompanyPopover) setOpenCompanyPopover(true);
                            }}
                            className="w-full h-12 text-base rounded-xl bg-muted/30 border-border/50 pl-10 pr-10 font-medium focus:ring-primary/20 transition-all animate-in fade-in"
                          />
                          <ChevronDown className={cn("absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none transition-transform duration-200", openCompanyPopover && "rotate-180")} />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-[--radix-popover-trigger-width] p-1 rounded-2xl shadow-2xl border-border/50 overflow-hidden" 
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <div className="flex flex-col max-h-[280px] overflow-y-auto custom-scrollbar bg-card">
                          {!companySearch.trim() && (
                            <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground/60 animate-in fade-in duration-200">
                              <Search className="w-8 h-8 opacity-30" />
                              <span className="text-sm font-medium">소속사 이름을 입력하여 검색하세요</span>
                            </div>
                          )}
                          
                          {selectedCompany && !companySearch.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCompany(null);
                                setInviteCodeInput("");
                                setOpenCompanyPopover(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-xl my-0.5 font-bold transition-colors"
                            >
                              선택 취소 (소속 없음으로 변경)
                            </button>
                          )}
                          
                          {companySearch.trim() !== "" && companies
                            .filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
                            .map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCompany(c);
                                  setCompanySearch(c.name);
                                  setOpenCompanyPopover(false);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/60 active:bg-muted/80 rounded-xl my-0.5 text-left text-base font-medium transition-colors"
                              >
                                <Avatar className="w-6 h-6 flex-shrink-0">
                                  <AvatarImage src={c.profile_image_url || undefined} />
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">{c.name.slice(0,1)}</AvatarFallback>
                                </Avatar>
                                <span className="truncate text-foreground flex-1">{c.name}</span>
                                {selectedCompany?.id === c.id && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                              </button>
                            ))
                          }
                          {companySearch.trim() !== "" && companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase())).length === 0 && (
                            <div className="py-6 text-center text-sm text-muted-foreground font-medium">검색 결과가 없습니다.</div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {selectedCompany && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-300">
                      <Label htmlFor="inviteCode" className="text-base font-semibold">
                        소속 코드 입력 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="inviteCode"
                        placeholder="소속사 관리자에게 받은 8자리 코드를 입력하세요"
                        value={inviteCodeInput}
                        onChange={(e) => setInviteCodeInput(e.target.value)}
                        className="h-12 text-base rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20 uppercase font-mono tracking-widest placeholder:normal-case placeholder:font-sans placeholder:tracking-normal"
                        required
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">SNS 링크 (선택)</Label>
              <div className="space-y-3">
                {linksForm.map((link, index) => (
                  <div key={link.id} className="flex gap-2 items-start animate-in fade-in duration-200">
                    <div className="flex-1 flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="링크 이름 (예: 유튜브)"
                        value={link.name}
                        onChange={(e) => {
                          const newForm = [...linksForm];
                          newForm[index].name = e.target.value;
                          setLinksForm(newForm);
                        }}
                        className="h-11 rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20 sm:flex-[1]"
                      />
                      <Input
                        placeholder="https://"
                        value={link.url}
                        onChange={(e) => {
                          const newForm = [...linksForm];
                          newForm[index].url = e.target.value;
                          setLinksForm(newForm);
                        }}
                        className="h-11 rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20 sm:flex-[2]"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setLinksForm(linksForm.filter(l => l.id !== link.id))}
                      className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLinksForm([...linksForm, { id: Math.random().toString(), name: "", url: "" }])}
                  className="w-full h-11 border-dashed border-2 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" /> 링크 추가하기
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">본인 인증 및 활동 확인이 가능한 링크를 등록해주세요.</p>
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
  );
}
