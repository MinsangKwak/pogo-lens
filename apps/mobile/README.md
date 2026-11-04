# PoGo Lens 모바일 앱

React Native 0.88.1·React 19.3.0·TypeScript로 Android와 iOS 화면을 공유합니다. `packages/core`가 계산을, `packages/workflow`가 확인·저장·이름 적용 상태를 담당합니다. Kotlin·Swift는 운영체제 캡처와 클립보드에 사용하며 WebView를 사용하지 않습니다.

## 현재 범위

- 관측·내 보유 목록·설정 3탭, IV 수동 확인, 명시적 기존/새 개체 선택, 실제 순위·이름 제안
- 네이티브 AsyncStorage 3에 확인 완료 기록 저장, JSON 내보내기·전체 삭제, 손상 원본 보존
- Android: 플로팅 버튼·MediaProjection·알림 중지. 현재 캡처 시각·크기만 전달하며 OCR·IV 자동 입력은 없음
- iOS: ReplayKit 또는 iOS 27 ScreenCaptureKit 실시간 캡처와 Vision의 최소 CP·HP·평가 라벨 텍스트 후보. 종·IV는 직접 입력
- 마릴리·뮤츠·요가램·이상해씨의 샘플 종 4종. 전체 도감은 미포함

복사는 게임 이름을 바꾸지 않습니다. 게임에서 직접 붙여 넣고 저장한 뒤 별도 확인을 눌러야 `user-confirmed` 이력이 남습니다. 자동 탭·자동 교환은 구현하지 않습니다.

## 준비

저장소 루트에서 Node 24와 npm을 사용합니다. 실제 버전 범위는 루트 `package.json`의 `engines`를 따릅니다.

```bash
npm install
npm run check
npm start
```

Metro를 실행한 채 다른 터미널에서 플랫폼 명령을 실행합니다. CI와 같은 의존성 설치는 `npm ci`입니다.

## Android

JDK 17, Android SDK Platform 37·Build Tools 37.0.0, NDK 27.1.12297006·CMake 3.22.1을 준비합니다. 현재 최소 타깃은 API 29(Android 10)이며, 모든 해당 기기의 실사용 검증 완료를 뜻하지 않습니다.

```bash
npm run android
```

처음 실행하면 표시 권한과 캡처 동의를 직접 허용합니다. 게임 평가 화면에서 플로팅 버튼으로 프레임을 얻은 뒤 앱으로 돌아와 후보의 종·IV를 입력합니다. 현재 Android 후보에는 자동 추출된 숫자가 없습니다. 알림·앱·시스템 캡처 표시로 중지 상태를 확인합니다.

별도 네이티브 검사:

```bash
cd apps/mobile/android
bash gradlew --no-daemon testDebugUnitTest lintDebug assembleDebug
```

## iOS

macOS·Xcode·Ruby Bundler·CocoaPods가 필요합니다. iOS 최소 타깃은 15.1이며 iOS 27 캡처 경로를 빌드하려면 해당 SDK를 포함한 Xcode 27을 사용합니다.

저장소 루트에서 CocoaPods를 준비합니다.

```bash
cd apps/mobile
bundle install
bundle exec pod install --project-directory=ios
```

`ios/PogoLens.xcworkspace`를 열고 실제 기기 빌드 전에 다음을 설정합니다.

1. `PogoLens`와 `PogoLensBroadcast` 두 타깃에 같은 Apple Developer Team을 지정합니다.
2. `POGO_LENS_BUNDLE_ID`를 본인 소유 ID로 바꿉니다. 확장 ID는 `.broadcast`를 붙이는 설정을 유지합니다.
3. 두 타깃의 `POGO_LENS_APP_GROUP`을 같은 등록된 App Group ID로 설정하고 Signing & Capabilities의 App Groups에도 활성화합니다.
4. 호스트의 화면 캡처 background mode, 확장 임베딩과 두 타깃의 프로비저닝을 확인합니다. 실제 기기를 선택해 서명·설치합니다.

