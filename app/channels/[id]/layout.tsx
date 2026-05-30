import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const channelId = Number(resolvedParams.id);
  
  if (!channelId || isNaN(channelId)) {
    return {
      title: '채널 | Outduck',
      description: '채널 정보를 찾을 수 없습니다.',
    };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: channel } = await supabase
    .from('channels')
    .select('name, type, image_url')
    .eq('id', channelId)
    .single();

  if (!channel) {
    return {
      title: '채널 | Outduck',
      description: '채널 정보를 찾을 수 없습니다.',
    };
  }

  let channelType = '기타';
  if (channel.type === 'game') channelType = '게임';
  else if (channel.type === 'youtuber') channelType = '유튜버';
  else if (channel.type === 'festival') channelType = '축제';

  const title = `${channel.name} | Outduck`;
  const description = `${channel.name} 채널입니다. 카테고리: ${channelType}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: channel.image_url ? [channel.image_url] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: channel.image_url ? [channel.image_url] : [],
    },
  };
}

export default function ChannelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>;
}
