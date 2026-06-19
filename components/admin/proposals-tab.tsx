"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Tv2,
  CalendarDays,
  Plus,
  Trash2,
  Search,
  MapPin,
  X,
  Check,
} from "lucide-react";

interface ProposalsTabProps {
  adminUserId: string | null;
}

export function ProposalsTab({ adminUserId }: ProposalsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"channels" | "events">("channels");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  
  const [channelProposals, setChannelProposals] = useState<any[]>([]);
  const [eventProposals, setEventProposals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals for editing before final approval
  const [editingChannel, setEditingChannel] = useState<any | null>(null);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);

  // Search host channel state (for event approval without pre-linked channel proposal)
  const [modalChannelSearch, setModalChannelSearch] = useState("");
  const [modalChannelResults, setModalChannelResults] = useState<any[]>([]);
  const [modalSelectedChannel, setModalSelectedChannel] = useState<any | null>(null);
  const [isSearchingModalChannels, setIsSearchingModalChannels] = useState(false);

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch channel proposals
      const { data: chanData, error: chanErr } = await supabase
        .from("channel_proposals")
        .select("*")
        .order("created_at", { ascending: false });

      if (chanErr) throw chanErr;

      // 2. Fetch event proposals with related channel proposals
      const { data: eventData, error: eventErr } = await supabase
        .from("event_proposals")
        .select(`
          *,
          channel_proposals:channel_proposal_id ( id, name, type, status, approved_channel_id )
        `)
        .order("created_at", { ascending: false });

      if (eventErr) throw eventErr;

      // 3. Extract unique user_ids and fetch profiles mapping
      const userIds = Array.from(new Set([
        ...(chanData || []).map((c: any) => c.user_id),
        ...(eventData || []).map((e: any) => e.user_id)
      ].filter(Boolean)));

      const profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profData, error: profErr } = await supabase
          .from("profiles")
          .select("id, nickname")
          .in("id", userIds);

        if (!profErr && profData) {
          profData.forEach((p: any) => {
            profilesMap[p.id] = p.nickname;
          });
        }
      }

      // 4. Map profiles into the returned datasets
      const formattedChannels = (chanData || []).map((c: any) => ({
        ...c,
        profiles: c.user_id ? { nickname: profilesMap[c.user_id] || "알 수 없음" } : null
      }));

      const formattedEvents = (eventData || []).map((e: any) => ({
        ...e,
        profiles: e.user_id ? { nickname: profilesMap[e.user_id] || "알 수 없음" } : null
      }));

      setChannelProposals(formattedChannels);
      setEventProposals(formattedEvents);
    } catch (err: any) {
      console.error("Error fetching proposals:", err);
      toast.error("제안 목록을 가져오는 데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Channel Proposal Handlers ---
  const handleOpenApproveChannel = (proposal: any) => {
    // Clone and parse links
    const parsedLinks = typeof proposal.links === "string" 
      ? JSON.parse(proposal.links) 
      : (proposal.links || []);
    
    setEditingChannel({
      ...proposal,
      linksForm: parsedLinks.length > 0 ? parsedLinks.map((l: any, i: number) => ({ id: i.toString(), name: l.name, url: l.url })) : [{ id: "default", name: "", url: "" }]
    });
  };

  const handleApproveChannelConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel) return;

    try {
      const formattedLinks = editingChannel.linksForm
        .filter((l: any) => l.name.trim() || l.url.trim())
        .map((l: any) => ({ name: l.name.trim(), url: l.url.trim() }));

      // 1. Insert new channel - Lock owner_id = null and company = '아웃덕'
      const { data: newChan, error: insertErr } = await supabase
        .from("channels")
        .insert([{
          name: editingChannel.name.trim(),
          type: editingChannel.type,
          image_url: editingChannel.image_url || null,
          is_team: false,
          team_id: null,
          owner_id: null, // Lock to null
          company: "아웃덕", // Lock to '아웃덕'
          links: formattedLinks.length > 0 ? formattedLinks : null
        }])
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      // 2. Update channel proposal state
      const { error: updateErr } = await supabase
        .from("channel_proposals")
        .update({
          status: "approved",
          approved_channel_id: newChan.id,
          name: editingChannel.name.trim(),
          type: editingChannel.type,
          image_url: editingChannel.image_url || null,
          links: formattedLinks.length > 0 ? formattedLinks : null
        })
        .eq("id", editingChannel.id);

      if (updateErr) throw updateErr;

      toast.success("채널 승인 및 등록이 완료되었습니다!");
      setEditingChannel(null);
      fetchProposals();
    } catch (err: any) {
      console.error("Approve channel error:", err);
      toast.error("채널 승인 처리 중 오류 발생: " + err.message);
    }
  };

  const handleRejectChannel = async (proposalId: number) => {
    if (!confirm("정말 이 채널 제안을 거절하시겠습니까?\n연결된 대기 중인 행사 제보도 함께 거절 처리됩니다.")) return;
    try {
      const { error } = await supabase
        .from("channel_proposals")
        .update({ status: "rejected" })
        .eq("id", proposalId);

      if (error) throw error;
      toast.success("채널 제안을 거절 처리했습니다.");
      fetchProposals();
    } catch (err: any) {
      console.error("Reject channel error:", err);
      toast.error("거절 처리 중 오류 발생: " + err.message);
    }
  };

  const handleDeleteChannelProposal = async (proposalId: number) => {
    if (!confirm("이 제안 기록을 데이터베이스에서 완전히 삭제하시겠습니까?")) return;
    try {
      const { error } = await supabase
        .from("channel_proposals")
        .delete()
        .eq("id", proposalId);

      if (error) throw error;
      toast.success("제안 기록이 삭제되었습니다.");
      fetchProposals();
    } catch (err: any) {
      console.error("Delete channel proposal error:", err);
      toast.error("기록 삭제에 실패했습니다.");
    }
  };

  // --- Event Proposal Handlers ---
  const handleOpenApproveEvent = (proposal: any) => {
    // Parse links and location data
    const parsedLinks = typeof proposal.links === "string"
      ? JSON.parse(proposal.links)
      : (proposal.links || {});
    const parsedLocations = typeof proposal.locations === "string"
      ? JSON.parse(proposal.locations)
      : (proposal.locations || []);

    const linksForm = Object.entries(parsedLinks).map(([name, url]: any) => ({
      name,
      url
    }));

    setEditingEvent({
      ...proposal,
      linksForm: linksForm.length > 0 ? linksForm : [{ name: "", url: "" }],
      locationsForm: parsedLocations,
      locationInput: ""
    });

    setModalSelectedChannel(null);
    setModalChannelSearch("");
    setModalChannelResults([]);
  };

  // Autocomplete search inside event approval modal
  useEffect(() => {
    if (modalChannelSearch.trim().length < 2) {
      setModalChannelResults([]);
      return;
    }
    const searchTimeout = setTimeout(async () => {
      setIsSearchingModalChannels(true);
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, image_url, type")
        .ilike("name", `%${modalChannelSearch}%`)
        .limit(5);

      if (!error && data) {
        setModalChannelResults(data);
      }
      setIsSearchingModalChannels(false);
    }, 400);

    return () => clearTimeout(searchTimeout);
  }, [modalChannelSearch]);

  const handleApproveEventConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    // Determine host channel ID
    let hostChanId: number | null = null;
    if (editingEvent.channel_proposal_id) {
      // Fetch current status of channel proposal to check DB trigger condition
      const { data: chProp, error: chPropErr } = await supabase
        .from("channel_proposals")
        .select("status, approved_channel_id")
        .eq("id", editingEvent.channel_proposal_id)
        .single();
      
      if (chPropErr) {
        toast.error("연결된 채널 제안을 확인하지 못했습니다.");
        return;
      }

      if (chProp.status !== "approved" || !chProp.approved_channel_id) {
        toast.error("연결된 채널 제안이 아직 승인되지 않았습니다. 채널 승인을 먼저 진행해주세요.");
        return;
      }
      hostChanId = chProp.approved_channel_id;
    } else {
      if (!modalSelectedChannel) {
        toast.error("행사를 연동할 주최 채널을 검색하여 지정해 주세요.");
        return;
      }
      hostChanId = modalSelectedChannel.id;
    }

    try {
      // 1. Create base events entry
      const { data: baseEvent, error: baseErr } = await supabase
        .from("events")
        .insert({
          is_offline: editingEvent.is_offline,
          is_online: editingEvent.is_online
        })
        .select("id")
        .single();

      if (baseErr) throw baseErr;

      // 2. Create event_channels entry
      const { error: chErr } = await supabase
        .from("event_channels")
        .insert([{
          event_id: baseEvent.id,
          channel_id: hostChanId
        }]);

      if (chErr) throw chErr;

      // 3. Insert specific offline / online event details
      const finalLinks: Record<string, string> = {};
      editingEvent.linksForm.forEach((l: any) => {
        if (l.name.trim() && l.url.trim()) {
          finalLinks[l.name.trim()] = l.url.trim();
        }
      });

      if (editingEvent.is_offline) {
        const { data: offEvent, error: offErr } = await supabase
          .from("offline_events")
          .insert({
            event_id: baseEvent.id,
            title: editingEvent.title.trim(),
            description: editingEvent.description,
            start_date: editingEvent.start_date || null,
            end_date: editingEvent.end_date || null,
            start_time: editingEvent.start_time || null,
            end_time: editingEvent.end_time || null,
            reservation_type: editingEvent.reservation_type,
            is_reservation_always: editingEvent.is_reservation_always || false,
            reservation_starts_at: editingEvent.reservation_starts_at || null,
            reservation_ends_at: editingEvent.reservation_ends_at || null,
            image_url: editingEvent.image_url || null,
            links: Object.keys(finalLinks).length > 0 ? finalLinks : null
          })
          .select()
          .single();

        if (offErr) throw offErr;

        // Locations insert
        if (editingEvent.locationsForm && editingEvent.locationsForm.length > 0) {
          const locRelations = editingEvent.locationsForm.map((loc: string, idx: number) => ({
            offline_event_id: offEvent.id,
            location: loc,
            order_num: idx
          }));
          const { error: locErr } = await supabase
            .from("offline_event_locations")
            .insert(locRelations);
          
          if (locErr) throw locErr;
        }

        // Support images insert
        if (editingEvent.support_images && editingEvent.support_images.length > 0) {
          const imagesToInsert = editingEvent.support_images.map((img: any, idx: number) => ({
            event_id: baseEvent.id,
            image_url: img.url,
            order: idx
          }));
          const { error: imgErr } = await supabase.from("event_images").insert(imagesToInsert);
          if (imgErr) throw imgErr;
        }
      } else {
        // Online event insert
        const { data: onEvent, error: onErr } = await supabase
          .from("online_events")
          .insert({
            event_id: baseEvent.id,
            title: editingEvent.title.trim(),
            description: editingEvent.description,
            start_at: editingEvent.online_start_at || null,
            end_at: editingEvent.online_end_at || null,
            image_url: editingEvent.image_url || null,
            links: Object.keys(finalLinks).length > 0 ? finalLinks : null
          })
          .select()
          .single();

        if (onErr) throw onErr;

        // Support images insert
        if (editingEvent.support_images && editingEvent.support_images.length > 0) {
          const imagesToInsert = editingEvent.support_images.map((img: any, idx: number) => ({
            event_id: baseEvent.id,
            image_url: img.url,
            order: idx
          }));
          const { error: imgErr } = await supabase.from("event_images").insert(imagesToInsert);
          if (imgErr) throw imgErr;
        }
      }

      // 4. Update event proposal state
      const { error: updateErr } = await supabase
        .from("event_proposals")
        .update({
          status: "approved",
          approved_event_id: baseEvent.id
        })
        .eq("id", editingEvent.id);

      if (updateErr) throw updateErr;

      toast.success("행사 제보 승인 및 등록 완료!");
      setEditingEvent(null);
      fetchProposals();
    } catch (err: any) {
      console.error("Approve event error:", err);
      toast.error("행사 승인 중 오류 발생: " + err.message);
    }
  };

  const handleRejectEvent = async (proposalId: number) => {
    if (!confirm("정말 이 행사 제보를 거절하시겠습니까?")) return;
    try {
      const { error } = await supabase
        .from("event_proposals")
        .update({ status: "rejected" })
        .eq("id", proposalId);

      if (error) throw error;
      toast.success("행사 제보를 거절 처리했습니다.");
      fetchProposals();
    } catch (err: any) {
      console.error("Reject event error:", err);
      toast.error("거절 처리 중 오류 발생: " + err.message);
    }
  };

  const handleDeleteEventProposal = async (proposalId: number) => {
    if (!confirm("이 제보 기록을 데이터베이스에서 완전히 삭제하시겠습니까?")) return;
    try {
      const { error } = await supabase
        .from("event_proposals")
        .delete()
        .eq("id", proposalId);

      if (error) throw error;
      toast.success("제보 기록이 삭제되었습니다.");
      fetchProposals();
    } catch (err: any) {
      console.error("Delete event proposal error:", err);
      toast.error("기록 삭제에 실패했습니다.");
    }
  };

  // --- Filtering ---
  const filteredChannels = channelProposals.filter(p => filter === "all" ? true : p.status === filter);
  const filteredEvents = eventProposals.filter(p => filter === "all" ? true : p.status === filter);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Filters and Sub Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex bg-muted p-1.5 rounded-2xl border border-border/50 max-w-xs select-none">
          <button
            onClick={() => setActiveSubTab("channels")}
            className={`flex-1 px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === "channels"
                ? "bg-background text-primary shadow-xs border border-border/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Tv2 className="w-3.5 h-3.5" />
            채널 제안 ({channelProposals.filter(cp => cp.status === "pending").length})
          </button>
          <button
            onClick={() => setActiveSubTab("events")}
            className={`flex-1 px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === "events"
                ? "bg-background text-primary shadow-xs border border-border/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            행사 제보 ({eventProposals.filter(ep => ep.status === "pending").length})
          </button>
        </div>

        <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-xl border border-border/50 select-none">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                filter === f 
                  ? "bg-background text-foreground shadow-sm border border-border/50" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {f === "all" && "전체"}
              {f === "pending" && "대기 중"}
              {f === "approved" && "승인됨"}
              {f === "rejected" && "거절됨"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary opacity-60" />
          <p>데이터 로딩 중...</p>
        </div>
      ) : activeSubTab === "channels" ? (
        // ==========================================
        // Channels Proposals List
        // ==========================================
        filteredChannels.length === 0 ? (
          <div className="py-16 border-2 border-dashed border-border rounded-3xl bg-background/50 flex flex-col items-center justify-center text-center">
            <Tv2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-sm font-bold text-muted-foreground">채널 증설 제안 건이 없습니다.</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredChannels.map((req) => (
              <div key={req.id} className="group bg-background border border-border rounded-3xl p-5 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${req.status === "approved" ? "bg-green-500" : req.status === "rejected" ? "bg-destructive" : "bg-amber-400"}`} />
                <div className="flex gap-4 mb-4">
                  <Avatar className="w-14 h-14 rounded-2xl border border-border/50 shrink-0">
                    <AvatarImage src={req.image_url || undefined} className="object-cover" />
                    <AvatarFallback className="rounded-2xl bg-muted font-bold text-lg">{req.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-base truncate">{req.name}</h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}>
                          {req.status === "pending" ? "대기 중" : req.status === "approved" ? "승인됨" : "거절됨"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteChannelProposal(req.id)}
                          className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="bg-primary/5 text-primary border border-primary/10 rounded px-1.5 py-0.5 text-[10px] font-bold">
                        {req.type === "youtuber" ? "유튜버" : req.type === "vtuber" ? "버튜버" : req.type === "festival" ? "축제" : "게임"}
                      </span>
                      <span>제안자: {req.profiles?.nickname || "알 수 없음"}</span>
                    </p>
                  </div>
                </div>

                {/* Channel links */}
                <div className="bg-muted/30 rounded-2xl p-3 border border-border/40 text-xs flex-1 space-y-2 mb-4">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">SNS/유튜브 링크</span>
                  {req.links && req.links.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {req.links.map((link: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-1">
                          <span className="font-bold text-slate-500">{link.name || "링크"}:</span>
                          <a href={link.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex items-center gap-0.5 max-w-[200px]">
                            {link.url} <ExternalLink className="w-2.5 h-2.5 opacity-55" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/60 italic">등록된 링크 없음</span>
                  )}
                </div>

                {req.status === "pending" && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleOpenApproveChannel(req)} className="flex-1 h-10 font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs">
                      승인 검토
                    </Button>
                    <Button variant="outline" onClick={() => handleRejectChannel(req.id)} className="flex-1 h-10 font-bold border-destructive/20 hover:bg-destructive/10 hover:text-destructive text-destructive rounded-xl text-xs">
                      거절
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        // ==========================================
        // Events Proposals List
        // ==========================================
        filteredEvents.length === 0 ? (
          <div className="py-16 border-2 border-dashed border-border rounded-3xl bg-background/50 flex flex-col items-center justify-center text-center">
            <CalendarDays className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-sm font-bold text-muted-foreground">행사 제보 건이 없습니다.</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredEvents.map((req) => {
              // Check if connected to an unapproved channel proposal
              const isBlockedByChannel = req.channel_proposal_id && 
                req.channel_proposals?.status !== "approved";

              return (
                <div key={req.id} className="group bg-background border border-border rounded-3xl p-5 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col relative overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-1 ${req.status === "approved" ? "bg-green-500" : req.status === "rejected" ? "bg-destructive" : "bg-amber-400"}`} />
                  
                  <div className="flex gap-4 mb-4">
                    <Avatar className="w-16 h-20 rounded-xl border border-border/50 shrink-0">
                      <AvatarImage src={req.image_url || undefined} className="object-cover" />
                      <AvatarFallback className="rounded-xl bg-muted font-bold flex items-center justify-center">포스터</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-extrabold text-base truncate">{req.title}</h4>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}>
                            {req.status === "pending" ? "대기 중" : req.status === "approved" ? "승인됨" : "거절됨"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteEventProposal(req.id)}
                            className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground flex flex-wrap gap-2">
                        <span className="bg-primary/5 text-primary border border-primary/10 rounded px-1.5 py-0.5 text-[9px] font-bold">
                          {req.is_offline ? "오프라인" : "온라인"}
                        </span>
                        <span>제보자: {req.profiles?.nickname || "알 수 없음"}</span>
                      </p>
                      
                      {/* Simultaneous Application Info */}
                      {req.channel_proposal_id && (
                        <div className="text-[10px] font-semibold mt-1">
                          {isBlockedByChannel ? (
                            <span className="text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                              ⚠️ 신규 채널 승인 대기 중 (채널 제안명: {req.channel_proposals?.name})
                            </span>
                          ) : (
                            <span className="text-green-600 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">
                              ✅ 연동 채널 승인 완료 ({req.channel_proposals?.name})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary of dates & locations */}
                  <div className="bg-muted/30 rounded-2xl p-3 border border-border/40 text-xs flex-1 space-y-2 mb-4">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 block">행사 시각</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {req.is_offline 
                          ? `${req.start_date || "상시"} ~ ${req.end_date || "상시"}`
                          : `${req.online_start_at ? new Date(req.online_start_at).toLocaleString() : "상시"} ~ ${req.online_end_at ? new Date(req.online_end_at).toLocaleString() : "상시"}`}
                      </span>
                    </div>
                    {req.is_offline && req.locations && (
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block">장소</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">
                          {Array.isArray(req.locations) ? req.locations.join(", ") : String(req.locations)}
                        </span>
                      </div>
                    )}
                  </div>

                  {req.status === "pending" && (
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleOpenApproveEvent(req)} 
                        disabled={isBlockedByChannel}
                        className="flex-1 h-10 font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        승인 검토
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleRejectEvent(req.id)} 
                        className="flex-1 h-10 font-bold border-destructive/20 hover:bg-destructive/10 hover:text-destructive text-destructive rounded-xl text-xs"
                      >
                        거절
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ==========================================
          MODAL 1: Channel Proposal Edit & Approve
          ========================================== */}
      {editingChannel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">채널 제안 승인 검토</h3>
              <Button variant="ghost" size="icon" onClick={() => setEditingChannel(null)} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <form onSubmit={handleApproveChannelConfirm} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modal-ch-name">채널명</Label>
                <Input
                  id="modal-ch-name"
                  value={editingChannel.name}
                  onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-ch-type">활동 유형</Label>
                <select
                  id="modal-ch-type"
                  value={editingChannel.type}
                  onChange={(e) => setEditingChannel({ ...editingChannel, type: e.target.value })}
                  className="w-full bg-background border border-border/80 rounded-xl px-3 h-11 text-sm font-semibold focus:outline-none focus:border-primary"
                >
                  <option value="game">게임</option>
                  <option value="youtuber">유튜버</option>
                  <option value="vtuber">버튜버</option>
                  <option value="festival">축제 / 행사</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-ch-img">대표 이미지 URL</Label>
                <Input
                  id="modal-ch-img"
                  value={editingChannel.image_url || ""}
                  onChange={(e) => setEditingChannel({ ...editingChannel, image_url: e.target.value })}
                  placeholder="https://"
                />
              </div>

              <div className="bg-orange-500/10 border border-orange-500/20 text-orange-600 p-3.5 rounded-2xl text-xs font-semibold space-y-1">
                <p>🔒 **승인 시 소속사 강제 매핑 규정**</p>
                <p>- 이 채널은 관리자에 의해 승인되며 **owner_id는 null**, 소속사는 **'아웃덕'**으로 자동 귀속됩니다.</p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border/50">
                <Button type="submit" className="flex-1 h-12 font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl">
                  승인 및 채널 생성
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingChannel(null)} className="h-12 rounded-xl">
                  취소
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: Event Proposal Edit & Approve
          ========================================== */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl my-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">행사 제보 승인 검토</h3>
              <Button variant="ghost" size="icon" onClick={() => setEditingEvent(null)} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <form onSubmit={handleApproveEventConfirm} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              
              {/* Host Channel Binding or Selection */}
              <div className="bg-muted/30 p-4 rounded-2xl border border-border/40 space-y-3">
                <Label className="text-sm font-bold block">주최자 연결</Label>
                {editingEvent.channel_proposal_id ? (
                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-border">
                    <Tv2 className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-500">동시 제안된 신규 채널 연동</p>
                      <p className="text-sm font-extrabold text-foreground">{editingEvent.channel_proposals?.name}</p>
                    </div>
                    <Badge className="ml-auto bg-green-600 text-white">승인됨</Badge>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">기존 등록 채널 연결</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="연결할 채널 검색"
                        value={modalChannelSearch}
                        onChange={(e) => setModalChannelSearch(e.target.value)}
                        className="pl-10 h-10 bg-white"
                      />
                      {isSearchingModalChannels && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      
                      {modalChannelResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-background border border-border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                          {modalChannelResults.map(ch => (
                            <button
                              key={ch.id}
                              type="button"
                              onClick={() => {
                                setModalSelectedChannel(ch);
                                setModalChannelSearch(ch.name);
                                setModalChannelResults([]);
                              }}
                              className="w-full text-left p-2 hover:bg-muted text-xs flex items-center gap-2 border-b"
                            >
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={ch.image_url || undefined} />
                                <AvatarFallback>{ch.name.slice(0, 1)}</AvatarFallback>
                              </Avatar>
                              <span className="font-semibold">{ch.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {modalSelectedChannel && (
                      <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-border w-fit text-xs">
                        <span className="font-bold">선택됨: {modalSelectedChannel.name}</span>
                        <button type="button" onClick={() => { setModalSelectedChannel(null); setModalChannelSearch(""); }} className="text-red-500 font-bold hover:underline">취소</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Basic Fields */}
              <div className="space-y-2">
                <Label htmlFor="modal-ev-title">행사 제목</Label>
                <Input
                  id="modal-ev-title"
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-ev-desc">상세 설명</Label>
                <textarea
                  id="modal-ev-desc"
                  value={editingEvent.description || ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  rows={4}
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-ev-img">대표 포스터 이미지 URL</Label>
                <Input
                  id="modal-ev-img"
                  value={editingEvent.image_url || ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, image_url: e.target.value })}
                />
              </div>

              {/* Time & Dates (Editable text formats for simplicity of admin edits) */}
              {editingEvent.is_offline ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">시작일 (YYYY-MM-DD)</Label>
                      <Input
                        value={editingEvent.start_date || ""}
                        onChange={(e) => setEditingEvent({ ...editingEvent, start_date: e.target.value })}
                        placeholder="2026-06-18"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">종료일 (YYYY-MM-DD)</Label>
                      <Input
                        value={editingEvent.end_date || ""}
                        onChange={(e) => setEditingEvent({ ...editingEvent, end_date: e.target.value })}
                        placeholder="2026-06-20"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">시작시간 (HH:MM:SS)</Label>
                      <Input
                        value={editingEvent.start_time || ""}
                        onChange={(e) => setEditingEvent({ ...editingEvent, start_time: e.target.value })}
                        placeholder="10:00:00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">종료시간 (HH:MM:SS)</Label>
                      <Input
                        value={editingEvent.end_time || ""}
                        onChange={(e) => setEditingEvent({ ...editingEvent, end_time: e.target.value })}
                        placeholder="18:00:00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">장소 목록 (직접 편집)</Label>
                    <div className="space-y-1.5">
                      {editingEvent.locationsForm.map((loc: string, idx: number) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            value={loc}
                            onChange={(e) => {
                              const newLocs = [...editingEvent.locationsForm];
                              newLocs[idx] = e.target.value;
                              setEditingEvent({ ...editingEvent, locationsForm: newLocs });
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              setEditingEvent({
                                ...editingEvent,
                                locationsForm: editingEvent.locationsForm.filter((_: any, i: number) => i !== idx)
                              });
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingEvent({
                            ...editingEvent,
                            locationsForm: [...editingEvent.locationsForm, ""]
                          });
                        }}
                      >
                        장소 추가
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">온라인 시작일시 (ISO)</Label>
                    <Input
                      value={editingEvent.online_start_at || ""}
                      onChange={(e) => setEditingEvent({ ...editingEvent, online_start_at: e.target.value })}
                      placeholder="2026-06-18T10:00:00+09:00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">온라인 종료일시 (ISO)</Label>
                    <Input
                      value={editingEvent.online_end_at || ""}
                      onChange={(e) => setEditingEvent({ ...editingEvent, online_end_at: e.target.value })}
                      placeholder="2026-06-20T18:00:00+09:00"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-border/50">
                <Button type="submit" className="flex-1 h-12 font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl">
                  승인 및 행사 등록
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingEvent(null)} className="h-12 rounded-xl">
                  취소
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
