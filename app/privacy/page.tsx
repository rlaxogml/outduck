export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <p className="text-sm text-gray-400 mb-2">OUTDUCK (아웃덕)</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">개인정보처리방침</h1>
          <p className="text-sm text-gray-400">시행일: 2025년 1월 1일 · 최종 수정일: 2025년 1월 1일</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. 개인정보 수집 항목 및 수집 방법</h2>
            <p className="mb-3">
              아웃덕(이하 "서비스")은 Google OAuth 로그인을 통해 다음의 개인정보를 수집합니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>이메일 주소</li>
              <li>Google 계정 프로필 사진 URL</li>
              <li>Google 계정 고유 식별자(sub)</li>
            </ul>
            <p className="mt-3 text-sm">
              위 정보는 Google 로그인 과정에서 이용자의 동의를 거쳐 자동으로 수집됩니다.
              별도 회원가입 양식을 통한 수집은 없습니다.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. 개인정보의 수집 및 이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>회원 식별 및 로그인 처리</li>
              <li>즐겨찾기(채널 팔로우, 이벤트 북마크) 등 개인화 기능 제공</li>
              <li>서비스 이용 통계 분석 및 품질 개선</li>
              <li>이용약관 위반 등 불법·부정 이용 방지</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. 개인정보의 보유 및 이용 기간</h2>
            <p className="text-sm">
              회원 탈퇴 시 또는 수집 목적 달성 후 지체 없이 파기합니다.
              단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 별도 보관합니다.
            </p>
            <table className="mt-3 w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-3 py-2 text-left font-medium">보존 항목</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-medium">보존 근거</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-medium">보존 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-3 py-2">서비스 이용 기록</td>
                  <td className="border border-gray-200 px-3 py-2">통신비밀보호법</td>
                  <td className="border border-gray-200 px-3 py-2">3개월</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2">소비자 불만·분쟁 기록</td>
                  <td className="border border-gray-200 px-3 py-2">전자상거래법</td>
                  <td className="border border-gray-200 px-3 py-2">3년</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. 개인정보의 제3자 제공</h2>
            <p className="text-sm">
              서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
              다만 이용자가 사전에 동의한 경우 또는 법령의 규정에 의거하여 수사 목적으로 법령에 정해진
              절차와 방법에 따라 수사기관의 요구가 있는 경우는 예외로 합니다.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. 개인정보 처리 위탁</h2>
            <p className="mb-3 text-sm">서비스 운영을 위해 아래와 같이 개인정보 처리를 위탁합니다.</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-3 py-2 text-left font-medium">수탁업체</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-medium">위탁 업무</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-3 py-2">Supabase, Inc.</td>
                  <td className="border border-gray-200 px-3 py-2">데이터베이스 호스팅 및 인증 처리</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2">Vercel, Inc.</td>
                  <td className="border border-gray-200 px-3 py-2">웹 서비스 호스팅</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2">Google LLC</td>
                  <td className="border border-gray-200 px-3 py-2">OAuth 소셜 로그인</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2">Google LLC (Firebase)</td>
                  <td className="border border-gray-200 px-3 py-2">FCM 푸시 알림 전송 인프라 제공</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. 이용자의 권리와 행사 방법</h2>
            <p className="text-sm mb-2">이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>개인정보 열람 요청</li>
              <li>오류 정정 요청</li>
              <li>삭제 요청 (회원 탈퇴)</li>
              <li>처리 정지 요청</li>
            </ul>
            <p className="mt-2 text-sm">
              권리 행사는 하단의 개인정보 보호책임자 이메일로 문의하시거나, 서비스 내 **[설정 > 계정]** 메뉴 하단의 **'계정 영구 삭제'** 버튼을 통해 즉시 탈퇴를 진행하실 수 있습니다.
              탈퇴 시 서비스 내 개인화 데이터(북마크, 즐겨찾기 등)가 모두 삭제됩니다.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. 개인정보의 파기 절차 및 방법</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>전자 파일 형태: 복구 불가능한 방법으로 영구 삭제</li>
              <li>데이터베이스: 해당 레코드 즉시 삭제 후 백업에서도 순차 삭제</li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. 쿠키(Cookie) 운용</h2>
            <p className="text-sm">
              서비스는 로그인 세션 유지를 위해 쿠키를 사용합니다.
              브라우저 설정에서 쿠키를 거부할 수 있으나, 거부 시 로그인이 필요한 기능을 이용할 수 없습니다.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. 개인정보 보호책임자</h2>
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <p><span className="font-medium">책임자:</span> 아웃덕 운영팀</p>
              <p>
                <span className="font-medium">이메일:</span>{" "}
                <a href="mailto:gkimth7@gmail.com" className="text-blue-600 hover:underline">
                  gkimth7@gmail.com
                </a>
              </p>
              <p className="text-gray-500 text-xs mt-2">
              </p>
            </div>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. 개인정보처리방침 변경</h2>
            <p className="text-sm">
              본 방침은 법령·정책 변경 또는 서비스 내용 변경에 따라 개정될 수 있으며,
              변경 시 서비스 내 공지사항을 통해 7일 전 사전 안내합니다.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-100 text-xs text-gray-400">
          © OUTDUCK (아웃덕). 본 방침은 대한민국 개인정보 보호법을 기준으로 작성되었습니다.
        </div>
      </div>
    </main>
  );
}
