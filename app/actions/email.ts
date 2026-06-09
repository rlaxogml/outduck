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

export async function notifyAdminsNewApplication(data: { name: string; type: string; createdAt: string }) {
  try {
    const supabase = getSupabaseAdmin();

    // 1. Find all admin users
    const { data: adminProfiles, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_admin", true);

    if (profileError || !adminProfiles || adminProfiles.length === 0) {
      console.error("No admins found or error fetching admins:", profileError);
      return;
    }

    const adminIds = adminProfiles.map((p) => p.id);

    // 2. Fetch email addresses for these admin users using auth.admin
    // Since we need their emails, and profiles table usually doesn't have it, we get it from auth
    const adminEmails: string[] = [];
    
    // Using auth.admin to get user details (requires Service Role Key)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        for (const id of adminIds) {
          const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(id);
          if (!userError && user?.email) {
            adminEmails.push(user.email);
          }
        }
    } else {
        console.warn("SUPABASE_SERVICE_ROLE_KEY is not set. Cannot fetch admin emails from auth.users.");
        return;
    }

    if (adminEmails.length === 0) {
      console.warn("No admin emails found to notify.");
      return;
    }

    // 3. Send emails
    const transporter = getTransporter();
    
    const mailOptions = {
      from: `"Outduck 알림" <${process.env.GMAIL_USER}>`,
      to: adminEmails.join(", "),
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
    const { data: adminProfiles, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_admin", true);

    const adminEmails: string[] = [];
    if (!profileError && adminProfiles && adminProfiles.length > 0) {
      const adminIds = adminProfiles.map((p) => p.id);
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        for (const id of adminIds) {
          const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(id);
          if (!userError && user?.email) {
            adminEmails.push(user.email);
          }
        }
      }
    }

    // Default fallback to process.env.GMAIL_USER if no admins found
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
