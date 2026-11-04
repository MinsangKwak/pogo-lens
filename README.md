# PoGo Lens

**포켓몬 GO의 개체값을 확인하고, 내가 가진 같은 종의 순위로 이름을 제안하는 React Native 앱입니다.**

평가 화면 확인 → 보유 목록 비교 → 이름 작성으로 이어지는 반복 작업을 줄이기 위해 만들었습니다. Android와 iOS의 화면·보유 기록·계산 흐름은 공유하고, 화면 캡처는 각 운영체제의 네이티브 API로 구현했습니다.

현재는 **샘플 종 4종으로 수동 확인·저장·순위·이름 제안을 연결한 개발 버전**입니다. 실제 기기와 게임에서 캡처 정확도·권한·장시간 동작을 검증하는 단계가 남아 있습니다.

## 핵심 흐름

1. Android에서는 플로팅 캡처, iOS에서는 시스템 화면 공유를 시작하거나 값을 직접 입력합니다.
2. 종과 IV를 직접 확인하고, 같은 IV의 기록이 있으면 기존 개체 업데이트 또는 새 개체 추가를 선택합니다.
3. 같은 종·폼의 보유 순위와 변경될 이름 목록을 확인합니다.
4. 제안한 이름을 검토·복사해 게임에서 직접 붙여 넣습니다. 별도의 적용 확인을 눌러야 앱의 이름 기록이 바뀝니다.

예를 들어 같은 종을 2마리 확인했다면 `1/2 FFF`, `2/2 AFF` 같은 이름을 제안합니다. `FFF`는 공격·방어·체력 15/15/15를 16진수로 줄인 표기입니다. 순위는 **IV 합 → 공격 → 방어 → 체력**, 동일 IV는 공동 순위입니다. 배틀 리그 성능 순위와는 다른 기준입니다.

## 구현 범위

| 영역          | 현재 구현                                                         | 남은 검증·개발                                       |
| ------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| 공통 화면     | 관측·보유 목록·설정, 청록색 반투명 패널, 입력 보존·검증           | 기기별 큰 글자·TalkBack·VoiceOver                    |
| 계산·워크플로 | 공유 TypeScript 코어, 명시적 중복 처리, 변경 제안·이름 보호·이력  | 전체 종 데이터와 버전 갱신                           |
| Android       | Kotlin 오버레이·MediaProjection·알림 중지, 캡처 시각·크기 전달    | OCR과 IV 바 인식. 현재 자동 숫자 추출 없음           |
| iOS           | Swift 실시간 캡처 어댑터, Vision의 최소 CP·HP 텍스트 후보         | 실제 기기·게임 화면 정확도. 종·IV는 직접 입력        |
| 저장          | 네이티브 AsyncStorage 3의 확인 완료 기록, JSON 내보내기·전체 삭제 | 이전 스키마 마이그레이션·대용량 운영 검증            |
| 웹 체험       | 같은 RN 컴포넌트를 React Native Web으로 실행, 실제 계산·입력 연습 | 캡처 미지원. 기록은 탭 메모리이며 새로고침 시 초기화 |

iOS 캡처 코드는 15.1–26에서 ReplayKit Broadcast Extension, 27 이상에서 ScreenCaptureKit 시스템 picker로 분기합니다. iOS 27 경로는 해당 SDK로 빌드해야 하며, 시뮬레이터에서는 실시간 캡처를 제공하지 않습니다. App Group과 두 타깃의 서명 설정은 [모바일 실행 안내](apps/mobile/README.md)를 따릅니다. 이 구현 경로가 모든 버전·기기의 동작 검증 완료를 뜻하지는 않습니다.

현재 종 데이터는 마릴리·뮤츠·요가램·이상해씨 4종입니다. 계정 연결, 게임 서버 호출, 자동 탭·교환·이름 변경은 구현하지 않습니다.

## 기술 선택과 설계

