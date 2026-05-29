export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <p className="text-sm text-gray-400 mb-2">OUTDUCK (아웃덕)</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">이용약관</h1>
          <p className="text-sm text-gray-400">시행일: 2025년 1월 1일 · 최종 수정일: 2025년 1월 1일</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
            <p className="text-sm">
              본 약관은 아웃덕(OUTDUCK, 이하 "서비스")이 제공하는 서브컬처 이벤트·굿즈 정보 집계 서비스의
              이용 조건 및 절차, 이용자와 서비스 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제2조 (정의)</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>
                <span className="font-medium">"서비스"</span>란 아웃덕이 운영하는 웹사이트(outduck.vercel.app 및
                연결된 도메인)에서 제공하는 모든 기능을 말합니다.
              </li>
              <li>
                <span className="font-medium">"이용자"</span>란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.
              </li>
              <li>
                <span className="font-medium">"회원"</span>이란 Google 계정으로 로그인하여 개인화 기능을 이용하는
                이용자를 말합니다.
              </li>
              <li>
                <span className="font-medium">"콘텐츠"</span>란 서비스 내에서 제공되는 이벤트 정보, 굿즈 정보,
                채널 정보 등 일체의 데이터를 말합니다.
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제3조 (약관의 효력 및 변경)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.</li>
              <li>
                서비스는 합리적인 사유가 발생할 경우 약관을 변경할 수 있으며,
                변경된 약관은 적용일 7일 전 서비스 내 공지를 통해 안내합니다.
              </li>
              <li>
                변경 약관 공지 후 이용자가 계속 서비스를 이용하는 경우 변경 약관에 동의한 것으로 봅니다.
              </li>
            </ol>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제4조 (회원 가입 및 로그인)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>회원 가입은 Google OAuth를 통한 소셜 로그인 방식으로만 이루어집니다.</li>
              <li>만 14세 미만은 서비스를 이용할 수 없습니다.</li>
              <li>
                이용자는 본인의 Google 계정 정보를 정확히 유지할 책임이 있으며,
                타인의 계정을 도용하여 서비스를 이용할 수 없습니다.
              </li>
              <li>
                계정 도용이 의심되는 경우 즉시 Google 계정 보안 설정을 점검하고
                서비스 운영팀에 신고하여야 합니다.
              </li>
            </ol>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제5조 (서비스 제공)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>
                서비스는 서브컬처(게임, 유튜버, VTuber 등) 관련 오프라인 이벤트 및 온라인 굿즈 정보를
                수집·가공하여 제공합니다.
              </li>
              <li>
                서비스 내 콘텐츠는 정보 제공을 목적으로 하며, 이벤트 참여·굿즈 구매 등의
                실제 거래는 각 원본 플랫폼에서 이루어집니다.
              </li>
              <li>
                서비스는 운영상의 필요에 따라 서비스의 일부 또는 전부를 변경하거나
                일시 중단할 수 있습니다.
              </li>
            </ol>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제6조 (이용자의 의무)</h2>
            <p className="text-sm mb-2">이용자는 다음 행위를 하여서는 안 됩니다.</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>타인의 개인정보 도용 및 허위 정보 등록</li>
              <li>서비스 운영을 방해하는 크롤링·스크래핑 등 자동화 접근</li>
              <li>서비스 내 콘텐츠의 무단 복제·배포·상업적 이용</li>
              <li>서비스의 취약점 탐색·악성코드 배포 등 해킹 행위</li>
              <li>관계 법령 또는 본 약관에서 금지한 행위</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제7조 (콘텐츠의 정확성)</h2>
            <p className="text-sm">
              서비스가 제공하는 이벤트·굿즈 정보는 공개된 외부 소스를 기반으로 합니다.
              정보의 정확성·최신성을 보장하지 않으며, 최종 참가 결정 전 원본 채널 및 공식 안내를
              반드시 확인하시기 바랍니다. 정보 오류로 인한 손해에 대해 서비스는 책임지지 않습니다.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제8조 (지식재산권)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>서비스가 자체 제작한 UI, 디자인, 코드에 대한 지식재산권은 서비스에 귀속됩니다.</li>
              <li>
                서비스 내 채널명, 이미지, 로고 등의 권리는 각 권리자에게 귀속되며,
                서비스는 정보 제공 목적으로만 이를 사용합니다.
              </li>
            </ol>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제9조 (서비스 중단 및 면책)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>
                천재지변, 서버 장애, 외부 API 서비스 중단 등 불가항력으로 인한
                서비스 중단에 대해서는 책임지지 않습니다.
              </li>
              <li>
                이용자가 서비스 정보를 이용하여 발생한 거래 또는 손해에 대해 서비스는 책임지지 않습니다.
              </li>
            </ol>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제10조 (회원 탈퇴 및 이용 제한)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>회원은 언제든지 탈퇴를 요청할 수 있으며, 탈퇴 즉시 개인화 데이터가 삭제됩니다.</li>
              <li>
                이용자가 본 약관 또는 관련 법령을 위반한 경우, 서비스는 사전 통보 없이
                서비스 이용을 제한하거나 계정을 삭제할 수 있습니다.
              </li>
            </ol>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제11조 (분쟁 해결)</h2>
            <p className="text-sm">
              본 약관에 관한 분쟁은 대한민국 법률을 준거법으로 하며,
              분쟁 발생 시 관할 법원은 민사소송법에 따릅니다.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">문의</h2>
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <p><span className="font-medium">운영팀 이메일:</span>{" "}
                <a href="mailto:gkimth7@gmail.com" className="text-blue-600 hover:underline">
                  gkimth7@gmail.com
                </a>
              </p>
              <p className="text-gray-500 text-xs mt-2">
              </p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-100 text-xs text-gray-400">
          © OUTDUCK (아웃덕). 본 약관은 대한민국 법률을 기준으로 작성되었습니다.
        </div>
      </div>
    </main>
  );
}
