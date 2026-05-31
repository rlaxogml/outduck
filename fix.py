import os

path = r'c:\Users\gkimt\outduck\app\company\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

bad_snippet = """            <div className=\"relative z-10 flex-1 text-center sm:text-left space-y-1\">
                }}
              >
                {company.name}
                <div className=\"opacity-0 group-hover:opacity-100 transition-opacity bg-muted/50 p-1.5 rounded-lg ml-0.5 hover:bg-muted\" title=\"회사 정보 수정\">
                  <Settings className=\"w-5 h-5 text-muted-foreground\" />
                </div>
              </h1>
              <p className=\"text-muted-foreground text-xs md:text-sm font-medium\">
                통합 파트너 관리 콘솔 • 소속 채널 {channels.length}개
              </p>
            </div>

            {/* Ad Application Button */}
            <div className=\"relative z-10 sm:self-center mt-2 sm:mt-0 w-full sm:w-auto shrink-0\">
              <Button
                onClick={() => router.push(\"/ad-apply\")}
                className=\"w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl md:rounded-2xl text-sm shadow-sm md:shadow-md h-11 md:h-10 px-5 transition-all flex items-center justify-center gap-1.5\"
              >
                광고 신청
              </Button>
            </div>"""

good_snippet = """            <div className=\"relative z-10 flex-1 text-center sm:text-left space-y-1\">
              <h1 className=\"text-2xl md:text-3xl font-black tracking-tight flex items-center justify-center sm:justify-start gap-2 w-fit mx-auto sm:mx-0\">
                {company.name}
              </h1>
              <p className=\"text-muted-foreground text-xs md:text-sm font-medium\">
                통합 파트너 관리 콘솔 • 소속 채널 {channels.length}개
              </p>
            </div>

            {/* Action Buttons (Ad Apply & Profile Edit) */}
            <div className=\"relative z-10 sm:self-center mt-2 sm:mt-0 w-full sm:w-auto shrink-0 flex items-center justify-center sm:justify-start gap-2\">
              <Button
                onClick={() => router.push(\"/ad-apply\")}
                className=\"flex-1 sm:flex-initial bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl md:rounded-2xl text-sm shadow-sm md:shadow-md h-11 md:h-10 px-5 transition-all flex items-center justify-center gap-1.5\"
              >
                광고 신청
              </Button>
              <Button
                onClick={() => {
                  if (company) {
                    setEditCompanyName(company.name);
                    setEditCompanyImageUrl(company.profile_image_url || \"\");
                    setIsCompanyEditOpen(true);
                  }
                }}
                variant=\"outline\"
                className=\"flex-1 sm:flex-initial font-bold rounded-xl md:rounded-2xl text-sm shadow-sm md:shadow-md h-11 md:h-10 px-4 transition-all flex items-center justify-center gap-1.5 border-border bg-background hover:bg-muted text-foreground\"
              >
                <Settings className=\"w-4 h-4 mr-0.5\" />
                프로필 수정
              </Button>
            </div>"""

text = text.replace(bad_snippet, good_snippet)
text = text.replace(bad_snippet.replace('\n', '\r\n'), good_snippet.replace('\n', '\r\n'))

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')
