# RingDog Android 앱 — 설계 문서

## 목적

RingDog 쇼핑몰의 네이티브 Android 클라이언트를 추가하여, Datadog의
infra/APM/log/RUM 통합 모니터링을 Next.js 웹 프론트엔드뿐 아니라 실제
모바일 클라이언트에서부터 기존 백엔드·인프라까지 엔드투엔드로 시연할
수 있도록 한다.

## 범위 판단: 재사용 vs. 신규 구현

RingDog의 `backend-api`는 이미 프레임워크에 종속되지 않은 순수 REST
API(`auth`/`products`/`cart`/`orders` 라우트, JWT bearer 인증)이며
Next.js 프론트엔드에 대한 의존성이 없다. 이에 따라:

**그대로 재사용:**
- `apps/backend-api` + `packages/db`(Prisma) — 백엔드 변경 불필요
- 모노레포/인프라 구조 — Terraform/EKS/Helm은 계속 백엔드만 서빙하며,
  Android 앱은 이 인프라와 별개로 배포되는 독립적인 빌드 산출물(APK)
- 백엔드에서 확립된 Datadog 계측 *철학*(구조화 로그, trace/span
  상관관계, Agent 기반 라우팅)은 개념적으로 이어받되, 모바일 SDK는
  전송 방식이 다른 별개의 라이브러리다(아래 참고)

**새로 구현:**
- 클라이언트 전체: Kotlin + Jetpack Compose, 단일 모듈
- Datadog 모바일 계측: `dd-sdk-android`(RUM, Trace, Logs) — 웹의
  `@datadog/browser-rum`이나 백엔드의 `dd-trace`와는 다른 SDK이며,
  모바일 특유의 관심사(뷰/세션 라이프사이클, ANR 감지, Agentless
  전송)를 가진다
- 모바일→백엔드 분산 트레이싱 연결 고리(OkHttp 인터셉터 → 백엔드
  dd-trace로 트레이스 이어받기)

## v1 기능 범위

`backend-api`가 이미 제공하는 것과 매칭되는 핵심 쇼핑 플로우만 포함:
- 회원가입 / 로그인(JWT)
- 상품 목록 → 상품 상세
- 장바구니
- 주문 → 주문 내역 / 상세

`chatbot-service`(Bedrock LLM 챗봇)는 v1 범위에서 명시적으로 제외한다.

## 아키텍처

- **위치:** 기존 pnpm-workspace 모노레포 내 `apps/android-app`
  (Gradle은 독립된 별도 빌드 시스템이며 pnpm workspace와의 통합은
  필요 없음)
- **UI:** Jetpack Compose + Navigation Compose
- **패턴:** MVVM, 단일 모듈, 패키지 단위로만 계층 분리 —
  `ui/`(Composable + ViewModel), `data/`(Repository + API 인터페이스),
  `domain/`(모델)
- **네트워킹:** Retrofit + OkHttp로 `backend-api`의 기존 REST
  엔드포인트 호출
- **인증 저장:** JWT를 `EncryptedSharedPreferences`(Android Keystore
  기반)에 저장; OkHttp 인터셉터가 `Authorization: Bearer <token>`
  헤더를 자동으로 첨부

### 환경 전환: local vs. demo

"빌드 시점에 고정" 결정(데모 도중 잘못된 서버에 붙을 위험이 없도록,
앱 내 런타임 설정 화면 대신 선택)에 따라 Gradle product flavor를
`local`/`demo` 2개로 구성한다.

- `local`: `BASE_URL`을 `http://10.0.2.2:<port>`(에뮬레이터에서 호스트
  머신의 localhost를 가리키는 별칭)로 고정
- `demo`: `BASE_URL`을 `build.gradle`에 **하드코딩하면 안 된다.** 이
  저장소는 `terraform apply`를 돌릴 때마다 EKS ALB 호스트명이
  바뀐다(AWS Load Balancer Controller가 매번 새 ALB를 생성하고, 이
  프로젝트는 비용 절감을 위해 세션이 끝날 때마다 인프라를 내리는
  패턴을 반복해왔다 — 프로젝트 메모리 참고). demo URL을 고정해두면
  세션마다 값이 오래돼서 못 쓰게 된다. 대신 웹 프론트엔드용
  `cd.yml`이 이미 ALB 호스트명을 동적으로 조회하는 것과 같은 방식으로,
  빌드 시점에 Gradle property로 주입한다:
  ```
  ./gradlew assembleDemoRelease -PDEMO_BASE_URL=$(kubectl get ingress ringdog -n ringdog -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
  ```
  이는 고객 데모 직전에 수동으로 한 번 실행하는 빌드 단계이며, CI로
  자동화된 흐름이 아니다(이 범위에서는 Android용 CI 파이프라인이
  없고 계획도 없음).

## 컴포넌트

- `RingDogApplication` — `onCreate()`에서 Datadog SDK(RUM + Trace +
  Logs를 한 번에) 초기화
- `NetworkModule` — Retrofit/OkHttp 클라이언트 구성; 인터셉터 체인:
  인증 헤더 → `DatadogInterceptor`(분산 트레이싱 + RUM 리소스 기록)
  → 로깅 인터셉터(디버그 빌드에서만)
- 도메인 영역(Auth, Product, Cart, Order)별로 Repository 1개 +
  ViewModel 1개
