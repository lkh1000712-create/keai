export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          KEAI
        </h1>
        <p className="text-xl text-gray-600 mb-2">
          한국기업심사원
        </p>
        <p className="text-gray-500">
          개발 중...
        </p>
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            Next.js 14.2.35 | React 18.3.1
          </p>
          <p className="text-xs text-blue-500 mt-1">
            보안 패치 적용됨 (CVE-2025-55182 대응)
          </p>
        </div>
      </div>
    </main>
  );
}
