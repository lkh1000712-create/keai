# KEAI 프로젝트 규칙

## 배포 구조 (중요!)

이 프로젝트는 `vercel.json`에서 `outputDirectory: "public"`으로 설정되어 있어 **public 폴더만 배포**됩니다.

### 파일 동기화 필수 체크리스트

다음 폴더의 파일을 수정할 때 **반드시 public 폴더에도 복사**해야 합니다:

| 소스 폴더 | 대상 폴더 | 설명 |
|-----------|-----------|------|
| `js/` | `public/js/` | JavaScript 파일 |
| `css/` | `public/css/` | CSS 파일 |
| `dashboard/` | `public/dashboard/` | 대시보드 HTML |
| 루트 HTML | `public/` | index.html 등 |

### 수정 시 자동 복사 명령어

```bash
# components.js 수정 후
cp js/components.js public/js/components.js

# dashboard 파일 수정 후
cp dashboard/[파일명].html public/dashboard/[파일명].html

# 전체 동기화 (필요시)
cp js/*.js public/js/
cp css/*.css public/css/
cp dashboard/*.html public/dashboard/
```

### 신규 파일 추가 시

1. 루트 폴더에 파일 생성
2. **public 폴더에도 복사**
3. `vercel.json`의 rewrites에 라우팅 추가 (필요시)

---

## API 폴더

`api/` 폴더는 Vercel Serverless Functions이므로 **public에 복사하지 않음** (루트에 유지)

---

## 배포 명령어

```bash
# 푸시
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_lkh" git push origin master

# Vercel 배포
vercel --yes --token 1xZoE0DnlfFN9CbtfEs4v2N7 --prod
```
