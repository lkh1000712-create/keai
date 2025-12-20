# Claude Code 설정 최적화 PRD

**문서 버전**: 1.0.0
**작성일**: 2025-12-18
**목적**: Claude Code 설정 사용성 평가 및 정리 계획

---

## 1. 현황 분석 (As-Is)

### 1.1 전체 현황 요약

| 항목 | 현재 상태 | 문제점 |
|------|----------|--------|
| TODO 파일 | **1,915개** (4.3MB) | 오래된 에이전트 세션 잔여물, 컨텍스트 오염 |
| Skills | **90개+** (15MB) | 중복, 미사용, BAS 작업 무관 다수 |
| Hooks | **8개 활성** (21개 파일) | 일부 중복 기능, 과도한 체크 |
| Plugins | **10개 활성** | BAS 홈페이지 작업에 불필요한 DB/CI-CD 플러그인 |
| MCP 서버 | **2개** (puppeteer, playwright) | 기능 중복 |
| CLAUDE.md | **1,025줄** (전역 711 + 프로젝트 314) | 일부 중복 규칙 |

### 1.2 세부 분석

#### A. TODO 파일 (Critical)
```
위치: C:/Users/flame/.claude/todos/
파일 수: 1,915개
용량: 4.3MB
```

**문제점**:
- 이전 에이전트 세션에서 생성된 잔여 파일
- 세션 간 컨텍스트 오염 가능성
- 불필요한 디스크 사용

**영향도**: 🔴 높음 - 컨텍스트 로딩 시 불필요한 처리 발생 가능

#### B. Skills (High)
```
위치: C:/Users/flame/.claude/skills/
파일 수: 90개+
용량: 15MB
```

**카테고리별 분류**:

| 카테고리 | 개수 | BAS 관련성 | 권장 조치 |
|----------|------|------------|-----------|
| .점 스킬 (공식) | 15개 | 중간 | 유지 |
| superpowers | 30개+ | 낮음 | 검토 후 정리 |
| development | 15개+ | 낮음 | 선택적 유지 |
| automation | 5개 | 낮음 | 검토 |
| bas-* | 3개 | 높음 | 유지 |
| 기타 | 20개+ | 낮음 | 정리 대상 |

**BAS 작업 필수 스킬**:
- `.frontend-design` - UI 작업
- `.verification-before-completion` - 완료 검증
- `bas-homepage` (프로젝트별)

#### C. Hooks (Medium)

**현재 활성화된 Hooks**:

| Hook | 트리거 | 기능 | BAS 필요성 |
|------|--------|------|------------|
| opus-optimizer.js | UserPromptSubmit | 작업 유형 감지 | ⭐ 유용 |
| smart-meta-agent.js | UserPromptSubmit | 분석 권장 | ⚠️ 중복 가능 |
| git-precommit-guard.js | PreToolUse(Bash) | git 안전 검사 | ⭐ 필수 |
| pre-commit-security.js | PreToolUse(Bash) | 보안 검사 | ⚠️ 중복 |
| security-scanner.js | PreToolUse(Write/Edit) | 보안 스캔 | ⭐ 유용 |
| build-checker.js | PostToolUse(Bash) | 빌드 체크 | ❌ BAS 불필요 |
| prettier-format.js | PostToolUse(Edit/Write) | 포맷팅 | ⭐ 유용 |
| error-reminder.js | PostToolUse(Edit/Write) | 에러 알림 | ⭐ 유용 |
| session-summarizer.js | SessionEnd | 세션 요약 | ⭐ 유용 |

**중복 기능 분석**:
- `opus-optimizer` + `smart-meta-agent`: 둘 다 작업 유형 감지 → 하나로 통합 가능
- `git-precommit-guard` + `pre-commit-security`: git 관련 검사 중복

#### D. Plugins (Medium)

**현재 활성화**:
```json
{
  "frontend-design": true,           // ⭐ BAS 필요
  "rest-api-generator": true,        // ❌ 불필요
  "api-documentation-generator": true, // ❌ 불필요
  "api-authentication-builder": true,  // ❌ 불필요
  "database-schema-designer": true,    // ❌ 불필요
  "database-migration-manager": true,  // ❌ 불필요
  "orm-code-generator": true,          // ❌ 불필요
  "docker-compose-generator": true,    // ❌ 불필요
  "ci-cd-pipeline-builder": true,      // ❌ 불필요
  "deployment-pipeline-orchestrator": true // ❌ 불필요
}
```

