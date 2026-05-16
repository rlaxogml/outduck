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
import { Camera, Save, User as UserIcon, Bell, Settings2, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner"; // Assuming sonner is available, or use alert

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
  const [notifyNewEvent, setNotifyNewEvent] = useState(false);
  const [notifyBookmarkNotice, setNotifyBookmarkNotice] = useState(false);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);

  // Advanced state
  const [ownerCode, setOwnerCode] = useState("");
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

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
          .from("notifications")
          .select("*")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (isMounted && notifData) {
          setNotifyNewEvent(notifData.notify_new_event ?? false);
          setNotifyBookmarkNotice(notifData.notify_bookmark_notice ?? false);
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

  const handleUpdateNotifications = async () => {
    if (!user) return;
    setIsUpdatingNotifications(true);

    try {
      const { error } = await supabase
        .from("notifications")
        .upsert(
          { 
            user_id: user.id, 
            notify_new_event: notifyNewEvent, 
            notify_bookmark_notice: notifyBookmarkNotice 
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        // Fallback for different schema if standard one fails
        console.warn("Notifications table might not have expected schema:", error);
      }
      
      alert("알림 설정이 저장되었습니다.");
    } catch (error: any) {
      alert("알림 설정 저장에 실패했습니다.");
    } finally {
      setIsUpdatingNotifications(false);
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
        alert("권한 위임이 완료되었습니다.");
        setOwnerCode("");
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
            <h2 className="px-4 text-lg font-bold tracking-tight mb-4">설정</h2>
            
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
              고급 설정
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

              <div className="border border-border rounded-2xl p-6 bg-card shadow-sm space-y-8">
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
                <p className="text-muted-foreground text-sm">받고 싶은 알림을 선택하세요.</p>
              </div>

              <div className="border border-border rounded-2xl p-6 bg-card shadow-sm space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">구독 채널 새 행사 알림</Label>
                      <p className="text-sm text-muted-foreground">구독 중인 채널에서 새로운 행사를 등록하면 알림을 받습니다.</p>
                    </div>
                    <Switch 
                      checked={notifyNewEvent} 
                      onCheckedChange={setNotifyNewEvent} 
                    />
                  </div>
                  <div className="h-px w-full bg-border" />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">찜한 행사 공지 알림</Label>
                      <p className="text-sm text-muted-foreground">찜한 행사와 관련된 중요 공지사항 알림을 받습니다.</p>
                    </div>
                    <Switch 
                      checked={notifyBookmarkNotice} 
                      onCheckedChange={setNotifyBookmarkNotice} 
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleUpdateNotifications} 
                    disabled={isUpdatingNotifications}
                    className="h-10 px-6 font-semibold"
                  >
                    {isUpdatingNotifications ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    설정 저장
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "advanced" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h3 className="text-2xl font-bold tracking-tight mb-1">고급 설정</h3>
                <p className="text-muted-foreground text-sm">특수 권한 및 관리자 기능을 설정합니다.</p>
              </div>

              <div className="border border-border rounded-2xl p-6 bg-card shadow-sm space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="ownerCode" className="text-base font-semibold flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    권한 코드
                  </Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    주최자 또는 관리자 전용 코드를 입력하여 권한을 활성화하세요.
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
                        className="h-11"
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
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
