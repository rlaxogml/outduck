/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["nodemailer"],
  images: {
    // Supabase Storage(공개 버킷)만 최적화 대상으로 허용
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hdazhucnjpfbgkhtoqnx.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    formats: ["image/webp"],
    // 최적화된 이미지를 Vercel 캐시에 오래 보관 → Supabase 원본 재요청 최소화(egress 절감)
    minimumCacheTTL: 2678400, // 31일
  },
}

export default nextConfig
