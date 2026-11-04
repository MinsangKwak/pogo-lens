# iOS 화면 인식 연결

공통 React Native 화면은 `PogoLensCapture` TurboModule을 호출한다. 네이티브 캡처는 JS가 백그라운드에서 계속 실행된다고 가정하지 않는다. 화면 인식 결과는 미확정 후보이며 사용자가 앱으로 돌아와 종과 개체값을 확인해야 한다.

## 기기와 시스템 경로

| 조건 | 캡처 방식 |
| --- | --- |
| iOS 27 이상 · 해당 SDK로 빌드 | ScreenCaptureKit 시스템 선택기와 실제 SCStream |
| iOS 15.1~26 | ReplayKit 시스템 방송 선택기와 Broadcast Upload Extension |
| 시뮬레이터 | 실시간 캡처 지원으로 표시하지 않음 |
| iOS 27 SDK가 없는 빌드에서 iOS 27 실행 | 지원 불가 상태와 SDK 연결 안내 |

iOS 27에서는 시스템 선택기에서 게임 화면을 읽을 수 있는 공유 범위를 직접 고른다. 자기 앱 내부 공유만 선택하면 다른 앱의 게임 화면을 읽을 수 없다. 이전 iOS에서는 앱의 캡처 시작 버튼 다음에 나타나는 실제 시스템 화면 기록 버튼을 눌러 PoGo Lens를 선택한다. 선택기 표시만으로 실행 중이라고 기록하지 않는다.

iOS에서 게임 위의 임의 오버레이나 게임 조작을 제공하지 않는다. 앱으로 돌아와 인식 후보를 검토하고 제안한 이름을 복사하는 흐름이다.

## 서명 설정

1. `PogoLens.xcworkspace`를 열고 호스트 `PogoLens`와 `PogoLensBroadcast` 타깃에 같은 Apple 개발 팀을 선택한다.
2. 두 타깃이 같은 App Group을 사용하도록 등록한다. 기본값은 `group.dev.pogolens.app`이며 본인 팀에서 사용할 수 있는 식별자로 바꾼다.
3. 두 타깃의 `POGO_LENS_APP_GROUP`과 `POGO_LENS_BUNDLE_ID`를 함께 설정한다. 번들 기본값은 `dev.pogolens.app`, 확장 번들은 그 뒤에 `.broadcast`가 붙는다.
4. App Group이 포함된 프로비저닝 프로파일로 실제 기기에 설치한다. 호스트의 Screen Capture 백그라운드 모드와 목적 문구는 Info.plist에 선언돼 있다.

구성되지 않은 App Group은 `requiresSetup: true`를 반환한다. 소스의 기본 식별자만으로 다른 개발 팀의 서명을 사용할 수 있는 것은 아니다.

## 데이터와 중지

- 원본 화면, 사진, 영상, 오디오는 파일이나 네트워크로 내보내지 않는다. 오디오 샘플은 처리하지 않으며 마이크 선택을 숨긴다.
- 프레임은 최대 초당 한 개만 처리한다. 처리 중에는 새 프레임을 버려 대기열을 만들지 않는다. OCR 이미지는 긴 변 960픽셀 이하로 축소하고 1.5초가 넘는 OCR 결과는 버린다.
- ReplayKit이 알려 준 앱이 포켓몬고가 아니면 OCR을 건너뛴다. 앱 식별자를 얻지 못하는 경우에도 CP, HP 비율, 공격·방어·평가 라벨이 모두 있는 화면만 후보로 인정한다. 이 규칙은 정확한 게임 화면 인증을 대신하지 않는다.
- 공유 경계에는 CP·HP 숫자와 허용된 라벨만 남긴다. 자유로운 OCR 본문이나 알림 문구를 전달하지 않는다. IV 바 수치를 추정하거나 개체를 자동 확정하지 않는다.
- 연속해서 같은 화면이 들어오는 경우만 세션별 메모리 지문으로 억제한다. CP·HP 문자열이 같아도 IV 바의 화면 픽셀이 다르면 별도 후보로 남긴다. 지문과 축소 이미지도 저장하지 않으며, 픽셀까지 같은 서로 다른 개체의 구분은 사용자 확인이 필요하다.
- App Group의 `CaptureIPC-v1` 디렉터리는 백업에서 제외하고 완전 파일 보호를 사용한다. JSON 한 파일은 48KB 이하, 후보는 최대 12개, 후보 텍스트는 500자 이하이다.
- 10분이 지난 후보는 읽기에서 제외한다. 인식 결과 초기화는 후보 JSON을 비우고 삭제 시각을 기록하므로 이전 작업의 늦은 결과도 다시 노출하지 않는다.
- 네이티브 타이머가 중지 요청과 세션 만료를 확인한다. 세션은 실제 실행 시간 10분 이내로 제한하고, 앱에서 중지하거나 iOS 시스템 화면 기록 표시로 종료할 수 있다.
- ReplayKit 일시 정지·재개와 ScreenCaptureKit 공유 콘텐츠 활성·비활성 상태를 구분한다. 정지된 화면에서 프레임이 바뀌지 않는 것만으로 일시 정지라고 표시하지 않는다.

## 검증

프로젝트에는 호스트와 내장 방송 확장 타깃, App Group entitlement, extension Info.plist, 개인정보 매니페스트가 포함돼 있다. UIKit·ReplayKit·Vision·ScreenCaptureKit 연결은 실제 SDK 빌드와 기기 검증이 모두 필요하다.

`pod install` 후에는 리소스 번들을 포함한 모든 Pod 타깃의 최소 iOS 버전을 앱 지원 하한인 15.1 이상으로 맞춘다. 이미 더 높은 버전을 요구하는 의존성의 설정은 유지한다. Xcode 27 시뮬레이터가 지원하지 않는 낮은 리소스 타깃을 그대로 남기지 않으며, 배포 버전 경고를 숨기지 않는다.

```sh
swiftc CaptureShared/PokemonFrameText.swift CaptureShared/CaptureFrameFingerprint.swift CaptureShared/CaptureDedupPolicy.swift CaptureSharedTests/main.swift -o /tmp/pogo-frame-text-check
/tmp/pogo-frame-text-check
```

기기에서는 시스템 선택 취소, 게임과 다른 앱 전환, 잠금, 공유 대상 변경, 중지 직후 재시작, 앱으로 돌아와 결과 검토, 인식 결과 초기화를 확인한다. 시스템 화면 기록 표시가 종료되는지, 오인식 후보를 확정하지 않는지, 장시간 사용 시 메모리와 발열이 허용 범위인지도 확인한다.

## 공식 API 근거

- [ScreenCaptureKit의 iOS 27 샘플](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-on-ios)
- [ReplayKit 방송 샘플 처리기](https://developer.apple.com/documentation/replaykit/rpbroadcastsamplehandler)
- [ReplayKit 시스템 방송 선택기](https://developer.apple.com/documentation/replaykit/rpsystembroadcastpickerview)
- [Vision 텍스트 인식 요청](https://developer.apple.com/documentation/vision/vnrecognizetextrequest)
- [App Group 구성](https://developer.apple.com/documentation/xcode/configuring-app-groups)

ReplayKit 경로는 iOS 27에서 폐기 예정으로 표시되며 최신 시스템에서는 ScreenCaptureKit을 사용한다.