- 화면(Compose Navigation): `LoginScreen`, `SignupScreen`,
  `ProductListScreen`, `ProductDetailScreen`, `CartScreen`,
  `OrderHistoryScreen`, `OrderDetailScreen`

### Datadog 자격증명

기존 웹 RUM 애플리케이션과는 별도로, Datadog(RUM → Manage
Applications)에 Android 타입 RUM 애플리케이션을 새로 생성해야 한다.
웹 프론트엔드가 겪었던 빌드타임-베이킹 문제(값이 번들 시점이 아니라
요청 시점에 필요했던 상황)와 달리, 모바일 SDK 값은 빌드 시점에
바이너리에 박히는 것이 정상이며 모바일 환경에서는 표준적인 방식이지
버그가 아니다.

- 로컬 개발: `local.properties`(이미 gitignore되어 있는 Android 표준
  관례)에 값을 저장 → `buildConfigField`로 노출
- 데모 빌드: `DD_RUM_APPLICATION_ID_ANDROID` /
  `DD_RUM_CLIENT_TOKEN_ANDROID`를 GitHub Secrets로 등록하고, 위
  `DEMO_BASE_URL`과 같은 수동 데모 전 빌드 단계에서 `-P` Gradle
  property로 전달한다(이 범위에서는 Android CI 파이프라인이 없고
  계획도 없음); `docs/credentials-setup.md`에 기존 웹 RUM 시크릿과
  나란히 문서화한다

**백엔드와의 핵심 차이점:** 모바일에는 거쳐갈 Datadog Agent가 없다 —
`dd-sdk-android`는 클라이언트 토큰(client token)을 이용해 RUM/Trace/
Logs 데이터를 Datadog 인테이크로 직접 전송한다(Agentless). 이는
백엔드의 Agent 기반 라우팅과 달리 모바일 기기에서 유일하게 가능한
전송 방식이다.

## 데이터 흐름

1. 앱 실행 → Datadog SDK 초기화 → RUM 세션 자동 시작
2. 화면 전환 → `NavigationViewTrackingStrategy`가 RUM View를 자동
   기록(화면별 수동 계측 불필요)
3. 사용자 액션 → RUM이 Compose UI의 탭을 자동 감지; "장바구니 담기",
   "주문하기" 같은 핵심 액션은 신호를 명확히 하기 위해
   `GlobalRumMonitor.get().addAction(...)`으로 추가 태깅
4. 네트워크 호출(Retrofit) → `DatadogInterceptor`가 분산 트레이싱
   헤더를 주입하고 해당 호출을 RUM Resource로 기록 → 대응하는
   backend-api의 dd-trace 스팬이 **같은 트레이스**를 이어받아, 모바일
   액션에서 백엔드 스팬까지 이어지는 엔드투엔드 트레이스를 APM에서
   확인 가능 — 이 앱의 핵심 관측성 목표
5. 로그 → `dd-sdk-android-logs`가 주요 이벤트(로그인 성공/실패, 주문
   실패 등)를 구조화 로그로 전송; RUM 컨텍스트(현재 view, session id)
   가 자동으로 태깅됨

## 에러 처리

- Repository 계층에서 네트워크 응답을 sealed `ApiResult<T>`
  (`Success` / `Error` / `Loading`)로 매핑; ViewModel이 이를 UI
  상태로 노출; 화면에서 재시도 버튼/스낵바 표시
- 401 응답 발생 시 OkHttp `Authenticator`가 감지하여 저장된 토큰을
  삭제하고 로그인 화면으로 이동
- 미처리 예외와 ANR은 `dd-sdk-android`가 RUM 에러/크래시로 자동
  캡처 — 별도 계측 불필요

## 테스트 범위

ViewModel 단위 테스트만 진행(JUnit + MockK + Turbine for Flow),
핵심 로직(로그인 성공/실패, 장바구니 담기, 주문 처리)만 검증.
Compose UI 테스트와 계측 레벨의 RUM 이벤트 검증은 명시적으로
범위 밖 — 데모 앱 규모에 맞춘 실용적이고 과하지 않은 테스트
커버리지라는 이 프로젝트의 전반적인 접근 방식과 일치한다
(`backend-api`의 첫 실제 테스트 스위트도 2026-07-23에 추가되었고
그 자체도 최소한의 범위였음).

## 배포 & 테스트 (Play Store 등록 불필요)

개발이나 고객 데모 단계에서는 Play Store 등록이 필요 없다:
- **Windows 개발 머신:** Android Studio 내장 에뮬레이터(AVD) — IDE에서
  바로 실행하거나 `adb install`로 APK 설치
- **실제 휴대폰:** 개발자 옵션 + USB 디버깅 활성화 후, Android
  Studio에서 USB/Wi-Fi로 실행하거나 `adb install app-demo.apk`로
  APK 직접 사이드로드

Datadog 데이터 수집은 설치 방식과 무관하다 — `dd-sdk-android`는
Google Play 서비스 의존성 없이 표준 HTTP로 Datadog 인테이크에 직접
데이터를 전송하므로, 에뮬레이터든 사이드로드한 실제 기기든 RUM/APM/
Logs가 동일하게 동작한다. Play Store는 일반 사용자 대상 공개 배포
시에만 필요하며 이번 범위 밖이다.
