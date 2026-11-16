# GateReady (Codegeist 2026 출품작)

이 파일은 Claude Code가 이 저장소에서 작업할 때 따르는 프로젝트 지침이다.

## 1. 한 줄 요약

GateReady는 Jira와 Confluence에 흩어진 증빙을 읽어, 제품 개발 단계 게이트(phase gate)를 통과해도 되는지 판정하고 빠진 항목을 담당자에게 배정하는 Forge 앱이다. Rovo 에이전트가 핵심 인터페이스다.

- 대회: Atlassian Codegeist 2026 (Devpost), 주제 "Build with context. Ship with confidence."
- 카테고리: Apps for Specialized Industries (제조)
- 대상 사용자: 자동차 부품 공급사의 품질 엔지니어와 프로젝트 매니저
- 해결하는 문제: 게이트 심사 전에 FMEA, 관리계획서, 측정시스템 분석 같은 증빙이 실제로 존재하고 승인됐는지 사람이 일일이 확인한다. 누락은 심사 당일이나 고객 감사에서 드러난다.
- 개발 인원: 1명. 범위를 넓히지 말고 아래 MVP를 끝까지 동작하게 만드는 것이 우선이다.
- 제출 마감: (Devpost에서 확인 후 여기에 기입)

## 2. 심사 기준과 그에 따른 개발 원칙

다섯 항목이 각 20%다. 모든 구현 결정은 이 기준에 비추어 판단한다.

| 심사 항목 | 이 프로젝트에서의 의미 |
|---|---|
| Technological Implementation | 하드코딩된 데모 경로 금지. 게이트 템플릿과 증빙 규칙은 사용자가 설정하고, 서로 다른 프로젝트에서 다른 결과가 나와야 한다 |
| Design | 설치, 초기 설정, 일상 사용, 결과 확인까지 끊기지 않는 흐름. 빈 상태, 로딩, 오류 화면 포함 |
| Potential Impact | 대상을 품질 담당자로 좁게 유지. 범용 체크리스트 앱처럼 보이면 실패 |
| Innovation | 문서 존재 여부만 보지 않고 승인 상태, 최신성, 필수 섹션까지 판정 |
| Presentation | 5분 미만 영상에서 처음부터 끝까지 시연 가능해야 하므로, 시드 데이터와 데모 시나리오를 코드로 관리 |

## 3. 절대 규칙

1. 실제 회사의 데이터, 시스템명, 문서 양식, 코드를 쓰지 않는다. 데모 데이터는 전부 가상이며, 공개 표준(APQP, PPAP) 수준의 일반 용어만 사용한다.
2. 앱의 모든 UI 문구, 에이전트 프롬프트, README, 주석은 영어로 쓴다. 심사위원이 영어권이다.
3. 외부로 데이터를 내보내지 않는다(egress 없음). 저장은 Forge 호스팅 스토리지만 사용해 Runs on Atlassian 요건을 유지한다.
4. API 토큰이나 자격 증명을 파일에 쓰거나 로그에 남기지 않는다. `forge login`은 사용자가 직접 터미널에서 실행한다.
5. Forge의 모듈 이름, 매니페스트 구조, 스코프는 기억에 의존하지 말고 공식 문서로 확인한 뒤 작성한다. Rovo 관련 모듈은 최근에 바뀐 것이 많다.
6. 확인이 안 되는 기능은 추측으로 구현하지 말고, 무엇이 불확실한지 사용자에게 알린다.

## 4. 문서 확인 방법

작업 전에 Forge MCP 서버를 Claude Code에 연결해 매니페스트와 모듈 정보를 조회한다. 연결 방법은 아래 페이지에 있다.

- Forge MCP 서버: https://developer.atlassian.com/platform/forge/forge-mcp/
- Forge 시작하기: https://developer.atlassian.com/platform/forge/getting-started/
- rovo:agent: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-agent/
- action: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-action/
- rovo:mcp: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/
- rovo:skill: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-skill/
- Teamwork Graph 연동 방식: https://developer.atlassian.com/platform/teamwork-graph/ways-to-integrate/

착수 시 반드시 확인할 것:

