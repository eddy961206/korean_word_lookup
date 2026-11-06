# Korean Word Lookup: 2.5.3 store release kit

Status: unpublished listing drafts and screenshot production brief. Version 2.5.3 is prospective; do not describe it as approved or available until the store confirms publication. This kit does not publish, upload, or modify the store listing.

## Positioning and claim rules

**Primary promise:** Read Korean web pages with English word meanings and selected-text translation in a tooltip.

**Audience:** People who read Korean and want English help without repeatedly copying text into a separate translator.

Lead with hover lookup, then optional selection translation. Explain the provider/key distinction before installation surprises the user. English, Korean, and Vietnamese refer to interface languages, not three translation output languages.

Source-backed claims: hover lookup; selection translation toggle; English results; Google without a user-supplied API key; KRDICT with the user's own API key; adjustable hover delay, compact display, maximum definitions, optional Korean dictionary definitions; configurable Chrome shortcuts. Selection uses the Google translation route, including when KRDICT is selected for words. Source fallback is optional and must not be presented as guaranteed success.

Avoid: “works on every site,” guaranteed instant results, guaranteed offline use, AI-powered claims, anonymous/no-tracking absolutes, “data never leaves your device,” unlimited availability, guaranteed accuracy, official Google affiliation, Chrome endorsement, current user/rating claims without a dated source, or promised learning/retention gains. Browser-controlled pages and some site content restrict extensions. Network/provider availability affects results.

## English listing draft

**Title:** Korean Word Lookup: Korean to English

**Short description:** Hover Korean words for English meanings. Select text to translate. Google Translate and KRDICT dictionary support.

**Full description:**

Read Korean web pages with English help right where you are reading.

Korean Word Lookup shows translations or dictionary meanings in a tooltip when you hover over Korean words. Turn on selection translation to translate a phrase or sentence into English.

Choose how you look up words:
- Google Translate: get English translations without entering an API key.
- KRDICT: view entries from the National Institute of Korean Language's Basic Korean Dictionary using your own KRDICT API key.
- Optional source fallback: try the other source if a word lookup has no usable result. Dictionary access still requires your key.

Make the tooltip fit your reading:
- Adjust the hover delay.
- Choose compact mode and the maximum number of definitions.
- Show Korean definitions alongside dictionary results.
- Use keyboard shortcuts to toggle translation, switch word sources, and turn selection translation on or off.

The interface is available in English, Korean, and Vietnamese. Translation results are in English. Selected-text translation uses Google, even when KRDICT is selected for word lookups.

Getting started:
1. Open a regular Korean web page and hover over a word.
2. Open the extension popup to adjust settings or enable selection translation.
3. To use KRDICT, enter your own API key in the popup.

Privacy and availability:
Words or selected text are sent to the relevant translation or dictionary provider to retrieve results. If source fallback is enabled, the other provider may also receive the word. Input and password fields, textareas, editable regions, and selections crossing editable content are skipped. Other page text can still be private; turn translation off before reading material you do not want a provider to receive.

This version does not send remote product analytics. Local usage information supports features such as onboarding and review prompts. Recent local diagnostics are limited to 200 events; events and daily buckets older than 30 days are removed when the next event is recorded. Installation state and aggregate usage counters can remain for the installation lifetime.

Your KRDICT key is kept only in memory for the current browser session, not persistent or sync storage. Enter it again after restarting Chrome or reloading/updating the extension. It is sent only to KRDICT for dictionary requests and is not returned to page content scripts. Ordinary settings can sync through Chrome. See the privacy policy for details. Internet access and provider availability affect results; Chrome restricts extensions on some pages.

This is an independent extension. Dictionary data is provided by the National Institute of Korean Language's Basic Korean Dictionary.

## 한국어 등록 문안

**제목:** Korean Word Lookup: 한국어를 영어로

**짧은 설명:** 한국어 단어에 마우스를 올려 영어 뜻을 확인하고, 선택한 문장을 번역하세요. Google 번역과 KRDICT 사전을 지원합니다.

**상세 설명:**

한국어 웹페이지를 읽다가 모르는 표현이 나오면, 읽던 자리에서 영어 뜻을 확인하세요.

Korean Word Lookup은 한국어 단어에 마우스를 올리면 번역이나 사전 뜻을 툴팁으로 보여 줍니다. 선택 번역을 켜면 구절이나 문장을 선택해 영어로 번역할 수 있습니다.