- **React Native 0.88.1 + React 19.3.0:** Android·iOS에 같은 TypeScript UI와 워크플로를 사용합니다. WebView로 화면을 감싸지 않습니다.
- **순수 계산과 상태 전이 분리:** `core`는 IV·순위·이름 규칙, `workflow`는 미확인 후보·보유 기록·적용 이력의 경계를 담당합니다.
- **운영체제별 캡처:** Kotlin과 Swift 어댑터를 Codegen 기반 TurboModule로 연결합니다. 계산을 Kotlin·Swift로 다시 구현하지 않습니다.
- **확인 전 저장 방지:** 캡처와 OCR은 후보이며, 사용자가 확인한 수치만 영구 보유 기록에 넣습니다. 같은 수치만으로 개체를 합치지 않습니다.
- **예측 가능한 이름 변경:** 12자 제한, 명시적 보호 해제, 오래된 제안 차단, 복사와 사용자 적용 확인을 분리했습니다.
- **캡처 정보 최소화:** 원본 이미지·영상·음성을 저장하지 않습니다. iOS의 짧은 텍스트 후보와 Android의 프레임 메타데이터는 영구 보유 기록과 분리합니다.

## 저장소 구조

| 경로                                           | 역할                                    |
| ---------------------------------------------- | --------------------------------------- |
| `apps/mobile/App.tsx`, `src/screens`, `src/ui` | 공통 네이티브 UI와 웹 체험 화면         |
| `apps/mobile/src/controller`, `src/storage`    | 워크플로 연결, 비동기 저장·오류 관리    |
| `apps/mobile/src/native`                       | 버전이 있는 캡처 브리지 계약            |
| `apps/mobile/android`                          | Kotlin 오버레이와 MediaProjection       |
| `apps/mobile/ios`                              | Swift 캡처·Vision·Broadcast Extension   |
| `packages/core`                                | 순수 TypeScript 계산·순위·이름 규칙     |
| `packages/workflow`                            | 확인·중복·저장 형식·이름 적용 상태 전이 |

## 실행과 검증

Node.js는 저장소 `engines` 범위를 따릅니다. CI와 맞추려면 Node 24를 사용합니다.

```bash
npm install
npm run check
npm start
```

다른 터미널에서 기기 환경에 맞게 실행합니다.

```bash
npm run android
npm run ios
```

Android는 JDK 17과 Android SDK·NDK, iOS는 macOS·Xcode·CocoaPods와 서명 설정이 필요합니다. 설치·App Group·기기 검증 절차는 [모바일 README](apps/mobile/README.md)에 있습니다. CI에서는 잠금 파일을 사용하는 `npm ci`로 설치합니다.

```bash
npm run web -w @pogo-lens/mobile
npm run build:web -w @pogo-lens/mobile
```

`npm run check`는 JS/TS lint·타입·단위 테스트와 공유 패키지 빌드를 실행합니다. `npm run build`는 `core`와 `workflow`만 빌드하며 APK·iOS 앱을 만들지 않습니다. Metro 번들, Android 네이티브 빌드, iOS 네이티브 빌드와 실기기 테스트는 별도입니다.

현재 자동 검사는 계산·워크플로·UI 이벤트·저장·브리지·Android 캡처 정책을 다룹니다. 대상 커밋의 원격 검사 결과는 [GitHub Actions](https://github.com/MinsangKwak/pogo-lens/actions)에서 확인합니다. 네이티브 CI의 컴파일 성공과 실제 기기·게임에서의 캡처 검증은 별도로 확인해야 합니다.

[아키텍처](docs/ARCHITECTURE.md) · [디자인](DESIGN.md) · [개발 계약](docs/DEVELOPMENT_GUARDS.md) · [보안과 기기 검증](docs/SECURITY_REVIEW.md) · [로드맵](docs/ROADMAP.md) · [소스코드](https://github.com/MinsangKwak/pogo-lens)

팬 메이드 개인 개발 프로젝트이며 Pokémon, Niantic, Nintendo와 관계가 없습니다.