- 하나의 Forge 앱이 Jira와 Confluence 데이터를 함께 읽는 현재 권장 방식 (앱 호환성 설정, 필요한 스코프)
- Confluence 페이지의 본문, 라벨, 콘텐츠 상태(승인 여부)를 읽는 REST API 버전과 스코프
- Forge 스토리지의 현재 권장 API (KVS, Custom Entities)
- Forge CLI가 요구하는 Node.js LTS 버전

## 5. 핵심 개념

- **Gate template**: 게이트 목록과 게이트별 증빙 요구사항의 묶음. 프로젝트마다 하나를 적용한다. 기본 제공 템플릿은 APQP 5단계지만 사용자가 수정하거나 새로 만들 수 있다.
- **Evidence requirement**: 게이트 하나가 요구하는 증빙 한 건. 아래 규칙 유형 중 하나로 정의한다.
- **Readiness result**: 요구사항별 판정(충족, 미충족, 확인 필요)과 근거 링크, 판정 시각.
- **Gap**: 미충족 항목. Jira 이슈로 생성해 담당자에게 배정한다.

### 증빙 규칙 유형 (MVP)

| 유형 | 판정 방식 |
|---|---|
| `confluence_page_exists` | 지정 스페이스에 지정 라벨 또는 제목 패턴의 페이지가 있는가 |
| `confluence_page_approved` | 해당 페이지의 콘텐츠 상태가 승인 상태인가 |
| `confluence_page_fresh` | 마지막 수정일이 기준일(예: 직전 게이트 통과일) 이후인가 |
| `confluence_page_sections` | 본문에 필수 섹션 제목이 모두 있는가 |
| `jira_query_all_done` | 지정 JQL 결과가 모두 완료 상태인가 |
| `jira_query_none_open` | 지정 JQL(예: 미해결 고위험 항목)의 결과가 0건인가 |

판정은 가능한 한 결정적 코드로 한다. 에이전트는 판정 결과를 설명하고, 본문 내용의 충분성처럼 규칙으로 못 잡는 부분만 "확인 필요"로 의견을 낸다. 에이전트의 의견이 결정적 판정을 덮어쓰지 않는다.

## 6. 기능 범위

### MVP (반드시 완성)

1. **프로젝트 페이지 대시보드** (Jira project page): 게이트별 준비도 막대, 요구사항별 판정과 근거 링크, "Run check" 버튼, 마지막 점검 시각.
2. **템플릿 설정 화면** (Jira project settings 또는 admin page): 게이트와 증빙 요구사항을 추가, 수정, 삭제. 기본 APQP 템플릿 불러오기.
3. **점검 엔진**: 5절의 규칙 유형을 평가해 Readiness result를 저장.
4. **갭 이슈 생성**: 미충족 항목을 Jira 이슈로 만들고 요구사항에 지정된 담당자에게 배정. 중복 생성 방지.
5. **Rovo 에이전트 "Gate Review Agent"** (`rovo:agent`): 아래 액션을 사용해 대화로 점검, 설명, 갭 배정, 심사 요약 작성.
6. **시드 스크립트**: 가상 프로젝트 2개와 Confluence 문서를 만들어 데모 환경을 재현. 프로젝트 A는 거의 준비 완료, 프로젝트 B는 누락과 미승인 문서가 섞여 있어 결과가 달라야 한다.

### 에이전트 액션 (`action` 모듈)

| 키 | 역할 |
|---|---|
| `get-gate-status` | 프로젝트의 게이트별 준비도 요약 반환 |
| `run-gate-check` | 특정 게이트의 점검을 실행하고 결과 반환 |
| `list-gaps` | 미충족 항목과 근거 반환 |
| `create-gap-issues` | 미충족 항목을 Jira 이슈로 생성 (사용자 확인 후 실행) |
| `get-evidence-content` | 판정 근거가 된 Confluence 페이지 본문 발췌 반환 |
| `draft-gate-review-summary` | 심사 회의용 요약을 Confluence 페이지 초안으로 생성 |

액션의 이름과 설명은 에이전트가 언제 호출할지 판단하는 근거이므로 구체적으로 쓴다. 쓰기 동작(`create-gap-issues`, `draft-gate-review-summary`)은 실행 전에 사용자에게 대상 목록을 보여주고 확인받도록 프롬프트에 명시한다.

### 보너스 상 대응 (MVP 완료 후)