단어를 찾는 방법을 선택하세요.
- Google 번역: API 키를 입력하지 않고 영어 번역을 확인할 수 있습니다.
- KRDICT: 본인의 KRDICT API 키를 입력하면 국립국어원 한국어기초사전의 항목을 볼 수 있습니다.
- 자동 대체 조회: 설정을 켜면 단어 조회 결과가 없을 때 다른 제공자로 다시 조회할 수 있습니다. 사전 조회에는 여전히 본인의 키가 필요합니다.

읽기 방식에 맞게 조절하세요.
- 마우스를 올린 뒤 툴팁이 나타나는 시간을 조절할 수 있습니다.
- 간단한 툴팁과 최대 뜻 개수를 설정할 수 있습니다.
- 사전 결과에 한국어 풀이를 함께 표시할 수 있습니다.
- 단축키로 번역을 켜거나 끄고, 단어 조회 제공자를 바꾸고, 선택 번역을 켜거나 끌 수 있습니다.

인터페이스는 영어, 한국어, 베트남어를 지원하며 번역 결과는 영어입니다. 단어 조회에 KRDICT를 선택해도 선택한 문장의 번역에는 Google을 사용합니다.

시작하기:
1. 일반 한국어 웹페이지에서 단어에 마우스를 올려 보세요.
2. 확장 프로그램 팝업에서 설정을 조절하거나 선택 번역을 켜세요.
3. KRDICT를 사용하려면 팝업에 본인의 API 키를 입력하세요.

개인정보 및 이용 안내:
번역 결과를 가져오기 위해 단어나 선택한 텍스트가 해당 번역·사전 제공자에게 전송됩니다. 자동 대체 조회를 켜면 다른 제공자에게도 단어가 전송될 수 있습니다. 입력란, 비밀번호 입력란, 텍스트 입력 영역, 편집 가능한 영역과 해당 영역에 걸친 선택은 조회하지 않습니다. 다른 페이지 텍스트에도 사적인 내용이 있을 수 있으므로, 제공자에게 보내고 싶지 않은 내용을 읽을 때는 번역을 꺼 주세요.

이 버전은 외부로 제품 분석 정보를 전송하지 않습니다. 로컬 사용 정보는 시작 안내와 리뷰 요청 등에 사용됩니다. 최근 로컬 진단 기록은 최대 200개이며, 30일이 지난 이벤트와 날짜별 집계는 다음 이벤트가 기록될 때 삭제됩니다. 설치 상태와 누적 사용 횟수는 설치 기간 동안 남을 수 있습니다.

KRDICT 키는 현재 브라우저 세션의 메모리에만 보관되며 영구 저장하거나 동기화하지 않습니다. Chrome 재시작 또는 확장 프로그램 새로고침·업데이트 후 다시 입력해야 합니다. 키는 사전 조회를 위해 KRDICT에만 전송되며, 페이지 콘텐츠 스크립트로 반환되지 않습니다. 일반 설정은 Chrome을 통해 동기화될 수 있습니다. 자세한 내용은 개인정보처리방침을 확인하세요. 인터넷 연결과 제공자 상태에 따라 결과를 가져오지 못할 수 있으며, Chrome이 확장 프로그램 실행을 제한하는 페이지도 있습니다.

독립적으로 개발된 확장 프로그램입니다. 사전 데이터는 국립국어원 한국어기초사전에서 제공합니다.

## Nội dung cửa hàng bằng tiếng Việt

**Tiêu đề:** Korean Word Lookup: Dịch tiếng Hàn sang tiếng Anh

**Mô tả ngắn:** Di chuột lên từ tiếng Hàn để xem nghĩa tiếng Anh. Chọn văn bản để dịch. Hỗ trợ Google Dịch và từ điển KRDICT.

**Mô tả đầy đủ:**

Đọc trang web tiếng Hàn và xem nghĩa tiếng Anh ngay tại đoạn bạn đang đọc.

Korean Word Lookup hiển thị bản dịch hoặc nghĩa từ điển trong chú giải khi bạn di chuột lên một từ tiếng Hàn. Bật tính năng dịch văn bản được chọn để dịch cụm từ hoặc câu sang tiếng Anh.