**분석**: 10개 중 **1개만 BAS 작업에 필요**

#### E. MCP 서버 (Low)

| 서버 | 기능 | 상태 | 권장 |
|------|------|------|------|
| puppeteer | 브라우저 자동화 | 연결됨 | ❌ 제거 (중복) |
| playwright | 브라우저 자동화 | 연결됨 | ⭐ 유지 |

**분석**: 동일 기능 중복, playwright가 더 현대적

#### F. CLAUDE.md (Low)

| 파일 | 줄 수 | 내용 |
|------|-------|------|
| 전역 (~/.claude/) | 711줄 | 디자인 시스템, RWT 규칙, Opus 최적화 |
| 프로젝트 (bas_homepage/) | 314줄 | BAS 규칙, 정책자금 정보 |

**중복 확인 필요**:
- 파일 인코딩 규칙 (두 곳에 존재)
- Windows 경로 규칙 (두 곳에 존재)

---

## 2. 정리 계획 (To-Be)

### 2.1 우선순위별 정리 계획

#### Phase 1: 즉시 정리 (Critical)

**1. TODO 파일 전체 삭제**
```bash
rm -rf ~/.claude/todos/*
```
- 예상 효과: 4.3MB 확보, 컨텍스트 정리
- 위험도: 없음 (이전 세션 데이터)

**2. 중복 MCP 제거**
```bash
claude mcp remove puppeteer
```
- 예상 효과: 중복 제거, 리소스 절약
- 위험도: 없음 (playwright 유지)

#### Phase 2: 플러그인 정리 (High)

**비활성화 대상** (9개):
- rest-api-generator
- api-documentation-generator
- api-authentication-builder
- database-schema-designer
- database-migration-manager
- orm-code-generator
- docker-compose-generator
- ci-cd-pipeline-builder
- deployment-pipeline-orchestrator

**유지** (1개):
- frontend-design

#### Phase 3: Hooks 최적화 (Medium)

**통합/제거 대상**:
1. `smart-meta-agent.js` → `opus-optimizer.js`에 통합 또는 제거
2. `pre-commit-security.js` → `git-precommit-guard.js`에 통합

**BAS 작업 불필요 (조건부 비활성화)**:
- `build-checker.js` (Next.js/빌드 프로젝트용)

#### Phase 4: Skills 정리 (Low Priority)

**유지 대상**:
```
.brainstorming/
.defense-in-depth/
.frontend-design/
.systematic-debugging/
.verification-before-completion/
bas-homepage/ (프로젝트별)
```

**정리 대상** (superpowers 폴더 등):
- 중복 스킬 파일들
- 테스트용 파일들 (test-*.md)

---

## 3. 실행 계획

### 3.1 단계별 실행

| 단계 | 작업 | 예상 시간 | 롤백 가능 |
|------|------|----------|----------|
| 1 | TODO 파일 삭제 | 1분 | ❌ (불필요) |
| 2 | puppeteer MCP 제거 | 1분 | ✅ |
| 3 | 플러그인 비활성화 | 2분 | ✅ |
| 4 | Hooks 통합 | 10분 | ✅ |
| 5 | Skills 정리 | 15분 | ✅ |

### 3.2 예상 효과

| 항목 | Before | After | 개선율 |
|------|--------|-------|--------|
| TODO 파일 | 1,915개 | 0개 | 100% |
| 디스크 사용 | ~20MB | ~10MB | 50% |
| 활성 플러그인 | 10개 | 1개 | 90% |
| MCP 서버 | 2개 | 1개 | 50% |
| 컨텍스트 로딩 | 과다 | 최적화 | - |

---

## 4. 승인 요청

다음 작업을 진행하시겠습니까?

### 즉시 실행 (Phase 1)
- [ ] TODO 파일 1,915개 삭제
- [ ] puppeteer MCP 제거

### 선택적 실행 (Phase 2-4)
- [ ] 불필요 플러그인 9개 비활성화
- [ ] Hooks 통합/최적화
- [ ] Skills 정리

---

## 5. 참고: 설정 파일 백업 명령어

실행 전 백업 권장:
```bash
# 설정 파일 백업
cp ~/.claude/settings.json ~/.claude/settings.json.backup

# hooks 백업
cp -r ~/.claude/hooks ~/.claude/hooks.backup
```

---

**문서 끝**
