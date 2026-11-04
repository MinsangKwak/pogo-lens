# 웹 체험

별도 화면을 흉내 내는 목업이 아니라 `apps/mobile/App.tsx`와 같은 React Native 화면을 React Native Web으로 실행한다. 순위와 이름 계산은 같은 `@pogo-lens/core`, 확인·적용 이력은 같은 `@pogo-lens/workflow`를 사용한다.

브라우저에서는 다른 앱 위 오버레이와 게임의 실시간 화면 캡처를 제공하지 않는다. 직접 입력한 IV로 보유 기록을 만들고, 중복 선택·공동 순위·이름 제안·보호·웹 입력 연습을 검증할 수 있다. 클립보드 복사와 JSON 다운로드는 브라우저의 실제 기능이다.

웹 기록은 현재 탭의 메모리에만 남고 새로고침하면 초기화된다. 로컬 저장소, IndexedDB, 이미지 업로드, 서버 저장은 사용하지 않는다. 웹의 이름 적용 연습은 `web-simulation`으로 기록하며 실제 게임 적용 확인으로 기록하지 않는다.

루트에서 의존성을 설치한 뒤 `apps/mobile`에서 아래 명령으로 검증한다.

```sh
npx tsc -p tsconfig.web.json --noEmit
npx vite build
```

배포할 정적 결과는 `apps/mobile/dist-web`이다. 네이티브 캡처와 저장 장치 대신 `.web.ts` 어댑터가 선택된다. Vite는 웹 실행과 빌드를 담당하고 Android·iOS 앱은 기존 Metro 설정을 계속 사용한다.

검토할 흐름은 직접 입력 후 저장, 같은 IV의 별도 개체 또는 기존 기록 갱신 선택, 순위 비교, 이름 수정과 복사, 웹 입력 값 일치 확인, 이름 보호, JSON 내보내기, 전체 삭제다. 실제 Android·iOS 캡처 권한과 앱 전환 동작은 기기에서 별도로 확인해야 한다.
