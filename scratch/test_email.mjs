import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// .env.local 수동 파싱
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const [key, ...vals] = line.split("=");
  if (key && vals.length) process.env[key.trim()] = vals.join("=").trim();
}

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("=== 환경 변수 확인 ===");
console.log("GMAIL_USER:", GMAIL_USER);
console.log("GMAIL_APP_PASSWORD:", GMAIL_APP_PASSWORD ? `설정됨 (${GMAIL_APP_PASSWORD.length}자)` : "❌ 없음");
console.log("SUPABASE_URL:", SUPABASE_URL ? "설정됨" : "❌ 없음");
console.log("SERVICE_KEY:", SERVICE_KEY ? "설정됨" : "❌ 없음");
console.log("");

// 1단계: Supabase에서 admin 프로필 조회
console.log("=== 1단계: Admin 프로필 조회 ===");
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: adminProfiles, error: profileError } = await supabase
  .from("profiles")
  .select("id")
  .eq("is_admin", true);

if (profileError) {
  console.error("❌ Admin 프로필 조회 실패:", profileError.message);
} else {
  console.log(`✅ Admin 프로필 수: ${adminProfiles?.length ?? 0}개`);
  if (!adminProfiles || adminProfiles.length === 0) {
    console.log("⚠️  is_admin=true인 유저가 없습니다! profiles 테이블을 확인해주세요.");
  }
}

// 2단계: admin 이메일 가져오기
const adminEmails = [];
if (adminProfiles && adminProfiles.length > 0) {
  console.log("\n=== 2단계: Admin 이메일 조회 ===");
  for (const p of adminProfiles) {
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(p.id);
    if (userError) {
      console.error(`❌ 유저 ${p.id} 이메일 조회 실패:`, userError.message);
    } else {
      console.log(`✅ Admin 이메일: ${user?.email}`);
      if (user?.email) adminEmails.push(user.email);
    }
  }
}

// 3단계: 실제 이메일 전송 테스트
console.log("\n=== 3단계: Gmail 이메일 전송 테스트 ===");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

// 연결 확인
try {
  await transporter.verify();
  console.log("✅ Gmail SMTP 연결 성공!");
} catch (err) {
  console.error("❌ Gmail SMTP 연결 실패:", err.message);
  console.log("\n가능한 원인:");
  console.log("  - 앱 비밀번호가 만료되었거나 잘못되었음");
  console.log("  - Gmail 계정의 2단계 인증이 비활성화됨");
  console.log("  - 앱 비밀번호가 아닌 일반 비밀번호를 사용함");
  process.exit(1);
}

// 이메일 발송 테스트 (본인에게)
const toEmail = adminEmails.length > 0 ? adminEmails.join(", ") : GMAIL_USER;
console.log(`\n수신 대상: ${toEmail}`);

try {
  const info = await transporter.sendMail({
    from: `"Outduck 테스트" <${GMAIL_USER}>`,
    to: toEmail,
    subject: "[Outduck] 이메일 발송 테스트",
    html: `<h2>테스트 메일입니다</h2><p>이 메일이 보이면 이메일 발송 기능이 정상입니다!</p>`,
  });
  console.log("✅ 이메일 발송 성공! messageId:", info.messageId);
} catch (err) {
  console.error("❌ 이메일 발송 실패:", err.message);
}
