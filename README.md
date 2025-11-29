# AIapp 배포 가이드

## 구성
- `server/`: Express 기반 API 서버 (PDF/PPTX 텍스트 추출 → Gemini로 퀴즈 생성)
- `preview/`: 정적 프론트엔드. 서버가 정적으로 서빙하도록 설정됨.

## 환경 변수
`.env`를 프로젝트 루트(`cwnu/AIapp/.env`)에 생성:
```env
PORT=4000
GEMINI_API_KEY=your_gemini_api_key_here
# 선택: 기본값 gemini-1.5-flash-latest
# GEMINI_MODEL=gemini-1.5-pro
```

## 설치 및 실행
```bash
cd server
npm install --production
# 필요 시 nvm 사용: source ~/.nvm/nvm.sh
npm start
```
서버 기동 후 `http://localhost:4000` 접속 시 프론트가 열리고 API는 동일 호스트로 호출됩니다.

## 엔드포인트
- `GET /health` 헬스체크
- `POST /api/upload` multipart `file` 업로드 → `{ ok, fileId, originalName }`
- `POST /api/generate-quiz` `{ sourceText, numQuestions?, difficulty? }`
- `POST /api/generate-quiz-from-file` `{ fileId, numQuestions? }` (업로드된 PDF/PPTX 사용)

## 배포 팁
- 프론트/백이 같은 포트에서 서빙되므로 CORS 단순화.
- 정적 자산 캐싱을 원하면 리버스 프록시(Nginx 등) 앞단에 캐시 헤더 추가.
- 로그/모니터링: PM2 등 프로세스 매니저를 사용하거나 시스템 서비스로 등록해 재시작/로그 관리.
