---
version: alpha
name: PoGo Lens
description: Frosted field instrument for comparing a personal Pokémon collection.
colors:
  primary: "#A0E4EF"
  background: "#091923"
  depth: "#163C4C"
  text: "#F4FAFC"
  muted: "#BBD0D8"
  ink: "#102839"
typography:
  body:
    fontFamily: "sans-serif"
    fontSize: "14px"
  title:
    fontFamily: "sans-serif-medium"
    fontSize: "30px"
rounded:
  panel: "24px"
  control: "18px"
spacing:
  page: "24px"
  panel: "22px"
  gap: "16px"
components:
  permission-panel: {}
  capture-button: {}
  floating-bubble: {}
---

# PoGo Lens design system

## Overview

Android 게임 화면을 확인하기 위한 작은 관측 렌즈. 한국어 사용자 대상의 개인 개발 도구다. 설정 화면에서 권한과 현재 상태를 이해한 뒤 게임으로 돌아가는 것이 화면의 역할이다.

사용자가 요청한 glassmorphism을 짙은 청록 배경, 반투명 패널, 얇은 밝은 테두리로 구현한다. 실제 배경 블러나 게임 화면 전체 블러는 사용하지 않는다. 게임 위에는 56dp 원형 버튼만 표시한다. 미구현 순위·스캔 결과를 실제 데이터처럼 그리지 않는다.

토큰 소유권은 Model B다. `apps/android/app/src/main/res/values/colors.xml`과 `themes.xml`이 런타임 소스이고 이 문서는 의도를 설명한다. 색 → drawable/theme → layout 순서로 참조한다. 웹 CSS나 별도 프레임워크는 추가하지 않는다.

## Colors

`lens_background`는 기본 배경, `lens_depth`는 배경 그라데이션, `lens_glass`는 ARGB #B8203948, `lens_stroke`는 ARGB #668CB4C4다. 본문은 `lens_text`, 보조 문장은 `lens_muted`, 주요 버튼은 `lens_accent` 바탕에 `lens_ink` 글자를 사용한다. 장식용 투명도를 본문 텍스트에 적용하지 않는다.

## Typography

Android 시스템 sans를 사용해 한국어 글리프와 사용자의 글자 크기 설정을 따른다. 헤드라인 30sp, 패널 제목 20sp, 본문 14sp, 버튼 15sp다. 외부 폰트 다운로드는 없다. 숫자 중심 결과 화면의 글꼴은 해당 기능 구현 때 검증한다.

## Layout

단일 ScrollView가 스크롤을 소유한다. 페이지 24dp, 패널 내부 22dp, 패널 간 16dp다. 시스템 바 inset을 반영하고 고정 높이 텍스트 영역을 두지 않는다. 작은 화면과 큰 글자에서도 버튼에 도달할 수 있어야 한다.

## Elevation & Depth

위계는 테두리와 명도로 만든다. 패널 24dp 모서리와 반투명 채움으로 유리 느낌을 내며, 무거운 블러·그림자·상시 애니메이션은 피한다. 이 방식은 게임 실행 중 불필요한 렌더링 비용을 줄인다.

## Shapes

패널 24dp, 버튼 18dp, 플로팅 버튼 56dp 원형이다. 터치 영역은 최소 48dp를 유지한다.

## Components

권한 설정과 캡처 제어는 기존 MainActivity, 상태는 OverlayService의 StateFlow가 소유한다. Android 기본 ScrollView, MaterialButton과 시스템 권한 대화상자를 재사용한다. 한국어 문구는 strings.xml이 소유한다.

주요 버튼은 시작·중지 행동을 표시한다. 준비 중에는 비활성화하고 상태 문구를 읽어 준다. 보조 버튼은 권한 설정을 연다. MaterialButton의 pressed/focus/disabled 상태를 유지한다. 플로팅 버튼은 pressed/focus 테두리 상태와 접근성 설명을 갖는다. 성공·실패 피드백은 현재 Toast를 쓰되 중요한 실행 상태는 화면에도 표시한다.

## Do's and Don'ts

- 권한의 목적과 현재 구현 범위를 먼저 설명한다.
- 실제 캡처 이미지를 설정 배경이나 로그에 쓰지 않는다.
- 미구현 기능, 가상 순위, 테스트 수치를 제품 화면에 표시하지 않는다.
- 작은 화면·200% 글자 크기·TalkBack은 실제 기기에서 별도 검증한다.
