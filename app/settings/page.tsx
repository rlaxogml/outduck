"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { User } from "@supabase/supabase-js";
import { Camera, Save, User as UserIcon, Bell, Settings2, Loader2, KeyRound, Trash2, Plus, AlertTriangle, Building2, Link as LinkIcon, ChevronLeft, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner"; // Assuming sonner is available, or use alert
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import { CompanyAffiliation, isAffiliationSupported } from "@/components/company-affiliation";

type Tab = "account" | "notifications" | "advanced";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("account");

  // Account state
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [bookmarksCount, setBookmarksCount] = useState(0);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification state
  const [notifyNewEvent, setNotifyNewEvent] = useState(true);
  const [notifyBookmarkNotice, setNotifyBookmarkNotice] = useState(true);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);

  // Advanced state
  const [ownerCode, setOwnerCode] = useState("");
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  // Channel Management State
  const [ownedChannels, setOwnedChannels] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [isCompanyAccount, setIsCompanyAccount] = useState(false);

  // Account Deletion State
  const [isAccountDeleteOpen, setIsAccountDeleteOpen] = useState(false);
  const [accountDeleteInput, setAccountDeleteInput] = useState("");
  const [isAccountDeleting, setIsAccountDeleting] = useState(false);

  const fetchOwnedChannelsAndTeams = async (userId: string) => {
    const [{ data: channelsData }, { data: teamsData }] = await Promise.all([
      supabase.from("channels").select("*").eq("owner_id", userId).order("name"),
      supabase.from("channels").select("id, name").eq("is_team", true).order("name")
    ]);

    let combinedChannels = channelsData || [];

    const { data: compData } = await supabase
      .from("companies")
      .select("name")
      .eq("user_id", userId)
      .maybeSingle();

    setIsCompanyAccount(!!compData?.name);

    if (compData?.name) {
      const { data: companyChans } = await supabase
        .from("channels")
        .select("*")
        .eq("company", compData.name)
        .is("owner_id", null)
        .order("name");

      if (companyChans && companyChans.length > 0) {
        companyChans.forEach(cc => {
          if (!combinedChannels.some(c => c.id === cc.id)) {
            combinedChannels.push(cc);
          }
        });
      }
    }

    setOwnedChannels(combinedChannels);
    setTeams(teamsData || []);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get("tab");
      if (tab === "account" || tab === "advanced") {
        setActiveTab(tab as Tab);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkAuthAndFetchData = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError || !session?.user) {
          router.replace("/");
          return;
        }

        const currentUser = session.user;
        if (isMounted) {
          setUser(currentUser);
          setName(currentUser.user_metadata?.name || "");
          setAvatarUrl(currentUser.user_metadata?.avatar_url || "");
          fetchOwnedChannelsAndTeams(currentUser.id);
        }

        // Fetch counts
        const [favoritesRes, bookmarksRes] = await Promise.all([
          supabase
            .from("favorites")
            .select("*", { count: "exact", head: true })
            .eq("user_id", currentUser.id),
          supabase
            .from("event_bookmarks")
            .select("*", { count: "exact", head: true })
            .eq("user_id", currentUser.id),
        ]);

        if (isMounted) {
          setFavoritesCount(favoritesRes.count || 0);
          setBookmarksCount(bookmarksRes.count || 0);
        }

        // Fetch notifications settings
        const { data: notifData } = await supabase
          .from("profiles")
          .select("notify_new_event, notify_bookmark_notice")
          .eq("id", currentUser.id)
          .maybeSingle();

        if (isMounted && notifData) {
          setNotifyNewEvent(notifData.notify_new_event ?? true);
          setNotifyBookmarkNotice(notifData.notify_bookmark_notice ?? true);
        }
      } catch (error) {
        console.error("Error fetching settings data:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuthAndFetchData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleAccountDelete = async () => {
    if (!user) return;
    setIsAccountDeleting(true);

    try {
      // 1. Delete associated data
      const deletes = [
        supabase.from("channels").delete().eq("owner_id", user.id),
        supabase.from("companies").delete().eq("user_id", user.id),
        supabase.from("favorites").delete().eq("user_id", user.id),
        supabase.from("event_bookmarks").delete().eq("user_id", user.id),
        supabase.from("notifications").delete().eq("user_id", user.id),
      ];
      await Promise.all(deletes);

      // 2. Sign out
      await supabase.auth.signOut();
      toast.success("계정이 성공적으로 탈퇴되었습니다.");
      router.replace("/");
    } catch (error: any) {
      toast.error("탈퇴 처리 중 오류가 발생했습니다: " + error.message);
      setIsAccountDeleting(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdatingProfile(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name,
          avatar_url: avatarUrl,
        }
      });

      if (error) throw error;
      alert("프로필이 성공적으로 업데이트되었습니다.");
      window.location.reload(); // To update header
    } catch (error: any) {
      alert("프로필 업데이트에 실패했습니다: " + error.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUpdatingProfile(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);
    } catch (error: any) {
      alert("이미지 업로드에 실패했습니다: " + error.message);
    } finally {
      setIsUpdatingProfile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleToggleNotifyNewEvent = async (checked: boolean) => {
    setNotifyNewEvent(checked);
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          { id: user.id, notify_new_event: checked, notify_bookmark_notice: notifyBookmarkNotice },
          { onConflict: "id" }
        );
      if (error) throw error;
      toast.success("새 행사 알림 설정이 업데이트되었습니다.");
    } catch (error: any) {
      toast.error("알림 설정 저장에 실패했습니다: " + error.message);
    }
  };

  const handleToggleNotifyBookmarkNotice = async (checked: boolean) => {
    setNotifyBookmarkNotice(checked);
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          { id: user.id, notify_new_event: notifyNewEvent, notify_bookmark_notice: checked },
          { onConflict: "id" }
        );
      if (error) throw error;
      toast.success("공지 알림 설정이 업데이트되었습니다.");
    } catch (error: any) {
      toast.error("알림 설정 저장에 실패했습니다: " + error.message);
    }
  };

  const handleVerifyOwnerCode = async () => {
    if (!ownerCode.trim()) {
      alert("코드를 입력해주세요.");
      return;
    }

    setIsVerifyingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-transfer-code', {
        body: { code: ownerCode }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("권한 위임이 완료되었습니다.");
        setOwnerCode("");
        if (user) fetchOwnedChannelsAndTeams(user.id);
      } else {
        alert(data?.message || "유효하지 않은 코드입니다.");
      }
    } catch (error: any) {
      console.error("Supabase Edge Function Error [verify-transfer-code]:", error);
      let errorMessage = error.message;
      if (error?.context && typeof error.context.json === 'function') {
        try {
          const errData = await error.context.json();
          errorMessage = errData.message || errorMessage;
          console.error("Parsed Error Data:", errData);
        } catch (e) {}
      }
      alert(errorMessage);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const avatarFallbackText = (user?.user_metadata?.name || user?.email || "U").slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto max-w-6xl w-full px-4 py-8 md:py-12">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="sticky top-24 space-y-1">
            <div className="mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-12 w-12 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground mb-3 -ml-3"
                title="뒤로 가기"
              >
                <ChevronLeft className="size-8 animate-in fade-in duration-300" />
              </Button>
              <h2 className="px-4 text-lg font-bold tracking-tight">설정</h2>
            </div>
            
            <button
              onClick={() => setActiveTab("account")}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "account" 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserIcon className="h-5 w-5" />
              계정
            </button>
            
            <button
              onClick={() => setActiveTab("notifications")}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "notifications" 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bell className="h-5 w-5" />
              알림
            </button>
            
            <button
              onClick={() => setActiveTab("advanced")}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "advanced" 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings2 className="h-5 w-5" />
              주최자 설정
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 w-full min-w-0">
          {activeTab === "account" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h3 className="text-2xl font-bold tracking-tight mb-1">계정 설정</h3>
                <p className="text-muted-foreground text-sm">프로필 정보와 활동 내역을 확인합니다.</p>
              </div>

              <div className="border border-slate-300 dark:border-slate-700 rounded-2xl p-6 bg-card shadow-sm space-y-8">
                {/* Profile Image & Name */}
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <Avatar className="h-24 w-24 border-2 border-border/50">
                      <AvatarImage src={avatarUrl} className="object-cover" />
                      <AvatarFallback className="text-2xl">{avatarFallbackText}</AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-6 w-6 text-white" />
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                    />
                  </div>
                  <div className="space-y-4 flex-1 w-full">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">이름 (닉네임)</Label>
                      <Input 
                        id="name" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        className="max-w-md h-11"
                        placeholder="이름을 입력해주세요"
                      />
                    </div>
                    <Button 
                      onClick={handleUpdateProfile} 
                      disabled={isUpdatingProfile}
                      className="w-full sm:w-auto h-10 px-6 font-semibold"
                    >
                      {isUpdatingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      프로필 저장
                    </Button>
                  </div>
                </div>

                <div className="h-px w-full bg-border" />

                {/* Activity Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-muted/50 p-5 flex flex-col justify-center">
                    <div className="text-sm text-muted-foreground mb-1 font-medium">구독 중인 채널</div>
                    <div className="text-3xl font-bold text-foreground">
                      {favoritesCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-5 flex flex-col justify-center">
                    <div className="text-sm text-muted-foreground mb-1 font-medium">찜한 행사</div>
                    <div className="text-3xl font-bold text-foreground">
                      {bookmarksCount.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h3 className="text-2xl font-bold tracking-tight mb-1">알림 설정</h3>
                <p className="text-muted-foreground text-sm">중요한 알림을 받을지 설정합니다.</p>
              </div>

              <div className="border border-slate-300 dark:border-slate-700 rounded-2xl p-6 bg-card shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-semibold">새 행사 알림</Label>
                    <p className="text-sm text-muted-foreground">새로운 행사가 등록될 때 알림을 받습니다.</p>
                  </div>
                  <Switch 
                    checked={notifyNewEvent} 
                    onCheckedChange={handleToggleNotifyNewEvent} 
                  />
                </div>
                
                <div className="h-px w-full bg-border" />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-semibold">찜한 행사 공지 알림</Label>
                    <p className="text-sm text-muted-foreground">내가 찜한 행사의 새로운 공지사항 알림을 받습니다.</p>
                  </div>
                  <Switch 
                    checked={notifyBookmarkNotice} 
                    onCheckedChange={handleToggleNotifyBookmarkNotice} 
                  />
                </div>
              </div>
            </div>
          )}



          {activeTab === "advanced" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h3 className="text-2xl font-bold tracking-tight mb-1">주최자 설정</h3>
                <p className="text-muted-foreground text-sm">특수 권한 및 관리자 기능을 설정합니다.</p>
              </div>

              {(!isCompanyAccount || ownedChannels.length === 0) && (
                <div className="border border-slate-300 dark:border-slate-700 rounded-2xl p-6 bg-card shadow-sm space-y-6">
                  {!isCompanyAccount && (
                    <div className={cn("space-y-4", ownedChannels.length === 0 ? "pb-4 border-b border-border" : "")}>
                      <Label className="text-base font-semibold flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        주최자 계정 신청
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        아웃덕에 행사 또는 채널을 등록하고 싶으신 경우, 주최자 계정을 신청해 주세요.
                      </p>
                      <Button 
                        variant="outline"
                        onClick={() => router.push('/apply')}
                        className="font-semibold"
                      >
                        주최자 계정 신청하기
                      </Button>
                    </div>
                  )}

                  {ownedChannels.length === 0 && (
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="ownerCode" className="text-base font-semibold flex items-center gap-2">
                        <KeyRound className="h-4 w-4" />
                        권한 코드
                      </Label>
                      <p className="text-sm text-muted-foreground mb-4">
                        부여받은 주최자 또는 관리자 전용 코드를 입력하여 권한을 활성화하세요.
                      </p>
                      <div className="flex flex-col gap-2 max-w-md">
                        <div className="flex gap-3">
                          <Input 
                            id="ownerCode" 
                            type="password"
                            value={ownerCode} 
                            onChange={(e) => setOwnerCode(e.target.value)} 
                            onKeyDown={(e) => setIsCapsLockOn(e.getModifierState("CapsLock"))}
                            onKeyUp={(e) => setIsCapsLockOn(e.getModifierState("CapsLock"))}
                            placeholder="코드를 입력하세요"
                            className="h-11 border-neutral-400 dark:border-neutral-500"
                          />
                          <Button 
                            onClick={handleVerifyOwnerCode} 
                            disabled={isVerifyingCode || !ownerCode.trim()}
                            className="h-11 px-6 font-semibold whitespace-nowrap"
                          >
                            {isVerifyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : "검증"}
                          </Button>
                        </div>
                        <p className={`text-xs font-medium animate-in fade-in flex items-center gap-1 ${isCapsLockOn ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {isCapsLockOn ? "⚠️ Caps Lock이 켜져 있습니다." : "✅ Caps Lock이 꺼져 있습니다."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Channel Management Section */}
              {ownedChannels.length > 0 && (
                <div className="border border-slate-300 dark:border-slate-700 rounded-2xl p-6 bg-card shadow-sm space-y-6">
                  <div>
                    <h4 className="text-xl font-bold tracking-tight mb-1 flex items-center gap-2">
                      <Settings2 className="h-5 w-5" /> 채널 관리
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      오너 권한을 가진 채널의 프로필 및 정보를 관리합니다.
                    </p>
                  </div>
                  
                  <div className="space-y-6">
                    {ownedChannels.map(channel => (
                      <ChannelSettingsCard 
                        key={channel.id} 
                        channel={channel} 
                        teams={teams}
                        onUpdated={() => fetchOwnedChannelsAndTeams(user!.id)} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Danger Zone */}
              <div className="border border-red-200 dark:border-red-900/30 rounded-2xl p-6 bg-red-50/30 dark:bg-red-950/10 shadow-sm space-y-6 mt-12">
                <div>
                  <h4 className="text-xl font-bold tracking-tight mb-1 flex items-center gap-2 text-red-600 dark:text-red-500">
                    <AlertTriangle className="h-5 w-5" /> 계정 탈퇴
                  </h4>
                  <p className="text-sm text-red-600/80 dark:text-red-400/80">
                    계정을 탈퇴하면 모든 데이터가 즉시 삭제되며 복구할 수 없습니다.
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setAccountDeleteInput("");
                      setIsAccountDeleteOpen(true);
                    }}
                    className="font-bold px-6 h-11"
                  >
                    계정 영구 삭제
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={isAccountDeleteOpen} onOpenChange={setIsAccountDeleteOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              계정 영구 삭제
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-relaxed text-foreground/80">
              정말로 아웃덕을 탈퇴하시겠습니까?<br/><br/>
              탈퇴 시 <strong>모든 데이터가 영구 삭제</strong>되며, 절대 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground block">
              확인을 위해 아래에 <span className="text-rose-600 font-bold">계정삭제</span> 를 정확히 입력해주세요.
            </Label>
            <Input
              value={accountDeleteInput}
              onChange={(e) => setAccountDeleteInput(e.target.value)}
              placeholder="계정삭제"
              className="h-10 border-neutral-300 dark:border-neutral-600 rounded-xl"
            />
          </div>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsAccountDeleteOpen(false)} disabled={isAccountDeleting} className="rounded-xl font-semibold">취소</Button>
            <Button
              variant="destructive"
              onClick={handleAccountDelete}
              disabled={isAccountDeleting || accountDeleteInput !== "계정삭제"}
              className="rounded-xl font-semibold"
            >
              {isAccountDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              탈퇴하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ChannelSettingsCard({ channel, teams, onUpdated }: { channel: any; teams: any[]; onUpdated: () => void }) {
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string>(channel.team_id ? String(channel.team_id) : "none");
  const [linksForm, setLinksForm] = useState<any[]>([]);
  const [imageUrl, setImageUrl] = useState(channel.image_url || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");

  useEffect(() => {
    if (!showDeleteDialog) {
      setDeleteConfirmText("");
    }
  }, [showDeleteDialog]);

  useEffect(() => {
    if (channel.company) {
      const fetchCompanyLogo = async () => {
        const { data } = await supabase
          .from("companies")
          .select("logo_url")
          .eq("name", channel.company)
          .maybeSingle();
        if (data?.logo_url) {
          setCompanyLogo(data.logo_url);
        }
      };
      fetchCompanyLogo();
    } else {
      setCompanyLogo(null);
    }
  }, [channel.company]);

  useEffect(() => {
    let initial: any[] = [];
    let parsedLinks = channel.links;
    if (typeof channel.links === 'string') {
      try {
        parsedLinks = JSON.parse(channel.links);
      } catch (e) {
        parsedLinks = null;
      }
    }
    if (Array.isArray(parsedLinks) && parsedLinks.length > 0) {
      initial = parsedLinks.map((l: any) => ({ ...l, id: Math.random().toString() }));
    } else if (parsedLinks && typeof parsedLinks === 'object' && Object.keys(parsedLinks).length > 0) {
      initial = Object.entries(parsedLinks).map(([k, v]) => ({ id: Math.random().toString(), name: k, url: v as string }));
    }
    if (initial.length === 0) initial = [{ id: Math.random().toString(), name: "", url: "" }];
    setLinksForm(initial);
  }, [channel]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      // Delete old channel image from storage if the image is being replaced
      if (channel.image_url && imageUrl !== channel.image_url) {
        const bucketName = "channel-images";
        const folder = "channel-profile";
        if (channel.image_url.includes(`/storage/v1/object/public/${bucketName}/${folder}/`)) {
          const parts = channel.image_url.split(`${folder}/`);
          const fileName = parts[parts.length - 1];
          if (fileName) {
            const { error: removeError } = await supabase.storage
              .from(bucketName)
              .remove([`${folder}/${fileName}`]);
            if (removeError) {
              console.warn("Failed to delete old channel image from storage:", removeError);
            } else {
              console.log("Successfully deleted old channel image:", fileName);
            }
          }
        }
      }

      const finalLinks = linksForm.filter(l => l.name.trim() || l.url.trim()).map(({ name, url }) => ({ name, url }));
      const { error } = await supabase
        .from("channels")
        .update({
          team_id: teamId === "none" ? null : Number(teamId),
          links: finalLinks.length > 0 ? finalLinks : null,
          image_url: imageUrl || null
        })
        .eq("id", channel.id);
      
      if (error) throw error;
      toast.success("채널 정보가 업데이트되었습니다.");
      onUpdated();
    } catch (e: any) {
      toast.error("업데이트 실패: " + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // 0. notifications에서 해당 channel_id와 연관된 알림 먼저 삭제 (외래키 제약조건 방지)
      const { error: delNotifErr } = await supabase
        .from("notifications")
        .delete()
        .eq("channel_id", channel.id);
      if (delNotifErr) throw delNotifErr;

      // 1. event_channels에서 해당 channel_id와 연결된 모든 event_id 조회
      const { data: eventChannels, error: fetchErr } = await supabase
        .from("event_channels")
        .select("event_id")
        .eq("channel_id", channel.id);
      if (fetchErr) throw fetchErr;

      const eventIds = (eventChannels || []).map(ec => ec.event_id).filter(Boolean) as number[];
      let orphanEventIds: number[] = [];

      if (eventIds.length > 0) {
        // 2. 해당 행사들이 또 다른 채널과 연결되어 있는지 확인하기 위해 모든 event_channels 데이터 조회
        const { data: allLinks, error: linksErr } = await supabase
          .from("event_channels")
          .select("event_id, channel_id")
          .in("event_id", eventIds);
        if (linksErr) throw linksErr;

        // 행사 ID별로 연결된 채널 수 계산
        const counts: Record<number, number> = {};
        (allLinks || []).forEach(link => {
          counts[link.event_id] = (counts[link.event_id] || 0) + 1;
        });

        // 채널이 이 채널 단 1개뿐이었던(삭제 후 0개가 될) 행사들 필터링
        orphanEventIds = eventIds.filter(id => counts[id] === 1);
      }

      // 3. event_channels에서 해당 channel_id 연결 삭제
      const { error: delLinksErr } = await supabase
        .from("event_channels")
        .delete()
        .eq("channel_id", channel.id);
      if (delLinksErr) throw delLinksErr;

      // 4. 연결된 채널이 0개가 된 행사들 삭제 - DB-level ON DELETE CASCADE로 부모 테이블만 삭제하면 하위 데이터도 자동 삭제됩니다.
      if (orphanEventIds.length > 0) {
        const { error: delEvErr } = await supabase
          .from("events")
          .delete()
          .in("id", orphanEventIds);
        if (delEvErr) throw delEvErr;
      }

      // 5. 마지막으로 채널 삭제
      const { error: delChanErr } = await supabase
        .from("channels")
        .delete()
        .eq("id", channel.id);
      if (delChanErr) throw delChanErr;

      toast.success("채널과 관련 행사가 완전히 삭제되었습니다.");
      setShowDeleteDialog(false);
      onUpdated();
    } catch (e: any) {
      toast.error("삭제 실패: " + e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `chan-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `channel-profile/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("channel-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("channel-images")
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      toast.success("이미지 업로드 완료");
    } catch (err: any) {
      toast.error("업로드 실패: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="border border-slate-300 dark:border-slate-700 rounded-xl p-5 bg-muted/10 space-y-6 relative overflow-hidden">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border border-slate-300 dark:border-slate-700 bg-background shadow-sm">
          <AvatarImage src={imageUrl} className="object-cover" />
          <AvatarFallback className="text-xl font-bold bg-muted">{channel.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div>
          <h4 className="text-lg font-bold">{channel.name}</h4>
          <p className="text-sm text-muted-foreground">{channel.type === "youtuber" ? "유튜버" : channel.type === "festival" ? "행사" : "게임"} 채널</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">프로필 이미지 변경</Label>
          <div className="flex items-center gap-3">
            <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="max-w-xs h-10 border-neutral-300 dark:border-neutral-600" />
            {isUploading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {isAffiliationSupported(channel.type) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-1"><Building2 className="w-4 h-4"/> 소속사</Label>
              {channel.company ? (
                <div className="flex items-center gap-3 bg-white dark:bg-background px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-600 h-10 select-none w-fit max-w-full">
                  <Avatar className="h-6 w-6 border shadow-xs bg-background shrink-0">
                    <AvatarImage src={companyLogo || undefined} className="object-cover" />
                    <AvatarFallback className="text-[10px] font-bold bg-muted-foreground/10 flex items-center justify-center">
                      {channel.company.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-bold text-foreground truncate">{channel.company}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-white dark:bg-background px-3 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 text-muted-foreground text-xs h-10 select-none w-fit">
                    <Building2 className="w-4 h-4 text-muted-foreground/60" />
                    <span>소속사 없음</span>
                  </div>
                  <CompanyAffiliation
                    channelId={channel.id}
                    channelType={channel.type}
                    onSuccess={onUpdated}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-1"><Users className="w-4 h-4"/> 소속 팀</Label>
              <Popover open={teamOpen} onOpenChange={setTeamOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={teamOpen}
                    className="w-full justify-between h-10 border-neutral-300 dark:border-neutral-600 font-normal"
                  >
                    <span className="truncate">
                      {teamId !== "none"
                        ? teams.find((team) => String(team.id) === teamId)?.name || "소속 없음"
                        : "소속 없음"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command className="overflow-visible" shouldFilter={false}>
                    <CommandInput 
                      placeholder="팀 이름 검색" 
                      value={teamSearch}
                      onValueChange={setTeamSearch}
                    />
                    {teamSearch.length > 0 && (
                      <div className="border-t border-neutral-200 dark:border-neutral-700">
                        <CommandList className="max-h-[160px] overflow-y-auto">
                          <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                          <CommandGroup>
                            {"소속 없음".includes(teamSearch) && (
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  setTeamId("none");
                                  setTeamSearch("");
                                  setTeamOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <Check className={cn("mr-2 h-4 w-4", teamId === "none" ? "opacity-100" : "opacity-0")} />
                                소속 없음
                              </CommandItem>
                            )}
                            {teams.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase())).map((team) => (
                              <CommandItem
                                key={team.id}
                                value={team.name}
                                onSelect={() => {
                                  setTeamId(String(team.id));
                                  setTeamSearch("");
                                  setTeamOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <Check className={cn("mr-2 h-4 w-4", teamId === String(team.id) ? "opacity-100" : "opacity-0")} />
                                {team.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </div>
                    )}
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-1"><LinkIcon className="w-4 h-4"/> SNS 링크</Label>
          <div className="space-y-2">
            {linksForm.map((link, index) => (
              <div key={link.id} className="flex flex-col sm:flex-row items-start gap-2 animate-in fade-in duration-200">
                <Input
                  placeholder="링크 이름 (예: 유튜브)"
                  value={link.name}
                  onChange={(e) => {
                    const newForm = [...linksForm];
                    newForm[index].name = e.target.value;
                    setLinksForm(newForm);
                  }}
                  className="h-10 sm:flex-[1] border-neutral-300 dark:border-neutral-600"
                />
                <Input
                  placeholder="https://"
                  value={link.url}
                  onChange={(e) => {
                    const newForm = [...linksForm];
                    newForm[index].url = e.target.value;
                    setLinksForm(newForm);
                  }}
                  className="h-10 sm:flex-[2] border-neutral-300 dark:border-neutral-600"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLinksForm(linksForm.filter(l => l.id !== link.id))}
                  className="h-10 w-10 shrink-0 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLinksForm([...linksForm, { id: Math.random().toString(), name: "", url: "" }])}
              className="border-dashed border-neutral-300 dark:border-neutral-600"
            >
              <Plus className="h-4 w-4 mr-1" /> 링크 추가
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-slate-300 dark:border-slate-700">
        <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(true)} className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 font-bold px-3 h-9">
          <Trash2 className="w-4 h-4 mr-1.5" />
          채널 삭제
        </Button>
        <Button onClick={handleUpdate} disabled={isUpdating} className="font-bold px-6 h-9">
          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          저장
        </Button>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              채널 삭제 경고
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-relaxed text-foreground/80">
              정말로 <strong className="text-foreground">{channel.name}</strong> 채널을 삭제하시겠습니까?<br/><br/>
              한 번 삭제하면 <strong>되돌릴 수 없으며</strong>, 채널과 연관된 데이터가 영구적으로 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground block">
              확인을 위해 아래에 <span className="text-rose-600 font-bold">{channel.name}/삭제한다</span>를 입력해주세요.
            </Label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={`${channel.name}/삭제한다`}
              className="h-10 border-neutral-300 dark:border-neutral-600 rounded-xl"
            />
          </div>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting} className="rounded-xl font-semibold">취소</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || deleteConfirmText !== `${channel.name}/삭제한다`}
              className="rounded-xl font-semibold"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              삭제하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
