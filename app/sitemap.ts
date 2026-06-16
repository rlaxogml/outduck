import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://outduck.vercel.app'
  
  // Static pages in the app
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/events`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/calendar`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/all-channels`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/online-events`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ]

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return staticPages
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Fetch channels to index their detail pages
    const { data: channels } = await supabase
      .from('channels')
      .select('id, updated_at')
      .limit(1000)

    const channelUrls = (channels || []).map((channel: any) => ({
      url: `${baseUrl}/channels/${channel.id}`,
      lastModified: channel.updated_at ? new Date(channel.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

    // Fetch events to index their detail pages
    const { data: events } = await supabase
      .from('events')
      .select('id, updated_at')
      .limit(1000)

    const eventUrls = (events || []).map((event: any) => ({
      url: `${baseUrl}/events/${event.id}`,
      lastModified: event.updated_at ? new Date(event.updated_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }))

    return [...staticPages, ...channelUrls, ...eventUrls]
  } catch (error) {
    console.error('Error generating dynamic sitemap:', error)
    return staticPages
  }
}
