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
  Filter,
  ShieldAlert,
  Trash2,
  AlertTriangle,
  Ban,
  UserX,
  Heart,
  ImageIcon,
  Plus
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

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

export default function AdminPage() {
  const router = useRouter();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [activeTab, setActiveTab] = useState<"requests" | "reports" | "bans" | "channels" | "posters">("requests");

  // 주최자 신청 관련 상태
  const [requests, setRequests] = useState<ChannelRequest[]>([]);
  const [teams, setTeams] = useState<Record<number, string>>({});
  const [isLoadingData, setIsLoadingData] = useState(true);

  // 포스터 관련 상태
  const [posters, setPosters] = useState<any[]>([]);
  const [isLoadingPosters, setIsLoadingPosters] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [processingId, setProcessingId] = useState<number | null>(null);

  // 신고 관련 상태
  const [reports, setReports] = useState<any[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportFilter, setReportFilter] = useState<"pending" | "resolved" | "dismissed">("pending");
  const [isStatusMigrationMissing, setIsStatusMigrationMissing] = useState(false);

  // 차단 관련 상태
  const [bans, setBans] = useState<any[]>([]);
  const [isLoadingBans, setIsLoadingBans] = useState(false);

  // 차단 컨트롤러 상태
  const [banningUserId, setBanningUserId] = useState<string | null>(null);
  const [banningNickname, setBanningNickname] = useState<string>("");
  const [banDays, setBanDays] = useState<number>(7);
  const [banPermanent, setBanPermanent] = useState<boolean>(false);
  const [banReason, setBanReason] = useState<string>("커뮤니티 가이드라인 위반");
  const [isSubmittingBan, setIsSubmittingBan] = useState(false);

  // 채널 관리 관련 상태
  const [searchChannelQuery, setSearchChannelQuery] = useState("");
  const [searchedChannels, setSearchedChannels] = useState<any[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [connectingChannelId, setConnectingChannelId] = useState<number | null>(null);
  const [selectedCompanyForChannel, setSelectedCompanyForChannel] = useState<string>("none");

  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          toast.error("접근 권한이 없습니다. 로그인이 필요합니다.");
          router.replace("/");
          return;
        }

        // Fetch user profile to check is_admin
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, is_admin")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error || !profile || !profile.is_admin) {
          toast.error("접근 권한이 없습니다. 관리자 전용 페이지입니다.");
          router.replace("/");
          return;
        }

        setAdminUserId(session.user.id);
        setIsAuthorized(true);
        setIsLoadingAuth(false);
      } catch (err) {
        console.error("Auth check error:", err);
        router.replace("/");
      }
    };

    checkAdminAuth();
  }, [router]);

  useEffect(() => {
    if (isAuthorized) {
      if (activeTab === "requests") {
        fetchInitialData();
      } else if (activeTab === "reports") {
        fetchReports();
      } else if (activeTab === "bans") {
        fetchBans();
      } else if (activeTab === "channels") {
        fetchCompanies();
      } else if (activeTab === "posters") {
        fetchPosters();
      }
    }
  }, [activeTab, isAuthorized, reportFilter]);

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
        .is("company_id", null)
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

  const fetchReports = async () => {
    setIsLoadingReports(true);
    setIsStatusMigrationMissing(false);
    try {
      const { data: reportsData, error: reportsError } = await supabase
        .from("comment_reports")
        .select("*")
        .eq("status", reportFilter)
        .order("created_at", { ascending: false });

      if (reportsError) {
        if (reportsError.code === '42703' || reportsError.message?.includes("status")) {
          setIsStatusMigrationMissing(true);
          setReports([]);
          return;
        }
        throw reportsError;
      }

      const rawReports = reportsData || [];

      if (rawReports.length === 0) {
        setReports([]);
        return;
      }

      const commentIds = Array.from(new Set(rawReports.map(r => r.comment_id).filter(Boolean)));
      const reporterIds = Array.from(new Set(rawReports.map(r => r.user_id)));

      let commentsData: any[] = [];
      let commentsError: any = null;

      if (commentIds.length > 0) {
        const { data, error } = await supabase
          .from("comments")
          .select("id, content, user_id, created_at, event_id, notice_id")
          .in("id", commentIds);
        
        commentsData = data || [];
        commentsError = error;
      }

      const commentsMap: Record<number, any> = {};
      if (!commentsError && commentsData) {
        commentsData.forEach(c => {
          commentsMap[c.id] = c;
        });
      }

      // Fetch online / offline events to reconstruct links
      const eventIds = commentsData ? Array.from(new Set(commentsData.map(c => c.event_id).filter(Boolean))) : [];
      let offlineEventsMap: Record<number, number> = {};
      let onlineEventsMap: Record<number, number> = {};

      if (eventIds.length > 0) {
        const { data: offData } = await supabase.from("offline_events").select("id, event_id").in("event_id", eventIds);
        if (offData) {
          offData.forEach(e => {
            offlineEventsMap[e.event_id] = e.id;
          });
        }

        const { data: onData } = await supabase.from("online_events").select("id, event_id").in("event_id", eventIds);
        if (onData) {
          onData.forEach(e => {
            onlineEventsMap[e.event_id] = e.id;
          });
        }
      }

      // Fetch notice event_ids
      const noticeIds = commentsData ? Array.from(new Set(commentsData.map(c => c.notice_id).filter(Boolean))) : [];
      let noticeEventIdsMap: Record<number, number> = {};
      if (noticeIds.length > 0) {
        const { data: noticeEventData } = await supabase.from("channel_notices").select("id, event_id").in("id", noticeIds);
        if (noticeEventData) {
          noticeEventData.forEach(n => {
            noticeEventIdsMap[n.id] = n.event_id;
          });
        }
      }

      const authorIds = commentsData ? commentsData.map(c => c.user_id) : [];
      const allUserIds = Array.from(new Set([...reporterIds, ...authorIds]));

      let profilesMap: Record<string, any> = {};
      if (allUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url")
          .in("id", allUserIds);

        if (profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      }

      const mappedReports = rawReports.map(report => {
        const comment = commentsMap[report.comment_id];
        let redirectUrl = "";
        
        if (comment) {
          if (comment.notice_id) {
            const noticeEventId = noticeEventIdsMap[comment.notice_id];
            if (noticeEventId) {
              const isOnline = !!onlineEventsMap[noticeEventId];
              if (isOnline) {
                redirectUrl = `/online-events/${onlineEventsMap[noticeEventId]}?activeTab=notices&notice_id=${comment.notice_id}&comment_id=${comment.id}`;
              } else if (offlineEventsMap[noticeEventId]) {
                redirectUrl = `/events/${offlineEventsMap[noticeEventId]}?activeTab=notices&notice_id=${comment.notice_id}&comment_id=${comment.id}`;
              }
            }
          } else if (comment.event_id) {
            const isOnline = !!onlineEventsMap[comment.event_id];
            if (isOnline) {
              redirectUrl = `/online-events/${onlineEventsMap[comment.event_id]}?comment_id=${comment.id}`;
            } else if (offlineEventsMap[comment.event_id]) {
              redirectUrl = `/events/${offlineEventsMap[comment.event_id]}?comment_id=${comment.id}`;
            }
          }
        }

        return {
          ...report,
          redirectUrl,
          reporter: profilesMap[report.user_id] || { nickname: "알 수 없는 사용자", avatar_url: "" },
          comment: comment ? {
            ...comment,
            author: profilesMap[comment.user_id] || { nickname: "탈퇴한 사용자", avatar_url: "" }
          } : null
        };
      });

      setReports(mappedReports);
    } catch (err: any) {
      console.error("Error fetching reports:", err);
      toast.error("신고 목록을 가져오는 데 실패했습니다.");
    } finally {
      setIsLoadingReports(false);
    }
  };

  const fetchBans = async () => {
    setIsLoadingBans(true);
    try {
      const { data: bansData, error: bansError } = await supabase
        .from("comment_bans")
        .select("*")
        .order("created_at", { ascending: false });

      if (bansError) throw bansError;

      const rawBans = bansData || [];

      if (rawBans.length === 0) {
        setBans([]);
        return;
      }

      const userIds = Array.from(new Set(rawBans.map(b => b.user_id)));
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url")
          .in("id", userIds);

        if (profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      }

      const mappedBans = rawBans.map(ban => ({
        ...ban,
        user: profilesMap[ban.user_id] || { nickname: "알 수 없는 사용자", avatar_url: "" }
      }));

      setBans(mappedBans);
    } catch (err) {
      console.error("Error fetching bans:", err);
      toast.error("차단 기록을 가져오는 데 실패했습니다.");
    } finally {
      setIsLoadingBans(false);
    }
  };

  const handleDismissReport = async (reportId: number) => {
    try {
      const { error } = await supabase
        .from("comment_reports")
        .update({ status: "dismissed" })
        .eq("id", reportId);

      if (error) throw error;
      toast.success("신고를 반려했습니다.");
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (err: any) {
      console.error("Dismiss report error:", err);
      toast.error("반려 처리 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteReportedComment = async (commentId: number, reportId: number, authorId: string, commentContent: string) => {
    if (!confirm("정말 이 댓글을 삭제하시겠습니까? 해당 댓글을 신고한 모든 내역이 '해결됨(resolved)'으로 업데이트됩니다.")) return;
    try {
      const { error: updateError } = await supabase
        .from("comment_reports")
        .update({ status: "resolved" })
        .eq("comment_id", commentId);

      if (updateError) throw updateError;

      const shortenedContent = commentContent.length > 15 
        ? `${commentContent.slice(0, 15)}...` 
        : commentContent;

      await supabase
        .from("notifications")
        .insert([
          {
            user_id: authorId,
            type: "comment_moderation",
            message: `댓글이 삭제되었습니다: [${shortenedContent}]`,
            is_read: false
          }
        ]);

      const { error: deleteError } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (deleteError) throw deleteError;

      toast.success("댓글을 삭제했습니다.");
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (err: any) {
      console.error("Delete reported comment error:", err);
      toast.error("댓글 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleCreateBan = async () => {
    if (!banningUserId) return;
    setIsSubmittingBan(true);
    try {
      const now = new Date();
      let bannedUntil: string | null = null;
      
      if (!banPermanent) {
        const untilDate = new Date();
        untilDate.setDate(untilDate.getDate() + banDays);
        bannedUntil = untilDate.toISOString();
      }

      const { error: banError } = await supabase
        .from("comment_bans")
        .insert([
          {
            user_id: banningUserId,
            banned_by: adminUserId,
            reason: banReason,
            ban_type: banPermanent ? "permanent" : "temporary",
            banned_until: bannedUntil,
            is_active: true
          }
        ]);

      if (banError) throw banError;

      const banMessage = banPermanent
        ? "댓글 기능이 영구 차단되었습니다."
        : `댓글 기능이 ${new Date(bannedUntil!).toLocaleDateString("ko-KR")}까지 차단되었습니다.`;

      await supabase
        .from("notifications")
        .insert([
          {
            user_id: banningUserId,
            type: "comment_moderation",
            message: banMessage,
            is_read: false
          }
        ]);

      toast.success("사용자가 성공적으로 차단되었습니다.");
      setBanningUserId(null);
      setBanReason("커뮤니티 가이드라인 위반");
      setBanDays(7);
      setBanPermanent(false);
      
      if (activeTab === "reports") {
        fetchReports();
      } else {
        fetchBans();
      }
    } catch (err: any) {
      console.error("Create ban error:", err);
      toast.error("유저 차단에 실패했습니다.");
    } finally {
      setIsSubmittingBan(false);
    }
  };

  const handleUnbanUser = async (banId: number, userId: string) => {
    try {
      const { error } = await supabase
        .from("comment_bans")
        .update({ is_active: false })
        .eq("id", banId);

      if (error) throw error;

      await supabase
        .from("notifications")
        .insert([
          {
            user_id: userId,
            type: "comment_moderation",
            message: "댓글 제한 기능이 해제되었습니다.",
            is_read: false
          }
        ]);

      toast.success("차단이 성공적으로 해제되었습니다.");
      setBans(prev => prev.map(b => b.id === banId ? { ...b, is_active: false } : b));
    } catch (err: any) {
      console.error("Unban user error:", err);
      toast.error("차단 해제에 실패했습니다.");
    }
  };

  const handleAction = async (request: ChannelRequest, action: "approve" | "reject") => {
    setProcessingId(request.id);

    try {
      const newStatus = action === "approve" ? "approved" : "rejected";
      let finalImageUrl = request.image_url;

      if (action === "approve" && request.image_url) {
        finalImageUrl = await moveStorageImage(request.image_url);
      }

      const { error: updateError } = await supabase
        .from("channel_requests")
        .update({ 
          status: newStatus,
          image_url: finalImageUrl
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      if (action === "approve") {
        if (request.request_type === "company") {
          const { error: insertError } = await supabase
            .from("companies")
            .insert([{
              user_id: request.user_id,
              name: request.name,
              profile_image_url: finalImageUrl
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
              image_url: finalImageUrl,
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

          // Force update the channel image_url in channels table in case it was auto-created or needs syncing
          await supabase
            .from("channels")
            .update({ image_url: finalImageUrl })
            .eq("name", request.name);
        }
      } else {
        toast.success("신청 건을 거절 처리했습니다.");
      }

      setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: newStatus, image_url: finalImageUrl } : r));

    } catch (error: any) {
      console.error("Action error:", error);
      toast.error("오류 발생: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteRequest = async (requestId: number) => {
    if (!confirm("정말 이 신청 내역을 삭제하시겠습니까? 데이터베이스에서 영구적으로 삭제됩니다.")) return;
    try {
      const { error } = await supabase
        .from("channel_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;
      toast.success("신청 내역이 완전히 삭제되었습니다.");
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err: any) {
      console.error("Delete request error:", err);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      setCompaniesList(data || []);
    } catch (err: any) {
      console.error("Error fetching companies:", err);
      toast.error("회사 목록을 가져오지 못했습니다.");
    }
  };

  const handleSearchChannels = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchChannelQuery.trim()) {
      toast.warning("검색어를 입력해 주세요.");
      return;
    }

    setIsLoadingChannels(true);
    try {
      const { data: channelsData, error: channelsError } = await supabase
        .from("channels")
        .select("*")
        .ilike("name", `%${searchChannelQuery.trim()}%`)
        .order("name", { ascending: true });

      if (channelsError) throw channelsError;

      const rawChannels = channelsData || [];

      if (rawChannels.length === 0) {
        setSearchedChannels([]);
        toast.info("검색 결과가 없습니다.");
        return;
      }

      // Fetch profile nicknames for owner_ids
      const ownerIds = Array.from(new Set(rawChannels.map(c => c.owner_id).filter(Boolean)));
      let profilesMap: Record<string, string> = {};

      if (ownerIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nickname")
          .in("id", ownerIds);

        if (!profilesError && profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = p.nickname;
          });
        }
      }

      const mappedChannels = rawChannels.map(channel => ({
        ...channel,
        ownerNickname: channel.owner_id ? (profilesMap[channel.owner_id] || "알 수 없는 사용자") : null
      }));

      setSearchedChannels(mappedChannels);
    } catch (err: any) {
      console.error("Error searching channels:", err);
      toast.error("채널 검색 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const handleDisconnectOwner = async (channelId: number, channelName: string, currentOwnerId: string | null) => {
    if (!confirm(`정말 '${channelName}' 채널의 소유주 권한을 끊으시겠습니까? 소유주가 공석이 되며, 회사 소유 채널 상태가 됩니다.`)) return;

    try {
      const { error } = await supabase
        .from("channels")
        .update({ owner_id: null })
        .eq("id", channelId);

      if (error) throw error;

      if (currentOwnerId) {
        await supabase
          .from("notifications")
          .insert([
            {
              user_id: currentOwnerId,
              type: "comment_moderation",
              message: `채널 [${channelName}]의 소유주 권한이 관리자에 의해 해제되었습니다.`,
              is_read: false
            }
          ]);
      }

      toast.success("소유주 연결을 성공적으로 끊었습니다.");
      
      // Update local state
      setSearchedChannels(prev => prev.map(c => c.id === channelId ? { ...c, owner_id: null, ownerNickname: null } : c));
    } catch (err: any) {
      console.error("Disconnect owner error:", err);
      toast.error("소유주 끊기에 실패했습니다.");
    }
  };

  const handleDisconnectCompany = async (channelId: number, channelName: string) => {
    if (!confirm(`정말 '${channelName}' 채널의 회사 소속 관계를 해제하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from("channels")
        .update({ company: null })
        .eq("id", channelId);

      if (error) throw error;

      toast.success("회사 연결을 해제했습니다.");
      
      // Update local state
      setSearchedChannels(prev => prev.map(c => c.id === channelId ? { ...c, company: null } : c));
    } catch (err: any) {
      console.error("Disconnect company error:", err);
      toast.error("회사 소속 해제에 실패했습니다.");
    }
  };

  const handleConnectCompany = async (channelId: number) => {
    if (selectedCompanyForChannel === "none") {
      toast.warning("연결할 회사를 선택해 주세요.");
      return;
    }

    try {
      const { error } = await supabase
        .from("channels")
        .update({ company: selectedCompanyForChannel })
        .eq("id", channelId);

      if (error) throw error;

      toast.success("회사를 성공적으로 연결했습니다.");
      
      // Update local state
      setSearchedChannels(prev => prev.map(c => c.id === channelId ? { ...c, company: selectedCompanyForChannel } : c));
      setConnectingChannelId(null);
      setSelectedCompanyForChannel("none");
    } catch (err: any) {
      console.error("Connect company error:", err);
      toast.error("회사 연결에 실패했습니다.");
    }
  };

  const handleDeleteChannel = async (channelId: number, channelName: string) => {
    if (!confirm(`⚠️ 경고: 정말 '${channelName}' 채널을 강제로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 채널에 귀속된 모든 스케줄 및 이벤트 데이터가 소실될 수 있습니다.`)) return;

    try {
      const { error } = await supabase
        .from("channels")
        .delete()
        .eq("id", channelId);

      if (error) throw error;

      toast.success("채널이 성공적으로 삭제되었습니다.");
      setSearchedChannels(prev => prev.filter(c => c.id !== channelId));
    } catch (err: any) {
      console.error("Delete channel error:", err);
      toast.error("채널 삭제에 실패했습니다.");
    }
  };

  const fetchPosters = async () => {
    setIsLoadingPosters(true);
    try {
      const { data, error } = await supabase
        .from("posters")
        .select("*")
        .order("order", { ascending: true });

      if (error) throw error;
      setPosters(data || []);
    } catch (err: any) {
      console.error("Error fetching posters:", err);
      toast.error("포스터 목록을 가져오는 데 실패했습니다.");
    } finally {
      setIsLoadingPosters(false);
    }
  };

  const handleUpdatePosterState = async (posterId: number, isActive: boolean, forceHide: boolean) => {
    try {
      const { error } = await supabase
        .from("posters")
        .update({ is_active: isActive, force_hide: forceHide })
        .eq("id", posterId);

      if (error) throw error;

      toast.success("포스터 노출 상태가 변경되었습니다.");
      setPosters(prev => prev.map(p => p.id === posterId ? { ...p, is_active: isActive, force_hide: forceHide } : p));
    } catch (err: any) {
      console.error("Update poster state error:", err);
      toast.error("상태 변경에 실패했습니다.");
    }
  };

  const handleDeletePoster = async (posterId: number) => {
    if (!confirm("⚠️ 정말 이 광고 포스터를 영구적으로 삭제하시겠습니까?\n이 작업은 복구할 수 없습니다.")) return;

    try {
      const { error } = await supabase
        .from("posters")
        .delete()
        .eq("id", posterId);

      if (error) throw error;

      toast.success("광고 포스터가 성공적으로 삭제되었습니다.");
      setPosters(prev => prev.filter(p => p.id !== posterId));
    } catch (err: any) {
      console.error("Delete poster error:", err);
      toast.error("포스터 삭제에 실패했습니다.");
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

  const nowStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  
  const formatDisplayDate = (isoString: string | null) => {
    if (!isoString) return "상시";
    const datePart = isoString.split('T')[0];
    const [y, m, d] = datePart.split('-');
    return `${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
  };

  const activePosters = posters.filter(p => {
    if (p.force_hide) return false;
    if (p.is_active) return true;
    const start = p.start_date ? p.start_date.split('T')[0] : null;
    const end = p.end_date ? p.end_date.split('T')[0] : null;
    if (start && start > nowStr) return false;
    if (end && end < nowStr) return false;
    return true;
  });

  const upcomingPosters = posters.filter(p => {
    if (p.force_hide) return false;
    if (p.is_active) return false;
    const start = p.start_date ? p.start_date.split('T')[0] : null;
    if (start && start > nowStr) return true;
    return false;
  });

  const pastPosters = posters.filter(p => {
    if (p.force_hide) return false;
    if (p.is_active) return false;
    const start = p.start_date ? p.start_date.split('T')[0] : null;
    const end = p.end_date ? p.end_date.split('T')[0] : null;
    if (start && start > nowStr) return false;
    if (end && end < nowStr) return true;
    return false;
  });

  const hiddenPosters = posters.filter(p => p.force_hide);

  const renderPosterCard = (poster: any) => (
    <div key={poster.id} className="group bg-background border border-border rounded-3xl p-5 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
      <div className="absolute top-0 left-0 right-0 h-1 bg-orange-505" style={{ backgroundColor: '#f97316' }} />
      
      {/* Header: Title and Trash Action */}
      <div className="flex justify-between items-start gap-4 mb-4">
        <div>
          <h4 className="font-extrabold text-base text-slate-800 dark:text-slate-200">
            {poster.advertiser_name || poster.title || "알 수 없는 광고주"}
          </h4>
          <p className="text-xs text-muted-foreground font-semibold mt-0.5 flex items-center gap-1.5">
            연락처: {poster.contact || "미기재"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleDeletePoster(poster.id)}
          className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Banner Image Preview */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-muted flex items-center justify-center w-full aspect-[21/9] mb-4">
        {poster.image_url ? (
          <img 
            src={poster.image_url} 
            alt="Banner Preview" 
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
            <ImageIcon className="w-8 h-8" />
            <span className="text-[10px]">이미지 없음</span>
          </div>
        )}
        {poster.link_url && (
          <a 
            href={poster.link_url} 
            target="_blank" 
            rel="noreferrer"
            className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white font-bold rounded-lg px-2.5 py-1 text-[9.5px] backdrop-blur-xs flex items-center gap-1 transition-all"
          >
            랜딩 연결 <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>

      {/* Metadata & Toggle */}
      <div className="flex flex-col gap-4 border-t border-border/40 pt-4 mt-1">
        <div className="flex items-center justify-between">
          <div className="space-y-1 text-[11px] font-semibold text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">노출 기간:</span>
              <span className="text-foreground">
                {formatDisplayDate(poster.start_date)} ~ {formatDisplayDate(poster.end_date)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">결제 상태:</span>
              <Badge 
                variant="outline"
                className={`text-[9px] font-bold h-4.5 py-0 px-1.5 border-none shadow-none ${
                  poster.payment_status === "paid" 
                    ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                }`}
              >
                {poster.payment_status === "paid" ? "💳 결제 완료" : "⏳ 대기 중"}
              </Badge>
            </div>
          </div>
        </div>

        {/* State Toggle Buttons */}
        <div className="flex bg-muted rounded-xl p-1 w-full gap-1 border border-border/40">
          <button 
            onClick={() => handleUpdatePosterState(poster.id, false, true)}
            className={`flex-1 text-[10.5px] font-bold py-1.5 rounded-lg transition-all ${!poster.is_active && poster.force_hide ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:bg-muted-foreground/10"}`}
          >
            🛑 숨김
          </button>
          <button 
            onClick={() => handleUpdatePosterState(poster.id, false, false)}
            className={`flex-1 text-[10.5px] font-bold py-1.5 rounded-lg transition-all ${!poster.is_active && !poster.force_hide ? "bg-white dark:bg-slate-800 text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted-foreground/10"}`}
          >
            ⏳ 자동
          </button>
          <button 
            onClick={() => handleUpdatePosterState(poster.id, true, false)}
            className={`flex-1 text-[10.5px] font-bold py-1.5 rounded-lg transition-all ${poster.is_active && !poster.force_hide ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:bg-muted-foreground/10"}`}
          >
            🚀 노출
          </button>
        </div>
      </div>

    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0B0B0E] text-foreground flex flex-col pb-20">
      <Header />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-10">

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div className="space-y-1">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 mb-2 px-3 py-1">Admin Console</Badge>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">Outduck 관리자 콘솔</h1>
            <p className="text-muted-foreground text-sm">신청 현황 검토 및 사용자 신고 댓글 모더레이션을 수행합니다.</p>
          </div>

          <div className="bg-background border border-border shadow-sm rounded-2xl p-4 flex items-center gap-6 select-none">
            <div className="text-center px-2">
              <div className="text-xs text-muted-foreground font-medium mb-1">대기 중인 신청</div>
              <div className="text-xl font-bold text-amber-500">{requests.filter(r => r.status === "pending").length}</div>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div className="text-center px-2">
              <div className="text-xs text-muted-foreground font-medium mb-1">미처리 신고</div>
              <div className="text-xl font-bold text-red-500">{reports.length}</div>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="flex border-b border-border/60 mb-6 select-none overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("requests")}
            className={`pb-3 px-5 text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
              activeTab === "requests"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>주최자 신청 현황</span>
            <Badge className="bg-primary/10 text-primary text-[10px] py-0 px-1.5 ml-1 select-none">
              {requests.filter(r => r.status === "pending").length}
            </Badge>
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`pb-3 px-5 text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
              activeTab === "reports"
                ? "border-amber-500 text-amber-500"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>댓글 신고 현황</span>
            {reports.filter(r => r.status === "pending").length > 0 && (
              <Badge className="bg-amber-500/10 text-amber-500 text-[10px] py-0 px-1.5 ml-1 select-none animate-pulse">
                {reports.filter(r => r.status === "pending").length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("bans")}
            className={`pb-3 px-5 text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
              activeTab === "bans"
                ? "border-red-500 text-red-500"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Ban className="w-4 h-4" />
            <span>댓글 차단 관리</span>
            {bans.filter(b => b.is_active).length > 0 && (
              <Badge className="bg-red-500/10 text-red-500 text-[10px] py-0 px-1.5 ml-1 select-none">
                {bans.filter(b => b.is_active).length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("channels")}
            className={`pb-3 px-5 text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
              activeTab === "channels"
                ? "border-purple-500 text-purple-500"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>채널 관리</span>
          </button>
          <button
            onClick={() => setActiveTab("posters")}
            className={`pb-3 px-5 text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
              activeTab === "posters"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>포스터 관리</span>
          </button>
        </div>

        {activeTab === "requests" && (
          <>
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
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}>
                              {req.status.toUpperCase()}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteRequest(req.id)}
                              className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-3 mt-1.5 text-xs text-muted-foreground">
                          {req.request_type === "company" ? (
                            <div className="flex items-center font-bold text-orange-500"><Building2 className="w-3 h-3 mr-1" /> 관리자(회사)</div>
                          ) : (
                            <div className="flex items-center"><User className="w-3 h-3 mr-1" /> {req.type === "youtuber" ? "유튜버" : req.type === "festival" ? "축제" : "게임"}</div>
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
                              <div className="text-xs bg-background/80 rounded-lg p-2.5 break-all flex flex-col gap-1.5">
                                {(() => {
                                  try {
                                    const parsed = typeof req.links === 'string' ? JSON.parse(req.links) : req.links;
                                    if (Array.isArray(parsed)) {
                                      return parsed.map((l: any, i: number) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                          <span className="font-semibold text-foreground/75 shrink-0">{l.name}:</span>
                                          <a href={l.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex items-center gap-0.5">
                                            {l.url} <ExternalLink className="w-2.5 h-2.5 inline shrink-0 opacity-50" />
                                          </a>
                                        </div>
                                      ));
                                    } else if (parsed && typeof parsed === 'object') {
                                      return Object.entries(parsed).map(([k, v]: any, i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                          <span className="font-semibold text-foreground/75 shrink-0">{k}:</span>
                                          <a href={v} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex items-center gap-0.5">
                                            {v} <ExternalLink className="w-2.5 h-2.5 inline shrink-0 opacity-50" />
                                          </a>
                                        </div>
                                      ));
                                    }
                                  } catch (e) {}
                                  return <span className="whitespace-pre-wrap">{String(req.links)}</span>;
                                })()}
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
          </>
        )}

        {activeTab === "reports" && (
          <>
            {isStatusMigrationMissing ? (
              <div className="py-10 px-6 sm:px-8 border border-red-200 dark:border-red-950/45 rounded-3xl bg-red-500/5 dark:bg-red-950/10 space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <h3 className="text-lg font-extrabold text-foreground">데이터베이스 마이그레이션이 누락되었습니다</h3>
                    <p className="text-sm font-semibold text-muted-foreground leading-relaxed">
                      `comment_reports` 테이블에 필수적인 `status` 컬럼이 추가되지 않았거나 적용이 지연되고 있습니다. 관리자 대시보드를 활성화하려면 아래 마이그레이션 SQL을 실행해 주세요.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">실행할 SQL 스크립트</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`ALTER TABLE comment_reports ADD COLUMN IF NOT EXISTS status VARCHAR(255) DEFAULT 'pending';\nALTER TABLE comment_reports ADD CONSTRAINT comment_reports_status_check CHECK (status IN ('pending', 'resolved', 'dismissed'));`);
                        toast.success("SQL이 클립보드에 복사되었습니다!");
                      }}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      코드 복사하기
                    </button>
                  </div>
                  <pre className="bg-muted/80 border border-border/80 rounded-2xl p-4 text-xs font-mono font-bold leading-relaxed text-foreground select-text overflow-x-auto whitespace-pre-wrap">
                    {`-- 1. comment_reports 테이블에 status 컬럼 추가
ALTER TABLE comment_reports 
ADD COLUMN IF NOT EXISTS status VARCHAR(255) DEFAULT 'pending';

-- 2. status 제약 조건 추가
ALTER TABLE comment_reports
ADD CONSTRAINT comment_reports_status_check
CHECK (status IN ('pending', 'resolved', 'dismissed'));`}
                  </pre>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <Button
                    onClick={fetchReports}
                    className="h-10 px-5 font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                  >
                    새로고침하여 상태 재조회
                  </Button>
                  <span className="text-xs text-muted-foreground font-semibold">
                    * Supabase Dashboard &gt; SQL Editor에서 복사한 쿼리를 붙여넣은 뒤 실행(Run)하시면 즉시 정상 작동합니다.
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-border/50">
                {(["pending", "resolved", "dismissed"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setReportFilter(status)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      reportFilter === status
                        ? "bg-background text-foreground shadow-sm border border-border/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {status === "pending" && "⏳ 미처리 신고"}
                    {status === "resolved" && "✅ 해결됨 (삭제 완료)"}
                    {status === "dismissed" && "❌ 반려됨"}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingReports ? (
              <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 opacity-50 text-amber-500" />
                <p>신고 내역 분석 중...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="py-20 border border-dashed border-border rounded-3xl bg-background/50 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 text-muted-foreground/40">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-bold mb-1">
                  {reportFilter === "pending" && "처리할 신고 내역이 없습니다."}
                  {reportFilter === "resolved" && "해결된 신고 내역이 없습니다."}
                  {reportFilter === "dismissed" && "반려된 신고 내역이 없습니다."}
                </h3>
                <p className="text-xs text-muted-foreground">모든 댓글이 깨끗하고 평화롭습니다! ✨</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-200">
                {reports.map((report) => (
                  <div key={report.id} className="group bg-background border border-border rounded-3xl p-5 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row gap-5 items-start justify-between">
                    <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                      reportFilter === "pending" ? "bg-amber-500" : reportFilter === "resolved" ? "bg-green-500" : "bg-gray-400"
                    }`} />
                    
                    <div className="flex-1 space-y-3.5 pl-2.5">
                      {/* Header: Reporter Info */}
                      <div className="flex flex-wrap items-center gap-2 select-none">
                        <Badge variant="outline" className={`${
                          reportFilter === "pending" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                          reportFilter === "resolved" ? "bg-green-500/10 text-green-600 border-green-500/20" :
                          "bg-gray-500/10 text-gray-600 border-gray-500/20"
                        } text-[10px] font-bold px-2 py-0.5`}>
                          ⚠️ {report.reason}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          <strong className="text-foreground/90 font-bold">{report.reporter.nickname}</strong> 님이 신고함
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">{new Date(report.created_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>

                      {/* Report details if any */}
                      {report.details && (
                        <div className="text-xs bg-amber-500/5 text-amber-800 dark:text-amber-300 rounded-xl px-3.5 py-2.5 border border-amber-500/10 leading-relaxed font-semibold">
                          신고 의견: &quot;{report.details}&quot;
                        </div>
                      )}

                      {/* Reported Comment Box */}
                      <div className="border border-border/80 bg-muted/20 rounded-2xl p-4 space-y-2.5">
                        {report.comment ? (
                          <>
                            <div className="flex items-center gap-2 text-xs">
                              <Avatar className="w-5 h-5 border shadow-xs shrink-0 select-none">
                                <AvatarImage src={report.comment.author.avatar_url || undefined} className="object-cover bg-muted" />
                                <AvatarFallback className="font-bold text-[9px]">{report.comment.author.nickname.slice(0, 1)}</AvatarFallback>
                              </Avatar>
                              <span className="font-bold text-foreground/80">{report.comment.author.nickname}</span>
                              <span className="text-muted-foreground/50 text-[10px]">작성일: {new Date(report.comment.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm font-medium leading-relaxed text-foreground/90 break-words select-text">
                              {report.comment.content}
                            </p>
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground font-bold italic flex items-center gap-1 py-1 select-none">
                            <XCircle className="w-3.5 h-3.5 opacity-60" />
                            <span>이전 댓글 내역이 이미 시스템에 의해 완전히 삭제되었습니다. (신고 기록 영구 보존)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 w-full md:w-[280px] shrink-0 pl-2.5 md:pl-0 pt-2 md:pt-0 self-center">
                      {reportFilter === "pending" && (
                        <Button
                          onClick={() => handleDismissReport(report.id)}
                          className={`w-full h-10 font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs whitespace-nowrap flex items-center justify-center ${
                            !report.comment ? "col-span-2" : ""
                          }`}
                        >
                          <Heart className="w-3.5 h-3.5 mr-1 fill-white" />
                          신고 반려
                        </Button>
                      )}
                      
                      {reportFilter === "pending" && report.comment && (
                        <Button
                          onClick={() => handleDeleteReportedComment(report.comment_id, report.id, report.comment.user_id, report.comment.content)}
                          className="w-full h-10 font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          댓글 삭제
                        </Button>
                      )}

                      {report.redirectUrl && report.comment && (
                        <a
                          href={report.redirectUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1 h-10 px-3 font-bold border border-primary/20 hover:bg-primary/5 text-primary rounded-xl text-xs transition-colors whitespace-nowrap"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          해당 댓글 보기
                        </a>
                      )}

                      {reportFilter === "pending" && report.comment && (
                        <Button
                          onClick={() => {
                            setBanningUserId(report.comment.user_id);
                            setBanningNickname(report.comment.author.nickname);
                          }}
                          className="w-full h-10 font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs whitespace-nowrap"
                        >
                          <UserX className="w-3.5 h-3.5 mr-1" />
                          유저 차단
                        </Button>
                      )}
                      
                      {reportFilter !== "pending" && (
                        <div className={`flex items-center justify-center px-4 py-2 text-xs font-extrabold rounded-xl border bg-muted/40 text-muted-foreground border-border/40 select-none ${
                          !report.redirectUrl ? "col-span-2 w-full" : "w-full"
                        }`}>
                          {reportFilter === "resolved" ? "✅ 해결완료" : "❌ 반려됨"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </>
    )}

        {activeTab === "bans" && (
          <>
            {isLoadingBans ? (
              <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 opacity-50 text-red-500" />
                <p>차단 이력 분석 중...</p>
              </div>
            ) : bans.length === 0 ? (
              <div className="py-20 border border-dashed border-border rounded-3xl bg-background/50 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 text-muted-foreground/40">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-bold mb-1">차단된 사용자가 없습니다.</h3>
                <p className="text-xs text-muted-foreground">모든 사용자가 훌륭한 매너를 보여주고 있습니다! ✨</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex items-start gap-3 select-none mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-semibold">
                    사용자 차단 이력은 상습 규정 위반자(상습범) 식별 및 투명한 모더레이션 감사를 위해 영구적으로 보존됩니다. 차단 해제 시 비활성화(inactive) 상태로 전환됩니다.
                  </div>
                </div>

                {bans.map((ban) => (
                  <div key={ban.id} className="group bg-background border border-border rounded-3xl p-5 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                      ban.is_active ? "bg-red-500" : "bg-gray-300 dark:bg-gray-800"
                    }`} />
                    
                    <div className="flex-1 flex items-center gap-4 pl-2.5">
                      <Avatar className="w-12 h-12 border shadow-xs select-none">
                        <AvatarImage src={ban.user.avatar_url || undefined} className="object-cover bg-muted" />
                        <AvatarFallback className="font-bold text-sm bg-muted">{ban.user.nickname.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-base truncate">{ban.user.nickname}</h4>
                          
                          <Badge variant="outline" className={`${
                            ban.is_active 
                              ? ban.ban_type === "permanent" 
                                ? "bg-red-500/10 text-red-600 border-red-500/20" 
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                          } text-[10px] font-extrabold px-2 py-0.5`}>
                            {ban.is_active 
                              ? ban.ban_type === "permanent" 
                                ? "🚨 영구 차단" 
                                : `⏳ 임시 차단 (~${new Date(ban.banned_until!).toLocaleDateString("ko-KR")})`
                              : "🔓 차단 해제됨"
                            }
                          </Badge>
                        </div>
                        
                        <p className="text-sm font-semibold text-foreground/80 leading-relaxed break-all">
                          사유: <span className="text-muted-foreground font-medium">{ban.reason}</span>
                        </p>
                        
                        <div className="text-[10px] text-muted-foreground/60 select-none">
                          조치일: {new Date(ban.created_at).toLocaleString("ko-KR")}
                        </div>
                      </div>
                    </div>
                    
                    <div className="shrink-0 pl-2.5 sm:pl-0 pt-2 sm:pt-0 w-full sm:w-auto">
                      {ban.is_active && (
                        <Button
                          variant="outline"
                          onClick={() => handleUnbanUser(ban.id, ban.user_id)}
                          className="w-full sm:w-auto h-10 font-bold border-red-200 hover:bg-red-50 hover:text-red-700 text-red-600 dark:border-red-950/40 dark:hover:bg-red-950/20 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          차단 해제
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "channels" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Search Box */}
            <div className="bg-background border border-border rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-foreground">채널 이름으로 검색</h3>
              <form onSubmit={handleSearchChannels} className="flex gap-2">
                <input
                  type="text"
                  value={searchChannelQuery}
                  onChange={(e) => setSearchChannelQuery(e.target.value)}
                  placeholder="검색할 채널 이름을 입력해 주세요."
                  className="flex-1 bg-muted/20 border border-border/80 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary placeholder:text-muted-foreground/60"
                />
                <Button
                  type="submit"
                  disabled={isLoadingChannels}
                  className="h-10 px-5 font-bold bg-primary hover:bg-primary/95 text-white rounded-xl text-xs whitespace-nowrap"
                >
                  {isLoadingChannels ? <Loader2 className="w-4 h-4 animate-spin" /> : "검색"}
                </Button>
              </form>
            </div>

            {/* Results */}
            {isLoadingChannels ? (
              <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 opacity-50 text-purple-500" />
                <p>채널 검색 중...</p>
              </div>
            ) : searchedChannels.length === 0 ? (
              <div className="py-20 border border-dashed border-border rounded-3xl bg-background/50 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 text-muted-foreground/40">
                  <Building2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-1">검색 결과가 없습니다.</h3>
                <p className="text-xs text-muted-foreground">채널 이름을 입력하고 검색해 주세요! 🔍</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {searchedChannels.map((channel) => (
                  <div key={channel.id} className="group bg-background border border-border rounded-3xl p-5 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
                    
                    <div className="flex gap-4 mb-5">
                      <Avatar className="w-14 h-14 rounded-2xl border border-border/50 shrink-0">
                        <AvatarImage src={channel.image_url || undefined} className="object-cover" />
                        <AvatarFallback className="rounded-2xl bg-muted font-bold text-lg">{channel.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-base truncate">{channel.name}</h4>
                          <Badge variant="outline" className="bg-purple-500/5 text-purple-600 border-purple-500/10 text-[9px] font-bold py-0.5 px-1.5 shrink-0 select-none">
                            {channel.type === "youtuber" ? "유튜버" : channel.type === "festival" ? "축제" : "게임"}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-xs font-semibold text-muted-foreground">
                          {/* Owner Profile */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] uppercase text-muted-foreground/60 w-12 shrink-0">소유주:</span>
                            {channel.owner_id ? (
                              <span className="text-foreground/90 font-bold bg-muted/60 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                                {channel.ownerNickname || "알 수 없는 사용자"}
                              </span>
                            ) : (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-extrabold select-none">
                                🔓 소유주 없음 (회사 소유)
                              </Badge>
                            )}
                          </div>
                          
                          {/* Associated Company */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] uppercase text-muted-foreground/60 w-12 shrink-0">회사 소속:</span>
                            {channel.company ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-orange-500 font-bold bg-orange-500/5 border border-orange-500/10 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                                  🏢 {channel.company}
                                </span>
                                <button
                                  onClick={() => handleDisconnectCompany(channel.id, channel.name)}
                                  className="text-[10px] font-bold text-red-500 hover:underline shrink-0 ml-1"
                                >
                                  해제
                                </button>
                              </div>
                            ) : (
                              <span className="italic font-normal text-muted-foreground/50">소속 없음</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions Panel */}
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40">
                      {/* Owner actions */}
                      {channel.owner_id ? (
                        <Button
                          variant="outline"
                          onClick={() => handleDisconnectOwner(channel.id, channel.name, channel.owner_id)}
                          className="w-full h-9 font-bold border-orange-200 hover:bg-orange-50 text-orange-600 dark:border-orange-950/40 dark:hover:bg-orange-950/20 rounded-xl text-xs whitespace-nowrap flex items-center justify-center gap-1 transition-all"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          소유주 끊기
                        </Button>
                      ) : (
                        <div className="relative w-full">
                          {connectingChannelId === channel.id ? (
                            <div className="flex items-center gap-1 w-full">
                              <select
                                value={selectedCompanyForChannel}
                                onChange={(e) => setSelectedCompanyForChannel(e.target.value)}
                                className="w-full bg-background border border-border/80 rounded-xl px-2 h-9 text-[10px] font-bold focus:outline-none focus:border-primary text-center"
                              >
                                <option value="none">회사 선택...</option>
                                {companiesList.map((comp) => (
                                  <option key={comp.id} value={comp.name}>
                                    {comp.name}
                                  </option>
                                ))}
                              </select>
                              <Button
                                onClick={() => handleConnectCompany(channel.id)}
                                size="sm"
                                className="h-9 px-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] shrink-0 font-bold"
                              >
                                연결
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setConnectingChannelId(null);
                                  setSelectedCompanyForChannel("none");
                                }}
                                size="sm"
                                className="h-9 px-2 border-border hover:bg-muted text-muted-foreground rounded-xl text-[10px] shrink-0 font-bold"
                              >
                                취소
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setConnectingChannelId(channel.id);
                                setSelectedCompanyForChannel("none");
                              }}
                              className="w-full h-9 font-bold border-emerald-200 hover:bg-emerald-50 text-emerald-600 dark:border-emerald-950/40 dark:hover:bg-emerald-950/20 rounded-xl text-xs whitespace-nowrap flex items-center justify-center gap-1 transition-all"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              회사 연결
                            </Button>
                          )}
                        </div>
                      )}
                      
                      {/* Force Delete Channel */}
                      <Button
                        onClick={() => handleDeleteChannel(channel.id, channel.name)}
                        disabled={connectingChannelId === channel.id}
                        className="w-full h-9 font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs whitespace-nowrap flex items-center justify-center gap-1 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        채널 강제 삭제
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "posters" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background border border-border/60 rounded-3xl p-5 shadow-sm">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">홈 화면 포스터 배너 관리</h3>
                <p className="text-xs text-muted-foreground mt-0.5">결제가 완료된 공식 배너 목록 및 실시간 게재 상태를 조율합니다.</p>
              </div>
              <Button 
                onClick={() => router.push("/ad-apply")}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs h-9 px-4 shrink-0 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> 신규 광고 직접 등록
              </Button>
            </div>

            {/* 1. Live Banner Slots Monitor (실시간 노출 중인 배너 모니터링) */}
            {!isLoadingPosters && (
              <div className="bg-background border border-border/60 rounded-3xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 select-none">
                      실시간 게재 배너 슬롯 모니터
                      <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full ml-1">
                        {posters.filter(p => p.is_active).length}개 활성화
                      </span>
                    </h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-semibold select-none">메인 슬라이더 실제 게재 배너 순서</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {/* Render actually active banners in sequential order */}
                  {posters
                    .filter(p => p.is_active)
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((poster, index) => (
                      <div 
                        key={poster.id} 
                        className="group relative aspect-[21/9] rounded-2xl overflow-hidden border border-border bg-muted/30 shadow-xs transition-all duration-300 hover:shadow-md hover:border-orange-500/30"
                      >
                        {poster.image_url ? (
                          <img 
                            src={poster.image_url} 
                            alt={poster.advertiser_name || "배너"} 
                            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground/60 font-semibold select-none">
                            이미지 없음
                          </div>
                        )}
                        {/* Number Badge */}
                        <div className="absolute top-2 left-2 bg-orange-500 text-white font-black text-[10px] rounded-lg w-5 h-5 flex items-center justify-center shadow-xs border border-orange-400/20 select-none">
                          {index + 1}
                        </div>
                        {/* Advertiser Badge Overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-1.5 pt-4 flex flex-col justify-end select-none">
                          <p className="text-[9.5px] font-extrabold text-white truncate drop-shadow-xs">
                            {poster.advertiser_name || "공식 배너"}
                          </p>
                          <p className="text-[7.5px] font-bold text-white/60 truncate drop-shadow-xs">
                            ~ {poster.end_date ? poster.end_date.slice(5) : "상시"}
                          </p>
                        </div>
                      </div>
                    ))}

                  {/* Dynamic Add Placeholder Slot (Always active as an appender) */}
                  <div 
                    onClick={() => router.push("/ad-apply")}
                    className="group relative aspect-[21/9] rounded-2xl border-2 border-dashed border-border/80 hover:border-orange-500/50 hover:bg-orange-500/[0.01] transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center p-2 select-none"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-orange-500 group-hover:scale-110 transition-all duration-300 animate-pulse" />
                    <span className="text-[9px] font-bold text-muted-foreground/80 group-hover:text-orange-500 transition-colors mt-1 select-none">
                      새 배너 슬롯 추가
                    </span>
                  </div>
                </div>
              </div>
            )}


            {isLoadingPosters ? (
              <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-orange-500" />
                <p>배너 정보를 읽어오는 중...</p>
              </div>
            ) : posters.length === 0 ? (
              <div className="py-20 border border-dashed border-border rounded-3xl bg-background/50 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 text-muted-foreground/40">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-1">등록된 포스터가 없습니다.</h3>
                <p className="text-xs text-muted-foreground">신규 광고 배너를 등록하여 마케팅 영역을 활성화해보세요! 🚀</p>
              </div>
            ) : (
              <div className="space-y-10">
                {activePosters.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <h3 className="text-lg font-bold">실시간 노출 중인 배너</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {activePosters.map(renderPosterCard)}
                    </div>
                  </div>
                )}
                
                {upcomingPosters.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <h3 className="text-lg font-bold">노출 예정 배너</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-80">
                      {upcomingPosters.map(renderPosterCard)}
                    </div>
                  </div>
                )}
                
                {pastPosters.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                      <h3 className="text-lg font-bold text-muted-foreground">노출 종료된 배너</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 grayscale-[50%] hover:grayscale-0 transition-all">
                      {pastPosters.map(renderPosterCard)}
                    </div>
                  </div>
                )}
                
                {hiddenPosters.length > 0 && (
                  <div className="space-y-4 mt-8 pt-8 border-t border-border/40">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <h3 className="text-lg font-bold text-red-500">강제 숨김된 배너</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-50 grayscale hover:grayscale-0 transition-all">
                      {hiddenPosters.map(renderPosterCard)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Premium Glassmorphic User Ban Overlay Modal */}
      {banningUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050505]/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-2xl rounded-3xl w-full max-w-md overflow-hidden transform scale-95 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-foreground">유저 댓글 기능 차단</h3>
                  <p className="text-xs text-muted-foreground">이름: <strong className="text-foreground">{banningNickname}</strong></p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Ban Type & Duration */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">차단 형태</label>
                <div className="flex items-center gap-4 bg-muted/30 border border-border/50 rounded-2xl p-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                    <input
                      type="checkbox"
                      checked={banPermanent}
                      onChange={(e) => setBanPermanent(e.target.checked)}
                      className="w-4 h-4 rounded text-primary border-border bg-background focus:ring-primary focus:ring-offset-background"
                    />
                    영구 차단
                  </label>
                  {!banPermanent && (
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">차단 일수:</span>
                      <input
                        type="number"
                        min={1}
                        value={banDays}
                        onChange={(e) => setBanDays(parseInt(e.target.value) || 1)}
                        className="w-full bg-background border border-border/80 rounded-xl px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-primary text-center"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">일</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ban Reason */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">차단 사유</label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="차단 사유를 상세하게 입력해주세요."
                  className="w-full h-24 bg-background border border-border rounded-2xl p-3 text-sm focus:outline-none focus:border-primary resize-none placeholder:text-muted-foreground/60 leading-relaxed font-semibold"
                />
              </div>
            </div>

            <div className="p-6 bg-muted/10 border-t border-border/60 flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setBanningUserId(null);
                  setBanReason("커뮤니티 가이드라인 위반");
                  setBanDays(7);
                  setBanPermanent(false);
                }}
                disabled={isSubmittingBan}
                className="flex-1 h-11 font-bold border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl"
              >
                취소
              </Button>
              <Button
                onClick={handleCreateBan}
                disabled={isSubmittingBan}
                className="flex-1 h-11 font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
              >
                {isSubmittingBan ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "차단 적용"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
