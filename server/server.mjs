import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
// pdf-parse는 default import를 사용하는 경우가 많으므로 환경에 따라 다를 수 있으나, 기존 유지
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const PDFParse = require("pdf-parse");
import { extractTextFromPptx } from "./pptx-extractor.js";
import multer from "multer";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
// 모델 이름
const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";

app.use(cors());
app.use(express.json({ limit: "10mb" })); // 파일 크기 고려하여 limit 약간 상향

// 업로드 폴더 없으면 생성
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const previewDir = path.join(process.cwd(), "..", "preview");

// 정적 프론트엔드 (preview 폴더) 서빙
app.use(express.static(previewDir));

// multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // 파일명 인코딩 문제 방지를 위해 영문/숫자만 남기거나 timestamp만 쓰는 것이 안전함
    const unique = Date.now() + "_" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});
const upload = multer({ storage });

// Gemini 호출 함수 (수정됨)
async function generateWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY 환경 변수가 설정되어 있지 않습니다.");
  }

  // [수정 포인트 1] v1 -> v1beta 로 변경
  // gemini-1.5-flash는 v1beta 엔드포인트 사용 권장
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini 호출 실패(${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ||
    "";

  if (!text) {
    throw new Error("Gemini 응답에 텍스트가 없습니다.");
  }

  // [수정 포인트 2] Markdown 코드 블록 제거 (JSON 파싱 에러 방지)
  // 예: ```json { ... } ``` 형태로 올 경우 ```json 과 ```를 제거
  const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

  return cleanText;
}

// 헬스체크
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// 루트 요청시 프리뷰 앱
app.get("/", (req, res) => {
  res.sendFile(path.join(previewDir, "index.html"));
});

// 파일 업로드 API
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "파일 없음" });

  res.json({
    ok: true,
    fileId: req.file.filename,
    originalName: req.file.originalname,
  });
});

// 텍스트 기반 퀴즈 생성
app.post("/api/generate-quiz", async (req, res) => {
  const { sourceText, numQuestions = 5, difficulty = "normal" } = req.body || {};

  if (!sourceText || typeof sourceText !== "string") {
    return res.status(400).json({ error: "sourceText (string) 가 필요합니다." });
  }

  try {
    const prompt = `
당신은 대학 전공 학습용 퀴즈 출제 도우미입니다.
다음 원문을 기반으로 한국어 객관식 퀴즈를 만들어주세요.

요구사항:
- 총 ${numQuestions}문제
- 각 문제는 4지선다 객관식
- 난이도: ${difficulty}
- 출력은 오직 JSON 형식이어야 함 (Markdown 문법 사용 금지)

반드시 아래 JSON 구조를 따르세요:
{
  "questions": [
    {
      "question": "문제 내용",
      "options": ["보기1", "보기2", "보기3", "보기4"],
      "correctIndex": 0,
      "explanation": "해설"
    }
  ]
}

원문:
${sourceText}
`;

    const text = await generateWithGemini(prompt);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("JSON 파싱 실패, raw:", text);
      // 파싱 실패 시 원본 텍스트라도 반환하여 디버깅 돕기
      return res.status(500).json({ error: "JSON 파싱 실패", rawText: text });
    }

    if (!Array.isArray(parsed.questions)) {
      return res.status(500).json({ error: "questions 배열이 없습니다.", parsed });
    }

    res.json({ questions: parsed.questions });

  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: "AI 호출 중 오류", detail: String(err) });
  }
});

// 파일 기반 퀴즈 생성
app.post("/api/generate-quiz-from-file", async (req, res) => {
  const { fileId, numQuestions = 5 } = req.body;

  if (!fileId) {
    return res.status(400).json({ error: "fileId 필요함" });
  }

  const filePath = path.join(process.cwd(), "uploads", fileId);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "파일을 찾을 수 없음" });
  }

  try {
    let extractedText = "";
    const ext = path.extname(fileId).toLowerCase(); // 확장자 추출 방식 변경

    if (ext === ".pdf") {
      const buffer = fs.readFileSync(filePath);
      // pdf-parse 사용법은 버전에 따라 다를 수 있으나 일반적인 방식 적용
      const data = await PDFParse(buffer);
      extractedText = data.text || "";
    } else if (ext === ".pptx") {
      extractedText = await extractTextFromPptx(filePath);
    } else {
      // 확장자 체크 로직 보완
      return res.status(400).json({ error: "지원하지 않는 파일 포맷 (" + ext + ")" });
    }

    if (!extractedText.trim()) {
       return res.status(400).json({ error: "문서에서 텍스트를 추출할 수 없습니다." });
    }

    const prompt = `
당신은 대학 전공 학습용 객관식 퀴즈를 생성하는 도우미입니다.
다음 문서를 기반으로 ${numQuestions}개의 객관식 문제를 만들어주세요.

출력 형식(JSON Only):
{
  "questions": [
    {
      "question": "문제",
      "options": ["보기1","보기2","보기3","보기4"],
      "correctIndex": 0, // 정답은 0~3 사이 정수
      "explanation": "해설"
    }
  ]
}

문서 내용 (일부 발췌):
${extractedText.slice(0, 8000)}
`;

    const text = await generateWithGemini(prompt);

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error("파일 퀴즈 JSON 파싱 실패:", text);
      return res.status(500).json({ error: "AI 응답 JSON 파싱 실패", raw: text });
    }

    res.json(json);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 에러", details: String(err) });
  }
});

app.listen(port, () => {
  console.log(`Quiz API server listening on http://localhost:${port}`);
});
