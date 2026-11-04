# Shared workflow

React Native와 웹이 함께 사용할 수 있는 순수 TypeScript 작업 흐름이다. 화면 캡처, OCR 실행, 클립보드, 파일 및 저장 장치는 이 패키지 밖에서 다룬다. 계산은 `@pogo-lens/core`를 호출하며 별도의 계산식을 만들지 않는다.

`createWorkflowState()`는 보유 개체가 없는 상태로 시작한다. 샘플은 사용자가 선택한 경우에만 `source: 'sample'` 후보로 넣는다.

## 확인과 적용 경계

1. `acceptScanCandidate`는 미확인 후보를 받는다. 숫자 일부가 없거나 잘못 읽힌 후보도 검토할 수 있지만 보유 목록에 들어가지 않는다.
2. `confirmScanCandidate`는 사용자가 확인한 완전한 IV와 종, 명시적인 새 개체 또는 기존 개체 선택을 받는다. 이 시점에만 개체와 연결된 관측 기록을 함께 바꾼다. 확인하지 않은 CP·HP·레벨은 넣지 않으며 기존 값은 보존한다.
3. `getRenamePlan`은 확정된 목록에서 변경할 이름을 계산한다. 직접 지은 이름의 보호 상태와 다른 개체의 순위 변화도 포함한다.
4. `prepareNickname`은 현재 목록과 계산 조건에 연결된 제안을 만든다. 클립보드 복사는 이 제안을 적용하지 않는다.
5. 실제 게임에서 이름이 바뀐 것을 사용자가 확인했을 때만 `confirmNicknameApplied`에 `evidence: 'user-confirmed-in-game'`을 전달한다. 웹 연습은 `simulateNicknameApplication`을 사용하며 이력 출처가 `web-simulation`으로 남는다.

제안 후 목록, 데이터 버전, 템플릿 또는 보호 상태가 달라지면 공통 코어가 적용을 거절한다. 제안과 미확인 캡처 원문은 재시작 후 복원하지 않는다.

## 저장 형식

`CollectionState`는 `schemaVersion`, `revision`, `records`, `observations`, `nicknameApplications`만 가진다. `serializeCollection`은 이 필드와 각 기록의 허용된 필드만 직렬화한다. 이미지 경로, 이미지 원본, OCR 원문, 화면 권한 토큰, 미확인 후보와 적용 전 제안은 영구 데이터에 포함하지 않는다.

`deserializeCollection`은 JSON 문자열과 파싱된 객체를 받는다. 지원하지 않는 버전, 잘못된 값, 중복 ID, 끊어진 기록 연결, 잘못 연결된 종·폼, 이력보다 작은 수정 번호는 오류를 반환한다. 불러오기에 실패했다고 빈 목록을 자동 저장해서는 안 된다. 저장 장치의 읽기가 끝나기 전에도 기본 빈 목록을 저장해서는 안 된다.

제한은 JSON 8,000,000자, 개체 10,000마리, 관측 50,000개, 이름 이력 50,000개다. 휘발성 캡처 원문은 2,000자까지 받는다. 한도 도달 시 기존 데이터를 자동 삭제하거나 잘라내지 않고 오류를 반환한다. 더 큰 데이터와 새 버전은 별도 마이그레이션 정책으로 확장한다.

저장 장치는 쓰기를 순서대로 처리하고 실패를 사용자에게 알려야 한다. 개체 삭제를 추가할 때에는 관련 관측과 이름 이력도 하나의 변경으로 정리해야 한다. 이 패키지는 앱 내부 ID를 게임에서 제공한 고유 ID로 해석하지 않는다.

## 검증

루트에서 의존성을 설치한 뒤 `npm run test -w @pogo-lens/workflow`, `npm run typecheck -w @pogo-lens/workflow`로 검증한다. 배포용 빌드는 공통 코어를 먼저 빌드한 뒤 `npm run build -w @pogo-lens/workflow`를 실행한다.
