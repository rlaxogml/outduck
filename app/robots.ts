import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://outduck.vercel.app'
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/settings/', '/host/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
