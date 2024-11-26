// 현재 페이지의 URL을 콘솔에 출력합니다.
console.log('현재 페이지 URL:', window.location.href);


// 번역 기능 활성화 여부를 저장하는 변수
let isEnabled = true;

// 크롬 스토리지에서 저장된 상태를 불러옵니다.
chrome.storage.sync.get(['translationEnabled'], (result) => {
  if (typeof result.translationEnabled !== 'undefined') {
    isEnabled = result.translationEnabled;
  } else {
    // 저장된 값이 없으면 기본값을 true로 설정합니다.
    isEnabled = true;
  }
});

// 팝업으로부터 상태 변경 메시지를 수신하여 번역 기능의 활성화 상태를 업데이트합니다.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleTranslation') {
    isEnabled = request.enabled;
    if (!isEnabled) {
      $tooltip.hide(); // 툴팁 숨기기
      lastWord = '';   // 마지막 단어 초기화
    }
    // 응답을 보내어 메시지 포트가 닫히는 오류를 방지합니다.
    sendResponse({ status: 'success' });
  }
});

// 툴팁 요소를 생성하여 문서에 추가합니다.
const $tooltip = $('<div>', {
  class: 'kr-tooltip'
}).appendTo('body');

// 문자열에 한국어 문자가 포함되어 있는지 확인하는 함수
function containsKorean(text) {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(text);
}

// 마우스 위치에서 한국어 단어를 추출하는 함수
function getKoreanWordAtPoint(x, y) {
  let range;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos && pos.offsetNode) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.setEnd(pos.offsetNode, pos.offset);
    }
  }

  if (range) {
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const offset = range.startOffset;

      let start = offset;
      let end = offset;

      // 왼쪽으로 한국어 문자가 아닐 때까지 이동
      while (start > 0 && containsKorean(text.charAt(start - 1))) {
        start--;
      }
      // 오른쪽으로 한국어 문자가 아닐 때까지 이동
      while (end < text.length && containsKorean(text.charAt(end))) {
        end++;
      }

      if (start !== end) {
        return text.slice(start, end);
      }
    }
  }
  return null;
}

// 구글 번역 API를 사용하여 텍스트를 번역하는 함수
function translateText(text) {
  return $.ajax({
    url: 'https://translate.googleapis.com/translate_a/single',
    data: {
      client: 'gtx',
      sl: 'ko',
      tl: 'en',
      dt: 't',
      q: text
    },
    dataType: 'json'
  }).then(
    data => data[0][0][0],
    error => {
      console.error('번역 오류:', error);
      return null;
    }
  );
}

let lastWord = '';
let hideTooltipTimeout = null;

// 마우스 이동 이벤트 핸들러
$(document).on('mousemove', async (e) => {
  if (!isEnabled) return; // 번역 기능이 비활성화된 경우 함수 종료

  const koreanWord = getKoreanWordAtPoint(e.clientX, e.clientY);

  if (koreanWord && containsKorean(koreanWord)) {
    if (koreanWord !== lastWord) {
      console.log(koreanWord);
      lastWord = koreanWord;
      $tooltip.text('번역 중...');

      // 툴팁 위치 설정 및 표시
      $tooltip.css({
        display: 'block',
        left: `${e.pageX + 10}px`,
        top: `${e.pageY + 10}px`,
        zIndex: 1000000000
      });

      const translation = await translateText(koreanWord);
      if (translation) {
        $tooltip.text(`${koreanWord}: ${translation}`);
      } else {
        $tooltip.text(`${koreanWord}: 번역할 수 없습니다.`);
      }
    } else {
      // 단어가 동일하면 툴팁 위치만 업데이트
      $tooltip.css({
        left: `${e.pageX + 10}px`,
        top: `${e.pageY + 10}px`
      });
    }

    // 툴팁 자동 숨김 타이머 취소
    if (hideTooltipTimeout) {
      clearTimeout(hideTooltipTimeout);
      hideTooltipTimeout = null;
    }
  } else {
    // 한국어 단어가 없으면 툴팁 숨기기
    $tooltip.hide();
    lastWord = '';
  }
});
