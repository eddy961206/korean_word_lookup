/**
 * Korean Word Lookup Chrome Extension
 * Dictionary data provided by National Institute of Korean Language's Basic Korean Dictionary
 * (https://krdict.korean.go.kr)
 * Licensed under CC BY-SA 2.0 KR
 */

// 번역 기능 활성화 여부를 저장하는 변수
let isEnabled = true;
let isInitialized = false; // 초기화 여부를 추적하는 변수

// 초기 상태를 Promise로 가져오는 함수
async function initializeExtension() {

  // 크롬 스토리지에서 저장된 상태를 불러옵니다.
  const result = await new Promise(resolve => {
    chrome.storage.sync.get(['translationEnabled'], resolve);
  });

  // 초기 상태 설정
  isEnabled = result.translationEnabled !== false; // 기본값 true

  // 툴팁 요소 생성 및 이벤트 리스너 설정
  const $tooltip = $('<div>', {
    class: 'kr-tooltip',
    css: {
      display: 'none',    // 초기 숨김 상태
      position: 'absolute' // 위치 속성 명시적으로 설정
    }
  }).appendTo('body');

  // 팝업으로부터 상태 변경 메시지를 수신
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleTranslation') {
      isEnabled = request.enabled;
      if (!isEnabled) {
        $tooltip.hide();
        lastWord = '';
      }
      sendResponse({ status: 'success' }); // 반드시 응답을 보내야 함
      return true; // 비동기 응답을 허용
    }
  });

  // 스토리지 변경 사항을 실시간으로 감지
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.translationEnabled) {
      isEnabled = changes.translationEnabled.newValue;
      if (!isEnabled) {
        $tooltip.hide();
        lastWord = '';
      }
    }
  });

  let lastWord = '';

  isInitialized = true; // 초기화 완료 표시

  // 마우스 이동 이벤트 핸들러
  $(document).on('mousemove', async (e) => {
    if (!isEnabled || !isInitialized) return; // 초기화 전에는 동작하지 않음

    const koreanWord = getKoreanWordAtPoint(e.clientX, e.clientY);

    if (koreanWord && containsKorean(koreanWord)) {
      if (koreanWord !== lastWord) {
        lastWord = koreanWord;
        
        // 새로운 단어를 감지하면 먼저 툴팁을 숨김
        $tooltip.hide();
        
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        // 위치를 먼저 업데이트
        $tooltip.css({
          left: `${e.clientX + scrollX + 10}px`,
          top: `${e.clientY + scrollY + 10}px`
        });

        // 번역 중 표시
        $tooltip.text('').show();

        const translation = await translateText(koreanWord);
        if (translation) {
          // 현재 단어가 여전히 lastWord와 같은 경우에만 툴팁 업데이트
          if (koreanWord === lastWord) {
            $tooltip.text(`${koreanWord}: ${translation}`);
          }
        } else {
          if (koreanWord === lastWord) {
            $tooltip.text(`${koreanWord}: 번역할 수 없습니다.`);
          }
        }
      } else {
        // 같은 단어 위에 있을 때는 위치만 업데이트
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        $tooltip.css({
          left: `${e.clientX + scrollX + 10}px`,
          top: `${e.clientY + scrollY + 10}px`
        });
      }
    } else {
      $tooltip.hide();
      lastWord = '';
    }
  });

  return $tooltip;
}

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
      console.error('Translation error:', error);
      return null;
    }
  );
}

// 국립국어원 API를 사용하여 단어의 사전적 의미를 가져오는 함수
async function getDictionaryMeaning(word) {
  // background.js로부터 API 키 가져오기
  const response = await chrome.runtime.sendMessage({ action: 'getApiKey' });
  const API_KEY = response.apiKey;

  const url = `https://krdict.korean.go.kr/api/search?key=${API_KEY}&q=${encodeURIComponent(word)}&translated=y&trans_lang=1`;

  try {
    const response = await $.ajax({
      url: url,
      dataType: 'xml'
    });
    
    const $xml = $(response);
    const items = $xml.find('item');
    
    if (items.length > 0) {
      const word = items.eq(0).find('word').text();
      const pos = items.eq(0).find('pos').text();
      const definition = items.eq(0).find('sense definition').text();
      const translation = items.eq(0).find('translation trans_word').text();
      
      return `${word} (${pos}): ${definition}\nEnglish: ${translation}`;
    }
    return null;
  } catch (error) {
    console.error('Dictionary lookup error:', error);
    return null;
  }
}

// 익스텐션 초기화 실행
initializeExtension().catch(error => {
  console.error('Extension initialization error:', error);
});