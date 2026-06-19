"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
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
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  ImageIcon,
  Plus,
  Trash2,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useImageUpload } from "@/hooks/use-image-upload";

interface ChannelLink {
  id: string;
  name: string;
  url: string;
}

interface ChannelProposalFormProps {
  user: User;
  onSuccess: () => void;
}

export function ChannelProposalForm({ user, onSuccess }: ChannelProposalFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("");
  const [linksForm, setLinksForm] = useState<ChannelLink[]>([{ id: "default", name: "", url: "" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    imageUrl,
    isUploading,
    handleImageUpload,
  } = useImageUpload({
    bucket: "channel-images",
    folderPath: "channel-requests",
    prefix: "proposal-",
    successMessage: "프로필 이미지가 업로드되었습니다.",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("채널명을 입력해주세요.");
      return;
    }
    if (!type) {
      toast.error("유형을 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const links = linksForm
        .filter(l => l.name.trim() || l.url.trim())
        .map(({ name, url }) => ({ name: name.trim(), url: url.trim() }));

      const insertData = {
        user_id: user.id,
        name: name.trim(),
        type: type,
        links: links.length > 0 ? links : null,
        image_url: imageUrl || null,
        status: "pending",
      };

      const { error: requestError } = await supabase
        .from("channel_proposals")
        .insert([insertData]);

      if (requestError) throw requestError;

      toast.success("채널 증설 제안이 완료되었습니다.");
      onSuccess();
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error("신청 과정에서 오류가 발생했습니다: " + (error.message || "다시 시도해주세요."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-transparent sm:bg-background border-0 sm:border border-border rounded-none sm:rounded-3xl p-0 sm:p-10 shadow-none sm:shadow-xl animate-in fade-in duration-300">
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">채널 증설 제안서</h2>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Profile Image Section */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">채널 프로필 이미지</Label>
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
              <p className="text-xs text-muted-foreground leading-relaxed">제안하려는 채널의 대표 이미지입니다.<br/>(정사각형 비율 권장)</p>
            </div>
          </div>
        </div>

        {/* Basic Fields */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base font-semibold">채널명 <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              placeholder="예: 침착맨, 우왁굳, 에스더 등 공식 활동명"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-base rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type" className="text-base font-semibold">활동 유형 <span className="text-destructive">*</span></Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-12 text-base rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20">
                <SelectValue placeholder="유형 선택" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="game">게임</SelectItem>
                <SelectItem value="youtuber">유튜버</SelectItem>
                <SelectItem value="vtuber">버튜버</SelectItem>
                <SelectItem value="festival">축제 / 행사</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Links Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">활동 링크 (선택)</Label>
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
            <p className="text-xs text-muted-foreground mt-2">유튜브 채널, 치지직, 트위터(X) 등 채널 검토에 도움이 되는 공식 주소를 입력해주세요.</p>
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
              "제안 완료하기"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
