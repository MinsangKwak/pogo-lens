# pogo-lens

포켓몬 GO 화면 위에 떠서 개체값을 읽고, 내 포켓몬끼리 순위를 매겨 이름을 지어주는 Android 오버레이 앱.
Kotlin 셸 + TypeScript 코어.

## 구조

```
core/      순수 TypeScript. CP/IV 계산, 보유 순위, PvP 순위, 닉네임 템플릿. 플랫폼 의존 없음
android/   Kotlin 셸. 오버레이 버튼, MediaProjection 캡처, (예정) OCR, (예정) 커스텀 키보드
docs/      설계와 로드맵
```

코어는 화면을 모릅니다. 셸이 화면에서 숫자를 읽어 코어에 넘기고, 코어가 돌려준 결과를 셸이 화면 위에 그립니다.

## 개발

```bash
npm install
npm run check        # lint + typecheck + test + build (core)
npm run test -w core
```

Android는 Android Studio에서 `android/` 폴더를 열거나 아래로 빌드합니다.

```bash
cd android && ./gradlew assembleDebug
```

## 로드맵

1. ✅ 코어: CPM 표, CP/HP 계산, IV 역산, 보유 순위, PvP 순위, 12자 닉네임 템플릿
2. ✅ 셸: 오버레이 권한, 플로팅 버튼, 화면 캡처 1프레임 (OCR 자리만 잡음)
3. 셸: ML Kit 온디바이스 OCR로 이름/CP/HP/모래 읽기, 평가 화면 IV 바 픽셀 읽기
4. 셸: 스캔 결과 로컬 저장, 같은 종 내 순위를 결과 카드에 표시
5. 셸: 커스텀 키보드(IME)로 닉네임 한 번에 입력
6. 교환 어시스트: 상자 화면에서 교환 후보를 하이라이트 (입력 자동화는 하지 않음)

자세한 결정 사항은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)에 있습니다.

## 면책

팬 메이드 도구이며 Pokémon, Niantic, Nintendo와 관계가 없습니다. 게임 화면을 읽기만 하고 게임에 입력을 주입하지 않습니다.
