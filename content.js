// 툴팁 요소 생성
const tooltip = document.createElement('div');
tooltip.className = 'kr-tooltip';
document.body.appendChild(tooltip);

// 문자열에 한국어 문자가 포함되어 있는지 확인하는 함수
function containsKorean(text) {
  return /[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/.test(text);
}

// 마우스 위치에서 한국어 단어를 찾는 함수
function getKoreanWordAtPoint(x, y) {
  let range;
  // 브라우저 호환성을 위해 caretRangeFromPoint와 caretPositionFromPoint 사용
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

      // 좌우로 단어 확장
      let start = offset;
      let end = offset;

      while (start > 0 && /[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/.test(text.charAt(start - 1))) {
        start--;
      }
      while (end < text.length && /[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/.test(text.charAt(end))) {
        end++;
      }

      if (start !== end) {
        const word = text.slice(start, end);
        return word;
      }
    }
  }
  return null;
}

// 구글 번역 API를 사용하는 번역 함수
async function translateText(text) {
  try {
    // 구글 번역 API URL 생성
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('번역에 실패했습니다.');
    
    const data = await response.json();
    // 번역된 텍스트 반환
    return data[0][0][0];
  } catch (error) {
    console.error('번역 오류:', error);
    return null;
  }
}

let lastWord = '';
let hideTooltipTimeout = null;

// 마우스 이동 이벤트 핸들러
document.addEventListener('mousemove', async (e) => {
  const koreanWord = getKoreanWordAtPoint(e.clientX, e.clientY);

  if (koreanWord && containsKorean(koreanWord)) {
    if (koreanWord !== lastWord) {
      lastWord = koreanWord;
      tooltip.textContent = '번역 중...';
      
      // 툴팁 위치 설정
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.pageX + 10}px`;
      tooltip.style.top = `${e.pageY + 10}px`;

      const translation = await translateText(koreanWord);
      if (translation) {
        tooltip.textContent = `${koreanWord}: ${translation}`;
      } else {
        tooltip.textContent = `${koreanWord}: 번역할 수 없습니다.`;
      }
    } else {
      // 단어가 동일하면 위치만 업데이트
      tooltip.style.left = `${e.pageX + 10}px`;
      tooltip.style.top = `${e.pageY + 10}px`;
    }

    // 툴팁 자동 숨김 타이머 취소
    if (hideTooltipTimeout) {
      clearTimeout(hideTooltipTimeout);
      hideTooltipTimeout = null;
    }
  } else {
    // 툴팁 숨기기
    tooltip.style.display = 'none';
    lastWord = '';
  }
});

// 더블 클릭 이벤트 핸들러
document.addEventListener('dblclick', async (e) => {
  const selection = window.getSelection().toString().trim();
  
  if (containsKorean(selection)) {
    console.log('더블 클릭으로 선택된 단어:', selection);
    tooltip.textContent = '번역 중...';
    tooltip.style.display = 'block';
    tooltip.style.left = `${e.pageX + 10}px`;
    tooltip.style.top = `${e.pageY + 10}px`;
    
    const translation = await translateText(selection);
    if (translation) {
      tooltip.textContent = `${selection}: ${translation}`;
      
      // 3초 후에 툴팁 숨기기
      hideTooltipTimeout = setTimeout(() => {
        tooltip.style.display = 'none';
        hideTooltipTimeout = null;
      }, 3000);
    } else {
      tooltip.textContent = `${selection}: 번역할 수 없습니다.`;
    }
  }
});
