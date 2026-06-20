"use server";

import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

// Note: To use auth.admin methods, we MUST use the Service Role Key.
// The user will need to add SUPABASE_SERVICE_ROLE_KEY to .env.local
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};

const getTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
};

async function getAdminEmails(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string[]> {
  try {
    const { data: adminProfiles, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_admin", true);

    if (profileError || !adminProfiles || adminProfiles.length === 0) {
      console.error("No admins found or error fetching admins:", profileError);
      return [];
    }

    const adminIds = adminProfiles.map((p) => p.id);
    const adminEmails: string[] = [];

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      for (const id of adminIds) {
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(id);
        if (!userError && user?.email) {
          adminEmails.push(user.email);
        }
      }
    } else {
      console.warn("SUPABASE_SERVICE_ROLE_KEY is not set. Cannot fetch admin emails from auth.users.");
    }

    return adminEmails;
  } catch (error) {
    console.error("Error in getAdminEmails:", error);
    return [];
  }
}

export async function notifyAdminsNewApplication(data: { name: string; type: string; createdAt: string }) {
  try {
    const supabase = getSupabaseAdmin();
    const adminEmails = await getAdminEmails(supabase);
    const toEmail = adminEmails.length > 0 ? adminEmails.join(", ") : process.env.GMAIL_USER!;

    if (!toEmail) {
      console.warn("No email destination available for admin notification.");
      return;
    }

    // 3. Send emails
    const transporter = getTransporter();
    
    const mailOptions = {
      from: `"Outduck 알림" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: `[주최자 신청] 새로운 주최자 계정 신청이 들어왔습니다: ${data.name}`,
      html: `
        <h2>새로운 주최자 계정 신청</h2>
        <p>새로운 주최자 계정 신청이 접수되었습니다. 관리자 페이지에서 확인해주세요.</p>
        <ul>
          <li><strong>신청 이름:</strong> ${data.name}</li>
          <li><strong>유형:</strong> ${data.type}</li>
          <li><strong>신청 시각:</strong> ${new Date(data.createdAt).toLocaleString("ko-KR")}</li>
        </ul>
        <br/>
        <a href="https://outduck.kr/admin">관리자 페이지 바로가기</a>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Admin notification emails sent successfully.");
  } catch (error) {
    console.error("Error sending admin notification email:", error);
  }
}

export async function notifyAdminsNewEventProposal(data: {
  title: string;
  is_online: boolean;
  is_offline: boolean;
  description?: string | null;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const adminEmails = await getAdminEmails(supabase);
    const toEmail = adminEmails.length > 0 ? adminEmails.join(", ") : process.env.GMAIL_USER!;

    if (!toEmail) {
      console.warn("No email destination available for event proposal admin notification.");
      return;
    }

    const transporter = getTransporter();
    const eventTypeStr = data.is_online && data.is_offline 
      ? "온라인, 오프라인" 
      : data.is_online 
        ? "온라인" 
        : data.is_offline 
          ? "오프라인" 
          : "미정";

    const mailOptions = {
      from: `"Outduck 알림" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: `[행사 제보] 새로운 행사 제보가 들어왔습니다: ${data.title}`,
      html: `
        <h2>새로운 행사 제보</h2>
        <p>새로운 행사 제보가 접수되었습니다. 관리자 페이지에서 확인해주세요.</p>
        <ul>
          <li><strong>행사 제목:</strong> ${data.title}</li>
          <li><strong>행사 유형:</strong> ${eventTypeStr}</li>
        </ul>
        <h3>설명</h3>
        <div style="white-space: pre-wrap; background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">${data.description || "(설명 없음)"}</div>
        <br/>
        <a href="https://outduck.kr/admin">관리자 페이지 바로가기</a>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Admin notification email for event proposal sent successfully.");
  } catch (error) {
    console.error("Error sending admin event proposal notification email:", error);
  }
}

export async function notifyAdminsNewChannelProposal(data: {
  name: string;
  type: string;
  image_url?: string | null;
  links?: any;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const adminEmails = await getAdminEmails(supabase);
    const toEmail = adminEmails.length > 0 ? adminEmails.join(", ") : process.env.GMAIL_USER!;

    if (!toEmail) {
      console.warn("No email destination available for channel proposal admin notification.");
      return;
    }

    const transporter = getTransporter();
    
    // Format links if any
    let linksHtml = "";
    if (data.links && Array.isArray(data.links)) {
      linksHtml = `<ul>${data.links.map((link: any) => `<li><strong>${link.name || "링크"}:</strong> <a href="${link.url}">${link.url}</a></li>`).join("")}</ul>`;
    } else {
      linksHtml = "<p>(링크 없음)</p>";
    }

    const mailOptions = {
      from: `"Outduck 알림" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: `[채널 제안] 새로운 채널 증설 제안이 들어왔습니다: ${data.name}`,
      html: `
        <h2>새로운 채널 증설 제안</h2>
        <p>새로운 채널 증설 제안이 접수되었습니다. 관리자 페이지에서 확인해주세요.</p>
        <ul>
          <li><strong>채널명:</strong> ${data.name}</li>
          <li><strong>활동 유형:</strong> ${data.type}</li>
        </ul>
        <h3>활동 링크</h3>
        ${linksHtml}
        ${data.image_url ? `<br/><img src="${data.image_url}" alt="프로필 이미지" style="max-width: 200px; border-radius: 8px;"/>` : ""}
        <br/><br/>
        <a href="https://outduck.kr/admin">관리자 페이지 바로가기</a>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Admin notification email for channel proposal sent successfully.");
  } catch (error) {
    console.error("Error sending admin channel proposal notification email:", error);
  }
}

export async function notifyHostApplicationApproved(data: { userId: string; name: string; requestType?: string }) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Fetch applicant's email
    let applicantEmail = null;
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(data.userId);
        if (!userError && user?.email) {
            applicantEmail = user.email;
        }
    } else {
        console.warn("SUPABASE_SERVICE_ROLE_KEY is not set. Cannot fetch applicant email.");
        return;
    }

    if (!applicantEmail) {
      console.warn("Applicant email not found.");
      return;
    }

    // Send email
    const transporter = getTransporter();
    
    const isCompany = data.requestType === "company";
    const titleText = isCompany ? "회사 관리자 계정" : "주최자 계정";
    const linkUrl = isCompany ? "https://outduck.kr/company" : "https://outduck.kr/host";
    
    const mailOptions = {
      from: `"Outduck 알림" <${process.env.GMAIL_USER}>`,
      to: applicantEmail,
      subject: `[Outduck] ${titleText} 신청이 승인되었습니다!`,
      html: `
        <h2>🎉 ${titleText} 승인 안내</h2>
        <p>안녕하세요! 요청하신 <strong>${data.name}</strong> ${titleText} 신청이 승인되었습니다.</p>
        <p>이제 관리 콘솔에 접속하여 시스템을 이용하실 수 있습니다.</p>
        <br/>
        <a href="${linkUrl}">${titleText} 콘솔 바로가기</a>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Applicant approval email sent successfully.");
  } catch (error) {
    console.error("Error sending applicant approval email:", error);
  }
}

export async function sendCustomerInquiry(data: {
  userId: string | null;
  type: string;
  title: string;
  content: string;
  email: string;
}) {
  try {
    const supabase = getSupabaseAdmin();

    // 1. Try to insert into the feedback table (optional persistence)
    try {
      const { error: dbError } = await supabase
        .from("feedback")
        .insert({
          user_id: data.userId,
          type: data.type,
          title: data.title,
          content: data.content,
          email: data.email,
        });
      
      if (dbError) {
        console.warn("DB insert into feedback failed (the migration might not be run yet):", dbError.message);
      } else {
        console.log("Feedback successfully saved to DB.");
      }
    } catch (dbErr) {
      console.warn("Catch block: DB insert into feedback failed:", dbErr);
    }

    // 2. Find all admin users and get their email addresses
    const adminEmails = await getAdminEmails(supabase);
    const toEmail = adminEmails.length > 0 ? adminEmails.join(", ") : process.env.GMAIL_USER!;

    // 3. Send email to admin(s)
    const transporter = getTransporter();
    
    const mailOptions = {
      from: `"Outduck 고객문의" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      replyTo: data.email,
      subject: `[고객문의] [${data.type}] ${data.title}`,
      html: `
        <h2>새로운 고객문의 / 피드백 접수</h2>
        <p>Outduck 서비스에서 새로운 고객 문의가 접수되었습니다.</p>
        <hr/>
        <ul>
          <li><strong>문의 유형:</strong> ${data.type}</li>
          <li><strong>제목:</strong> ${data.title}</li>
          <li><strong>작성자 이메일:</strong> <a href="mailto:${data.email}">${data.email}</a></li>
          <li><strong>회원 ID:</strong> ${data.userId || "비로그인 상태"}</li>
        </ul>
        <h3>문의 내용</h3>
        <p style="white-space: pre-wrap; background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">${data.content}</p>
        <hr/>
        <p style="font-size: 12px; color: #6c757d;">본 메일은 Outduck 고객문의 발송 시스템에서 자동 전송된 메일입니다.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Customer inquiry email sent successfully.");
    return { success: true };
  } catch (error: any) {
    console.error("Error in sendCustomerInquiry:", error);
    return { success: false, error: error.message || "Failed to send inquiry" };
  }
}