루트로 돌아와 실행할 수도 있습니다.

```bash
npm run ios
```

시뮬레이터에서는 수동 확인·계산 UI를 확인할 수 있지만 실시간 캡처는 비활성화됩니다. Apple Developer 계정의 App Group 등록·서명·프로비저닝은 자동 설정하지 않으며 CI에도 서명 자격 증명을 넣지 않습니다.

| 기기 OS     | 캡처 코드                                                             |
| ----------- | --------------------------------------------------------------------- |
| iOS 15.1–26 | 앱에서 준비 → 시스템 ReplayKit picker → PoGo Lens Broadcast Extension |
| iOS 27+     | ScreenCaptureKit 시스템 콘텐츠 공유 picker → SCStream                 |

세션을 시작하고 게임 평가 화면으로 이동한 뒤 앱으로 돌아와 최소 텍스트 후보를 확인합니다. 후보는 숫자의 정답 판정이 아닙니다. 종·IV를 직접 확인해야 저장됩니다. 최대 1fps·10분으로 제한하고 원본 이미지·영상·음성을 저장하지 않습니다. App Group 미설정·지원 SDK 부재는 캡처 불가 안내로 표시합니다.

소스에 두 경로가 구현되어 있어도 실제 게임 호환성·정확도·잠금·장시간 동작 검증은 별도입니다.

연속된 같은 화면만 세션별 메모리 픽셀 지문으로 억제합니다. CP·HP 문자열이 같아도 IV 바 픽셀이 다르면 별도 후보로 남기며 개체 병합은 사용자 확인으로 결정합니다. [iOS 서명·구현 상세](ios/README.md)에 제한과 네이티브 검사 절차가 있습니다.

## 같은 화면의 웹 체험

```bash
npm run web -w @pogo-lens/mobile
npm run typecheck:web -w @pogo-lens/mobile
npm run build:web -w @pogo-lens/mobile
```

React Native Web으로 같은 컴포넌트·코어·워크플로를 사용합니다. 캡처와 네이티브 권한은 없고 기록은 탭 메모리에만 유지되어 새로고침 시 초기화됩니다. 이름 입력 연습은 `web-simulation`으로 기록하며 게임 이름은 변경하지 않습니다. JSON은 브라우저 다운로드로 내보냅니다.

## 검사 종류

| 명령                                           | 검사 범위                                                    |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `npm run check`                                | 공유 패키지·모바일 lint, 타입, 단위 테스트, 공유 패키지 빌드 |
| `npm run build`                                | `core`와 `workflow`만 빌드                                   |
| `npm run bundle:android`, `npm run bundle:ios` | Metro JS 번들. 네이티브 앱 빌드 아님                         |
| Gradle 검사                                    | Android 컴파일·JVM 테스트·lint·APK                           |
| Xcode 검사                                     | iOS 호스트·Broadcast Extension 컴파일                        |

원격 검사 정의는 [checks.yml](../../.github/workflows/checks.yml), 대상 커밋 결과는 [Actions](https://github.com/MinsangKwak/pogo-lens/actions)에서 확인합니다. 서명 없는 시뮬레이터 CI와 자동 테스트는 실기기 캡처를 검증하지 않습니다. [기기 검증 목록](../../docs/SECURITY_REVIEW.md)을 별도로 완료합니다.

## 코드 찾기

`App.tsx` → `src/screens`·`src/ui` → `src/controller/useLensController.ts` → 공유 `workflow`·`core` 순으로 읽을 수 있습니다. `src/native/NativePogoLensCapture.ts`의 Codegen 명세와 `protocolVersion: 1` JSON을 Kotlin·Swift 어댑터가 구현합니다.

스타일의 실행 소스는 `src/ui/theme.ts`입니다. [아키텍처](../../docs/ARCHITECTURE.md)와 [개발 계약](../../docs/DEVELOPMENT_GUARDS.md)에 저장·중복·보호·실패 경계를 정리했습니다.