Chọn nguồn tra từ:
- Google Dịch: xem bản dịch tiếng Anh mà không cần nhập khóa API.
- KRDICT: xem mục từ trong Từ điển tiếng Hàn cơ sở của Viện Quốc ngữ Quốc gia Hàn Quốc bằng khóa API KRDICT của riêng bạn.
- Tùy chọn chuyển nguồn: thử nguồn còn lại khi không có kết quả tra từ phù hợp. Bạn vẫn cần khóa riêng để dùng từ điển.

Điều chỉnh theo cách bạn đọc:
- Thay đổi độ trễ trước khi hiện chú giải.
- Chọn chế độ gọn và số lượng định nghĩa tối đa.
- Hiển thị thêm định nghĩa bằng tiếng Hàn trong kết quả từ điển.
- Dùng phím tắt để bật hoặc tắt bản dịch, đổi nguồn tra từ và bật hoặc tắt tính năng dịch văn bản được chọn.

Giao diện có tiếng Anh, tiếng Hàn và tiếng Việt. Kết quả dịch là tiếng Anh. Văn bản được chọn sử dụng Google để dịch, ngay cả khi bạn chọn KRDICT để tra từ.

Bắt đầu:
1. Mở một trang web tiếng Hàn thông thường và di chuột lên một từ.
2. Mở cửa sổ tiện ích để điều chỉnh cài đặt hoặc bật tính năng dịch văn bản được chọn.
3. Để dùng KRDICT, nhập khóa API của riêng bạn trong cửa sổ tiện ích.

Quyền riêng tư và khả năng sử dụng:
Từ hoặc văn bản được chọn được gửi đến nhà cung cấp bản dịch hoặc từ điển tương ứng để lấy kết quả. Nếu bật tùy chọn chuyển nguồn, từ cần tra cũng có thể được gửi đến nhà cung cấp còn lại. Tiện ích bỏ qua ô nhập liệu, ô mật khẩu, vùng nhập văn bản, vùng có thể chỉnh sửa và phần chọn đi qua nội dung có thể chỉnh sửa. Văn bản khác trên trang vẫn có thể chứa thông tin riêng tư; hãy tắt dịch trước khi đọc nội dung bạn không muốn gửi đến nhà cung cấp.

Phiên bản này không gửi dữ liệu phân tích sản phẩm ra bên ngoài. Thông tin sử dụng cục bộ hỗ trợ hướng dẫn ban đầu và lời nhắc đánh giá. Nhật ký chẩn đoán cục bộ gần đây có tối đa 200 sự kiện; sự kiện và số liệu theo ngày quá 30 ngày được xóa khi ghi nhận sự kiện tiếp theo. Trạng thái cài đặt và tổng số lần sử dụng có thể được giữ trong suốt thời gian cài đặt tiện ích.

Khóa KRDICT được lưu cục bộ trong Chrome, không được mã hóa và không được đồng bộ trong phiên bản này. Khóa chỉ được gửi đến KRDICT để tra từ điển và không được trả về cho tập lệnh nội dung trên trang. Các cài đặt thông thường có thể được Chrome đồng bộ. Xem chính sách quyền riêng tư để biết thêm chi tiết. Kết quả phụ thuộc vào kết nối Internet và tình trạng của nhà cung cấp; Chrome hạn chế tiện ích trên một số trang.

Đây là tiện ích được phát triển độc lập. Dữ liệu từ điển do Từ điển tiếng Hàn cơ sở của Viện Quốc ngữ Quốc gia Hàn Quốc cung cấp.

## Screenshot storyboard

Use five 1280 × 800 production canvases as an internal working size; verify accepted dimensions and file formats in the current submission dashboard. Export actual captured extension UI, not invented translation output. Label composites internally and keep all on-image claims faithful to the captured build. Do not use fabricated Chrome badges, review stars, adoption counters, endorsements, or browser dialogs.

Use a local controlled reading page with the sample text below. The text is author-created demo content, not a user's browsing history:

> 오늘은 도서관에서 한국어를 공부합니다. 새로운 단어를 공책에 적습니다. 내일은 친구와 함께 책을 읽습니다.

Do not prefill a fake “successful” response. Capture a real provider result using the release candidate. If live provider access is unavailable, mark the screenshot blocked instead of substituting a mock tooltip.

