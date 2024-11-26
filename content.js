// 툴팁 요소 생성
const $tooltip = $('<div>', {
  class: 'kr-tooltip'
}).appendTo('body');

// 문자열에 한국어 문자가 포함되어 있는지 확인하는 함수
function containsKorean(text) {
  return /[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/.test(text);
}

// 마우스 위치에서 한국어 단어를 찾는 함수
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

      while (start > 0 && /[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/.test(text.charAt(start - 1))) {
        start--;
      }
      while (end < text.length && /[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/.test(text.charAt(end))) {
        end++;
      }

      if (start !== end) {
        return text.slice(start, end);
      }
    }
  }
  return null;
}

// 번역 함수
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
  const koreanWord = getKoreanWordAtPoint(e.clientX, e.clientY);

  if (koreanWord && containsKorean(koreanWord)) {
    if (koreanWord !== lastWord) {
      lastWord = koreanWord;
      $tooltip.text('번역 중...');
      
      // 툴팁 위치 및 표시 설정
      $tooltip.css({
        display: 'block',
        left: `${e.pageX + 10}px`,
        top: `${e.pageY + 10}px`
      });

      const translation = await translateText(koreanWord);
      if (translation) {
        $tooltip.text(`${koreanWord}: ${translation}`);
      } else {
        $tooltip.text(`${koreanWord}: 번역할 수 없습니다.`);
      }
    } else {
      $tooltip.css({
        left: `${e.pageX + 10}px`,
        top: `${e.pageY + 10}px`
      });
    }

    if (hideTooltipTimeout) {
      clearTimeout(hideTooltipTimeout);
      hideTooltipTimeout = null;
    }
  } else {
    $tooltip.hide();
    lastWord = '';
  }
});

// 더블 클릭 이벤트 핸들러
$(document).on('dblclick', async (e) => {
  const selection = window.getSelection().toString().trim();
  
  if (containsKorean(selection)) {
    console.log('더블 클릭으로 선택된 단어:', selection);
    
    $tooltip
      .text('번역 중...')
      .css({
        display: 'block',
        left: `${e.pageX + 10}px`,
        top: `${e.pageY + 10}px`
      });
    
    const translation = await translateText(selection);
    if (translation) {
      $tooltip.text(`${selection}: ${translation}`);
      
      // 3초 후에 툴팁 숨기기
      hideTooltipTimeout = setTimeout(() => {
        $tooltip.hide();
        hideTooltipTimeout = null;
      }, 3000);
    } else {
      $tooltip.text(`${selection}: 번역할 수 없습니다.`);
    }
  }
});