1. **MCP**: `rovo:mcp` 모듈에 위 액션들을 도구로 등록한다. 외부 MCP 클라이언트 연결까지 시연할 수 있으면 영상에 넣는다.
2. **재사용 스킬**: `rovo:skill`로 "게이트 심사 준비" 절차를 SKILL.md로 패키징해 다른 에이전트가 쓸 수 있게 한다. 모듈 제공 상태를 먼저 확인한다.
3. **Teamwork Graph**: API와 커넥터 모두 얼리 액세스 프로그램이다. 사용자가 승인을 받은 경우에만 구현한다. 승인 시에는 이슈, 문서, 사람 사이의 관계 조회를 근거 탐색에 사용한다. 앱의 핵심 기능이 이 API에 의존하면 안 된다.
4. **Marketplace**: 제출 직전에 등록 신청하고 리뷰 티켓 링크를 확보한다.

### 범위 밖

- 외부 시스템(ERP, MES, PLM) 연동
- 통계적 공정 관리, 측정 데이터 분석
- 전자 서명, 문서 승인 워크플로 자체 구현
- 다국어 지원

## 7. 권장 구조

```
manifest.yml
src/
  index.js            # 리졸버와 액션 핸들러 진입점
  engine/
    evaluate.js       # 규칙 유형별 평가기
    rules/            # 규칙 유형 하나당 파일 하나
  data/
    templates.js      # 템플릿 CRUD
    results.js        # 판정 결과 저장과 조회
  actions/            # 에이전트 액션 하나당 파일 하나
  clients/
    jira.js           # Jira REST 호출 래퍼
    confluence.js     # Confluence REST 호출 래퍼
  seed/               # 데모 데이터 생성
static/ 또는 src/frontend/   # UI Kit 화면
docs/
  demo-script.md      # 5분 영상 시나리오
  judging-notes.md    # 심사 항목별 대응 근거
README.md             # 설치 방법, 심사위원용 테스트 안내
```

UI는 UI Kit을 기본으로 한다. Custom UI는 UI Kit으로 구현이 불가능한 화면이 있을 때만 쓴다.

## 8. 작업 순서

각 단계가 끝나면 `forge lint`, `forge deploy`, 개발 사이트에서 직접 확인까지 마친 뒤 다음으로 넘어간다.

1. 환경 확인: `node -v`, `forge --version`, `forge whoami`. 안 되어 있으면 사용자에게 필요한 조치를 안내하고 멈춘다.
2. 앱 생성과 hello world 수준의 project page 배포, 설치.
3. 클라이언트 래퍼와 스코프 확정: Jira 검색, Confluence 페이지 조회가 실제로 되는지 확인.
4. 템플릿 데이터 모델과 설정 화면.
5. 점검 엔진과 규칙 유형 6개. 규칙마다 단위 테스트.
6. 대시보드.
7. 갭 이슈 생성.
8. 시드 스크립트로 프로젝트 2개 구성 후 전체 흐름 점검.
9. Rovo 에이전트와 액션.
10. `rovo:mcp` 등록.
11. 빈 상태, 오류, 권한 부족 화면 정리.
12. README, 설치 링크 공유 설정, 데모 시나리오 문서.

## 9. 데모 데이터 (가상)

- 프로젝트 A: "Brake Sensor Housing" - 게이트 3 심사 직전, 증빙 대부분 충족
- 프로젝트 B: "EV Battery Bracket" - 같은 게이트, PFMEA 미승인, 관리계획서가 설계 변경 이전 버전, 미해결 고위험 이슈 2건
- 기본 템플릿 게이트: Plan and Define, Product Design, Process Design, Validation, Launch
- 증빙 문서 예: DFMEA, PFMEA, Control Plan, MSA Report, Process Flow Diagram, Part Submission Warrant

회사명, 고객사명, 인명은 모두 지어낸 것을 쓴다.

## 10. 제출물 점검표

- [ ] 심사위원용 설치 링크와 테스트 안내 (README)
- [ ] 5분 미만 데모 영상, YouTube 공개
- [ ] 카테고리와 지원하는 보너스 상 명시, 보너스 상별 증빙
- [ ] 기술 요건 충족 설명 (Forge 사용, 연동한 Atlassian 제품)
- [ ] Devpost 제출 양식 전체 작성