| Order | Headline | Capture | Accuracy checks |
| --- | --- | --- | --- |
| 1 | Hover a Korean word. See its English meaning. | Actual tooltip over 도서관 on the demo page; generous whitespace and readable text. | Google selected, extension enabled, actual result visible; no “instant” speed guarantee. |
| 2 | Select a sentence for more context. | Select 오늘은 도서관에서 한국어를 공부합니다. with selection translation enabled and its actual English tooltip. | Selection toggle is on; no implication that selection uses KRDICT. |
| 3 | Choose translation or dictionary lookup. | Two authentic popup/result captures: Google and KRDICT. Caption: “Google: no key needed. KRDICT: bring your own key.” | Mask or omit all key fields; KRDICT result requires an authorized test key; no manufactured result if absent. |
| 4 | Make the tooltip fit your reading. | Popup showing hover delay, compact mode, maximum definitions, Korean definitions. | Exact settings and labels from release candidate; do not crop out a limitation required to understand the feature. |
| 5 | Keep reading with keyboard shortcuts. | Real popup shortcut section with simple surrounding typography. | Correct platform set: Alt+T/G/K/S on Windows/Linux/ChromeOS; Option+Shift+T/G/K/S defaults on macOS. Users can customize in Chrome. |

Suggested hierarchy: large readable headline at top left, one feature per frame, real UI occupying most of the image, small plain-language condition below. Use one consistent neutral background, no fake application chrome. Check rendered text at thumbnail size and full size.

Existing `marketing/screenshots/final` and `scenes` are historical assets. They are not recaptured or revalidated by this kit. In particular, refresh the source-choice image to explain the KRDICT key requirement, and never treat an old welcome-demo image as evidence of live translation. No new final screenshot files are supplied here because current-browser capture has not been verified.

## Submission preparation checklist

- [ ] Final manifest, package metadata, lockfile, changelog and ZIP agree on version 2.5.3.
- [ ] Run `npm run check`; retain command output and test coverage limits.
- [ ] Build a clean ZIP with `python tools/package_release.py /absolute/path/to/korean-word-lookup-2.5.3.zip` only after version consistency passes. Record hash and file list.
- [ ] Confirm no keys, development fixtures, marketing documents, or remote analytics credentials in ZIP.
- [ ] Load the ZIP contents into Chrome for fresh-install and upgrade tests. Test provider error/missing key/selection off/on and shortcuts on supported platforms.
- [ ] Publish or update the genuine public privacy policy at an owner-approved location, then insert its verified URL into the store dashboard. This kit contains no invented policy URL.
- [ ] Fill store data and permission declarations from the final data flows. `storage` supports settings, session key and local state; provider host access supports lookups; broad content-script matching supports hover/selection on regular pages. Website text is transmitted for translation even without analytics.
- [ ] Check language-specific title/description limits, new store policies, and screenshot specifications in the current dashboard.
- [ ] Proofread Korean and Vietnamese in the rendered listing. Confirm English output is obvious in all languages.
- [ ] Capture final screenshots from the release candidate, with no personal browser data or keys visible.
- [ ] Confirm no stale “key saved in sync” language if the session-only key migration is included, and no claim of zero local diagnostics.
- [ ] Owner reviews final listing, policy, package, and store declarations before any submission. This document does not assert approval or publication.

## Measurement after publication

Use dated, actual store reports. Establish the baseline first; older documents' user counts, uninstall ratios and uplift targets are historical/unverified, not current performance. A version change and a copy change at the same time confound attribution.

Start with one descriptive change: make “English results” and “own KRDICT key” explicit. Track whatever listing-view/install metrics the dashboard actually provides for comparable periods. Separate install conversion from uninstall/install counts; neither is D7 cohort retention. Do not claim A/B test capability or page dwell metrics without verifying they exist. Do not manufacture minimum sample sizes or declare success from a short noisy before/after comparison.

Remote product analytics is deferred; see `PRIVACY_ANALYTICS_PLAN.md`. Local installation counters are not a live business dashboard.

## Verification limits

This kit is based on repository feature inspection and the coordinated 2.5.3 release plan. It does not verify the live store version, current store policy fields, provider uptime, browser screenshots, public privacy-policy accessibility, translated copy's native-speaker review, or release approval. Those are explicit pre-publication checks, not completed work.
