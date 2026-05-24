"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, CornerDownRight, ChevronDown, ChevronUp, Loader2, MoreVertical, Pencil, Trash, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Comment {
  id: number;
  created_at: string;
  user_id: string;
  content: string;
  event_id: number | null;
  notice_id: number | null;
  parent_id: number | null;
  nickname: string;
  avatarUrl: string;
}

interface CommentsSectionProps {
  eventId?: number;
  noticeId?: number;
  isOrganizer: boolean;
  user: User | null;
}

export function CommentsSection({
  eventId,
  noticeId,
  isOrganizer,
  user
}: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCommentText, setNewCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 대댓글 관련 상태
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [expandedCommentIds, setExpandedCommentIds] = useState<Record<number, boolean>>({});
  // Editing comment state
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editText, setEditText] = useState<string>('');

  // 신고 관련 상태
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportingCommentId, setReportingCommentId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState<string>("스팸 / 광고");
  const [reportDetails, setReportDetails] = useState<string>("");
  const [isReporting, setIsReporting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 차단 관련 상태
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState<{ reason: string | null; banned_until: string | null; ban_type: string } | null>(null);

  const searchParams = useSearchParams();
  const commentIdParam = searchParams?.get("comment_id");

  useEffect(() => {
    setMounted(true);
  }, []);

  const checkUserBanStatus = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("comment_bans")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (error) throw error;

      if (data && data.length > 0) {
        const now = new Date();
        const activeBan = data.find(ban => {
          if (ban.ban_type === "permanent") return true;
          if (ban.ban_type === "temporary" && ban.banned_until) {
            return new Date(ban.banned_until) > now;
          }
          return false;
        });

        if (activeBan) {
          setIsBanned(true);
          setBanInfo({
            reason: activeBan.reason,
            banned_until: activeBan.banned_until,
            ban_type: activeBan.ban_type
          });
          return;
        }
      }
      setIsBanned(false);
      setBanInfo(null);
    } catch (err) {
      console.error("Check user ban status error:", err);
    }
  };

  useEffect(() => {
    if (user) {
      checkUserBanStatus();
    } else {
      setIsBanned(false);
      setBanInfo(null);
    }
  }, [user]);

  // comment_id 파라미터 기반 딥 링크 및 포커스 하이라이트 애니메이션
  useEffect(() => {
    if (commentIdParam && comments.length > 0) {
      const cid = Number(commentIdParam);
      const targetComment = comments.find(c => c.id === cid);
      if (targetComment) {
        if (targetComment.parent_id) {
          setExpandedCommentIds(prev => ({ ...prev, [targetComment.parent_id!]: true }));
        }

        setTimeout(() => {
          const element = document.getElementById(`comment-${cid}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.classList.add("bg-amber-500/10", "dark:bg-amber-500/20", "p-2.5", "rounded-2xl", "ring-1", "ring-amber-500/30");
            setTimeout(() => {
              element.classList.remove("bg-amber-500/10", "dark:bg-amber-500/20", "ring-1", "ring-amber-500/30");
            }, 3000);
          }
        }, 500);
      }
    }
  }, [commentIdParam, comments]);

  const handleReportComment = async () => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return;
    }
    if (!reportingCommentId) return;

    setIsReporting(true);
    try {
      const { error } = await supabase.from("comment_reports").insert([
        {
          user_id: user.id,
          comment_id: reportingCommentId,
          reason: reportReason,
          details: reportDetails.trim() || null,
        },
      ]);

      if (error) throw error;

      toast.success("신고가 정상적으로 접수되었습니다. 감사합니다.");
      setIsReportModalOpen(false);
      setReportingCommentId(null);
      setReportReason("스팸 / 광고");
      setReportDetails("");
    } catch (err: any) {
      console.error("Report comment error:", err);
      toast.error("신고 접수에 실패했습니다.");
    } finally {
      setIsReporting(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "방금 전";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}시간 전`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}일 전`;
    
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric"
    });
  };

  const fetchCommentsAndProfiles = async () => {
    try {
      let query = supabase.from("comments").select("*");
      if (eventId) {
        query = query.eq("event_id", eventId).is("notice_id", null);
      } else if (noticeId) {
        query = query.eq("notice_id", noticeId).is("event_id", null);
      }

      const { data: commentsData, error: commentsErr } = await query.order("created_at", { ascending: true });
      if (commentsErr) throw commentsErr;

      const rawComments = commentsData || [];

      // Fetch profiles for unique user_ids
      const userIds = Array.from(new Set(rawComments.map(c => c.user_id)));
      let profilesMap: Record<string, { nickname: string; avatar_url: string }> = {};

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesErr } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url")
          .in("id", userIds);

        if (!profilesErr && profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = {
              nickname: p.nickname || "사용자",
              avatar_url: p.avatar_url || ""
            };
          });
        }
      }

      // Map profiles to comments
      const mappedComments = rawComments.map(c => ({
        ...c,
        nickname: profilesMap[c.user_id]?.nickname || "탈퇴한 사용자",
        avatarUrl: profilesMap[c.user_id]?.avatar_url || ""
      }));

      setComments(mappedComments);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchCommentsAndProfiles();
  }, [eventId, noticeId]);

  // 이 댓글에 대한 대댓글 필터링
  const getReplies = (parentId: number) => {
    return comments.filter(c => c.parent_id === parentId);
  };

  // 대댓글 토글
  const toggleReplies = (commentId: number) => {
    setExpandedCommentIds(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  // 댓글/대댓글 등록
  const handleSubmitComment = async (parentId: number | null = null) => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return;
    }

    const text = parentId ? replyText : newCommentText;
    if (!text.trim()) {
      toast.error("댓글 내용을 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const insertData = {
        user_id: user.id,
        content: text.trim(),
        event_id: eventId || null,
        notice_id: noticeId || null,
        parent_id: parentId
      };

      const { error } = await supabase.from("comments").insert([insertData]);
      if (error) throw error;

      toast.success("댓글이 등록되었습니다.");
      
      // 입력 폼 청소
      if (parentId) {
        setReplyText("");
        setReplyTargetId(null);
        // 답글 등록 시 자동으로 해당 대댓글 리스트 열어두기
        setExpandedCommentIds(prev => ({ ...prev, [parentId]: true }));
      } else {
        setNewCommentText("");
      }

      // 새로고침
      await fetchCommentsAndProfiles();
    } catch (err: any) {
      console.error("Submit comment error:", err);
      toast.error("댓글 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId: number) => {
    if (!confirm("정말 이 댓글을 삭제하시겠습니까?")) return;

    try {
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;

      toast.success("댓글이 삭제되었습니다.");
      await fetchCommentsAndProfiles();
    } catch (err: any) {
      console.error("Delete comment error:", err);
      toast.error("댓글 삭제에 실패했습니다.");
    }
  };

  // 댓글 수정 업데이트
  const handleUpdateComment = async (commentId: number) => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return;
    }
    if (!editText.trim()) {
      toast.error("댓글 내용을 입력해 주세요.");
      return;
    }
    try {
      const { error } = await supabase
        .from("comments")
        .update({ content: editText.trim() })
        .eq("id", commentId);
      if (error) throw error;
      toast.success("댓글이 수정되었습니다.");
      // Reset editing state
      setEditingCommentId(null);
      setEditText('');
      await fetchCommentsAndProfiles();
    } catch (err: any) {
      console.error("Update comment error:", err);
      toast.error("댓글 수정에 실패했습니다.");
    }
  };

  // 루트 댓글만 필터링
  const rootComments = comments.filter(c => c.parent_id === null);
  const totalCommentsCount = comments.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/60" />
        <span className="text-sm font-semibold select-none">댓글을 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-text">
      {/* Header & Count */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-3">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h3 className="text-base font-extrabold text-foreground">
          댓글 <span className="text-primary">{totalCommentsCount}</span>
        </h3>
      </div>

      {/* Comment Input Area */}
      <div className="flex gap-3">
        <Avatar className="w-10 h-10 border shadow-xs shrink-0 select-none">
          <AvatarImage src={user?.user_metadata?.avatar_url || undefined} className="object-cover" />
          <AvatarFallback className="font-bold text-xs bg-muted">
            {user ? (user.user_metadata?.name || user.email || "U").slice(0,1).toUpperCase() : "?"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2">
          {user ? (
            isBanned ? (
              <div className="min-h-[80px] w-full rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-4 text-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-rose-600 dark:text-rose-400 font-semibold select-none animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                  <div>
                    <p className="text-sm font-bold">댓글 작성이 제한된 계정입니다</p>
                    <p className="text-xs text-rose-500/80 font-medium mt-0.5 leading-relaxed">
                      사유: {banInfo?.reason || "커뮤니티 가이드라인 위반"}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-rose-500/80 shrink-0 font-bold bg-rose-500/10 px-3 py-1.5 rounded-xl self-start md:self-auto">
                  {banInfo?.ban_type === "permanent" 
                    ? "영구 정지" 
                    : `제한 완료일: ${new Date(banInfo?.banned_until!).toLocaleDateString("ko-KR")} ${new Date(banInfo?.banned_until!).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`}
                </div>
              </div>
            ) : (
              <>
                <Textarea
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  placeholder="댓글 올리기"
                  className="min-h-[80px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none font-medium leading-relaxed"
                  maxLength={1000}
                />
                <div className="flex justify-end select-none">
                  <Button
                    onClick={() => handleSubmitComment(null)}
                    disabled={isSubmitting || !newCommentText.trim()}
                    className="rounded-xl px-5 h-9 font-semibold text-xs transition-all shadow-xs"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    등록
                  </Button>
                </div>
              </>
            )
          ) : (
            <div 
              onClick={() => toast.info("댓글 작성을 위해 로그인이 필요합니다.")}
              className="min-h-[80px] w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground flex items-center justify-center cursor-pointer select-none font-semibold hover:bg-muted/50 transition-colors"
            >
              로그인 후 댓글을 작성해 보세요.
            </div>
          )}
        </div>
      </div>

      {/* Comments List */}
      {rootComments.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm font-semibold select-none">
          첫 번째 댓글을 남겨보세요!
        </div>
      ) : (
        <div className="space-y-5">
          {rootComments.map(comment => {
            const replies = getReplies(comment.id);
            const isExpanded = !!expandedCommentIds[comment.id];
            const isReplying = replyTargetId === comment.id;
            const canDeleteRoot = user && (comment.user_id === user.id || isOrganizer);

            return (
              <div key={comment.id} id={`comment-${comment.id}`} className="space-y-3.5 transition-all duration-300">
                {/* Root Comment Row */}
                <div className="flex gap-3">
                  <Avatar className="w-9 h-9 border shadow-xs shrink-0 select-none">
                    <AvatarImage src={comment.avatarUrl || undefined} className="object-cover bg-muted" />
                    <AvatarFallback className="font-bold text-xs">{comment.nickname.slice(0, 1)}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between select-none">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground truncate max-w-[120px] sm:max-w-none">{comment.nickname}</span>
                        {comment.user_id === user?.id && (
                          <span className="text-[9px] bg-primary/10 text-primary font-black px-1 py-0.5 rounded">본인</span>
                        )}
                        <span className="text-[10px] text-muted-foreground/60 font-semibold">{formatRelativeTime(comment.created_at)}</span>
                      </div>

                      {/* Dropdown Menu for Root Comment */}
                      {user && editingCommentId !== comment.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-muted select-none shrink-0">
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                              <span className="sr-only">댓글 옵션</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-28 rounded-xl p-1 shadow-md border bg-popover text-popover-foreground">
                            {comment.user_id === user?.id && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingCommentId(comment.id);
                                  setEditText(comment.content);
                                }}
                                className="flex items-center gap-2 px-2.5 py-2 text-xs font-bold cursor-pointer rounded-lg focus:bg-muted"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>수정하기</span>
                              </DropdownMenuItem>
                            )}
                            {canDeleteRoot && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteComment(comment.id)}
                                className="flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-rose-500 focus:text-rose-500 cursor-pointer rounded-lg focus:bg-rose-500/10"
                              >
                                <Trash className="w-3.5 h-3.5 text-rose-500" />
                                <span>삭제하기</span>
                              </DropdownMenuItem>
                            )}
                            {comment.user_id !== user?.id && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setReportingCommentId(comment.id);
                                  setIsReportModalOpen(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-amber-600 focus:text-amber-600 cursor-pointer rounded-lg focus:bg-amber-500/10"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                <span>신고하기</span>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {editingCommentId === comment.id ? (
                      <div className="flex flex-col gap-2 mt-1">
                        <Textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          placeholder="댓글을 수정하세요..."
                          className="min-h-[60px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none font-medium leading-relaxed"
                          maxLength={1000}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            onClick={() => { setEditingCommentId(null); setEditText(''); }}
                            className="rounded-lg h-7 px-3 text-xs font-bold text-muted-foreground hover:bg-muted"
                          >
                            취소
                          </Button>
                          <Button
                            onClick={() => handleUpdateComment(comment.id)}
                            disabled={isSubmitting || !editText.trim()}
                            className="rounded-lg h-7 px-3 text-xs font-semibold transition-all shadow-xs"
                          >
                            저장
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-medium leading-relaxed break-words text-foreground/90 mt-1 select-text">{comment.content}</p>
                    )}

                    {/* Actions Row */}
                    {user && !isBanned && (
                      <div className="flex items-center gap-3 mt-2 text-xs font-bold text-muted-foreground select-none">
                        <button
                          onClick={() => {
                            if (isReplying) {
                              setReplyTargetId(null);
                              setReplyText("");
                            } else {
                              setReplyTargetId(comment.id);
                              setReplyText("");
                            }
                          }}
                          className="hover:text-foreground transition-colors cursor-pointer"
                        >
                          답글
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reply Input Form (Only for this comment) */}
                {isReplying && user && (
                  <div className="flex gap-2 pl-9 animate-in slide-in-from-top-1 duration-200 select-none">
                    <Avatar className="w-7 h-7 border shadow-xs shrink-0">
                      <AvatarImage src={user.user_metadata?.avatar_url || undefined} className="object-cover" />
                      <AvatarFallback className="text-[10px] font-bold bg-muted">
                        {(user.user_metadata?.name || user.email || "U").slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="답글을 남겨보세요..."
                        className="min-h-[50px] w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none font-medium leading-relaxed"
                        maxLength={1000}
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setReplyTargetId(null);
                            setReplyText("");
                          }}
                          className="rounded-lg h-7 px-3 text-[10px] font-bold text-muted-foreground hover:bg-muted"
                        >
                          취소
                        </Button>
                        <Button
                          onClick={() => handleSubmitComment(comment.id)}
                          disabled={isSubmitting || !replyText.trim()}
                          className="rounded-lg h-7 px-3 text-[10px] font-semibold transition-all shadow-xs"
                        >
                          등록
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Replies Toggle & Count (YouTube Style) */}
                {replies.length > 0 && (
                  <div className="pl-9 select-none">
                    <button
                      onClick={() => toggleReplies(comment.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-extrabold text-primary hover:text-primary/80 transition-colors py-1 cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>답글 {replies.length}개 {isExpanded ? "접기" : "보기"}</span>
                    </button>
                  </div>
                )}

                {/* Sub Replies List */}
                {replies.length > 0 && isExpanded && (
                  <div className="pl-9 space-y-4 pt-1 animate-in slide-in-from-top-1 duration-200">
                    {replies.map(reply => {
                      const canDeleteReply = user && (reply.user_id === user.id || isOrganizer);

                      return (
                        <div key={reply.id} id={`comment-${reply.id}`} className="flex gap-2.5 transition-all duration-300">
                          {/* Corner icon indicating nest */}
                          <CornerDownRight className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-1 select-none" />

                          <Avatar className="w-7 h-7 border shadow-xs shrink-0 select-none">
                            <AvatarImage src={reply.avatarUrl || undefined} className="object-cover bg-muted" />
                            <AvatarFallback className="font-bold text-[10px]">{reply.nickname.slice(0, 1)}</AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between select-none">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-foreground truncate max-w-[100px] sm:max-w-none">{reply.nickname}</span>
                                {reply.user_id === user?.id && (
                                  <span className="text-[8px] bg-primary/10 text-primary font-black px-1 py-0.2 rounded">본인</span>
                                )}
                                <span className="text-[9px] text-muted-foreground/60 font-semibold">{formatRelativeTime(reply.created_at)}</span>
                              </div>

                              {/* Dropdown Menu for Sub Reply */}
                              {user && editingCommentId !== reply.id && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-7 w-7 p-0 rounded-full hover:bg-muted select-none shrink-0">
                                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span className="sr-only">답글 옵션</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-28 rounded-xl p-1 shadow-md border bg-popover text-popover-foreground">
                                    {reply.user_id === user?.id && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setEditingCommentId(reply.id);
                                          setEditText(reply.content);
                                        }}
                                        className="flex items-center gap-2 px-2.5 py-2 text-xs font-bold cursor-pointer rounded-lg focus:bg-muted"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                        <span>수정하기</span>
                                      </DropdownMenuItem>
                                    )}
                                    {canDeleteReply && (
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteComment(reply.id)}
                                        className="flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-rose-500 focus:text-rose-500 cursor-pointer rounded-lg focus:bg-rose-500/10"
                                      >
                                        <Trash className="w-3.5 h-3.5 text-rose-500" />
                                        <span>삭제하기</span>
                                      </DropdownMenuItem>
                                    )}
                                    {reply.user_id !== user?.id && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setReportingCommentId(reply.id);
                                          setIsReportModalOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-amber-600 focus:text-amber-600 cursor-pointer rounded-lg focus:bg-amber-500/10"
                                      >
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                        <span>신고하기</span>
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>

                            {editingCommentId === reply.id ? (
                              <div className="flex flex-col gap-2 mt-1">
                                <Textarea
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                  placeholder="답글을 수정하세요..."
                                  className="min-h-[50px] w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none font-medium leading-relaxed"
                                  maxLength={1000}
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="ghost"
                                    onClick={() => { setEditingCommentId(null); setEditText(''); }}
                                    className="rounded-lg h-6 px-2.5 text-[10px] font-bold text-muted-foreground hover:bg-muted"
                                  >
                                    취소
                                  </Button>
                                  <Button
                                    onClick={() => handleUpdateComment(reply.id)}
                                    disabled={isSubmitting || !editText.trim()}
                                    className="rounded-lg h-6 px-2.5 text-[10px] font-semibold transition-all shadow-xs"
                                  >
                                    저장
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs font-medium leading-relaxed break-words text-foreground/90 mt-1 select-text">
                                {reply.content}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 신고 모달 창 */}
      {mounted && isReportModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200 select-none">
          <div className="bg-background border border-border rounded-3xl w-full max-w-sm md:max-w-xl lg:max-w-2xl p-6 md:p-10 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="w-6 h-6 md:w-7 md:h-7" />
              <h3 className="text-base md:text-xl font-extrabold text-foreground">댓글 신고하기</h3>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              이 댓글을 신고하는 이유를 선택해 주세요. 신고된 내용은 관리자의 검토를 통해 신속하게 처리됩니다.
            </p>

            {/* 신고 사유 선택 (세로 1열 리스트 형태) */}
            <div className="flex flex-col gap-3 md:gap-4.5 pt-1">
              {["스팸 / 광고", "욕설 / 비하 / 혐오 발언", "음란물 / 유해 콘텐츠", "불쾌한 콘텐츠 / 도배", "기타 사유"].map((reason) => (
                <label key={reason} className="flex items-center gap-3 cursor-pointer text-xs md:text-sm font-bold text-foreground/80 hover:text-foreground">
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reportReason === reason}
                    onChange={() => setReportReason(reason)}
                    className="accent-primary w-4.5 h-4.5 cursor-pointer"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {/* 상세 설명 */}
            <div className="space-y-2 pt-1">
              <label className="text-[10px] md:text-xs font-black text-muted-foreground uppercase tracking-wider">상세 사유 (선택)</label>
              <Textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="관리자가 정확하게 판단할 수 있도록 구체적인 사유를 자유롭게 작성해 주세요."
                className="min-h-[80px] md:min-h-[130px] text-xs md:text-sm rounded-xl p-3 md:p-4 resize-none border border-border focus:ring-1 focus:ring-primary/40 font-medium leading-relaxed"
                maxLength={500}
              />
            </div>

            {/* 버튼들 */}
            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsReportModalOpen(false);
                  setReportingCommentId(null);
                  setReportReason("스팸 / 광고");
                  setReportDetails("");
                }}
                className="rounded-xl h-9 md:h-11 px-4 md:px-6 text-xs md:text-sm font-bold text-muted-foreground hover:bg-muted"
                disabled={isReporting}
              >
                취소
              </Button>
              <Button
                onClick={handleReportComment}
                className="rounded-xl h-9 md:h-11 px-4 md:px-6 text-xs md:text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                disabled={isReporting}
              >
                {isReporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                신고 제출
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
