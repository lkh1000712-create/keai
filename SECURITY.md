# KEAI 프로젝트 보안 가이드

## Next.js / React 보안 취약점 (2025년 12월 기준)

### 심각한 취약점 정보

2025년 12월 3일, React Server Components (RSC)의 Flight 프로토콜에서 치명적인 원격 코드 실행(RCE) 취약점이 공개되었습니다.

| CVE | CVSS 점수 | 영향 범위 |
|-----|-----------|----------|
| CVE-2025-55182 (React) | 10.0 (Critical) | React 19.x |
| CVE-2025-66478 (Next.js) | 10.0 (Critical) | Next.js 15.x, 16.x |

### 영향받는 버전

- **영향받음**: React 19.x, Next.js 15.x, 16.x (App Router 사용 시)
- **영향없음**: Next.js 13.x, 14.x stable, Pages Router, Edge Runtime

### 권장 패치 버전 (2025년 12월 11일 기준)

```bash
# Next.js 14.x 사용 시 (권장 - 안정적)
npm install next@14.2.34

# Next.js 15.x 사용 시
npm install next@15.0.6    # 15.0.x
npm install next@15.1.10   # 15.1.x
npm install next@15.2.7    # 15.2.x
npm install next@15.3.7    # 15.3.x
npm install next@15.4.9    # 15.4.x
npm install next@15.5.8    # 15.5.x

# Next.js 16.x 사용 시
npm install next@16.0.9
```

### 이 프로젝트에서 사용 중인 버전

```json
{
  "next": "14.2.35",
  "react": "18.3.1",
  "react-dom": "18.3.1"
}
```

**선택 이유**:
- Next.js 14.2.35: 2025-12-11 보안 패치 적용 (CVE-2025-55182 대응)
- React 18.x는 RSC Flight 프로토콜 취약점 영향 없음
- `npm audit`: 취약점 0개 확인됨

### 조치 사항

1. **우회책 없음** - 패치 버전으로 업그레이드 필수
2. **비밀키 교체** - 패치 후 모든 애플리케이션 시크릿 교체 권장
3. **공개 익스플로잇 존재** - 실제 공격이 관측됨

### 참고 자료

- [Next.js Security Update (2025-12-11)](https://nextjs.org/blog/security-update-2025-12-11)
- [CVE-2025-66478 Advisory](https://nextjs.org/blog/CVE-2025-66478)
- [Vercel CVE-2025-55182 Summary](https://vercel.com/changelog/cve-2025-55182)
- [GitHub Security Advisory](https://github.com/vercel/next.js/security/advisories/GHSA-9qr9-h5gf-34mp)

---

## 프로젝트 초기화 명령어

```bash
# 안전한 버전으로 Next.js 프로젝트 생성
npx create-next-app@14.2.34 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# 또는 수동 설치
npm install next@14.2.34 react@18.3.1 react-dom@18.3.1
```

---

**최종 업데이트**: 2025-12-12
