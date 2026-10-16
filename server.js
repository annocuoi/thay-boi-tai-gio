require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

// ==================== ĐƯỜNG DẪN DỮ LIỆU ====================

const DATA_DIR = path.join(__dirname, "data");
const USAGE_FILE = path.join(DATA_DIR, "usage.json");
const BLOCKED_FILE = path.join(DATA_DIR, "blocked-ips.json");
const GRANTS_FILE = path.join(DATA_DIR, "extra-allowances.json");
const ANSWERS_FILE = path.join(DATA_DIR, "saved-answers.json");
const PROFILE_REGISTRY_FILE = path.join(DATA_DIR, "profile-registry.json");
const LIMITS_FILE = path.join(DATA_DIR, "limits.json");

const ADMIN_SESSION_COOKIE = "tai_gio_admin";
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
const adminSessions = new Map();

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ==================== TRANG CHỦ ====================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ==================== QUẢN LÝ FILE JSON ====================

function ensureFile(file, initialData) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(initialData, null, 2), "utf8");
  }
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const content = fs.readFileSync(file, "utf8").trim();
    if (!content) return fallback;
    return JSON.parse(content);
  } catch (err) {
    console.error("Lỗi đọc file:", path.basename(file), err.message);
    return fallback;
  }
}

function writeJson(file, data) {
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tempFile, file);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

ensureFile(USAGE_FILE, {
  day: "",
  profiles: {},
  ips: {},
  autoBlockedIps: {}
});

ensureFile(BLOCKED_FILE, { ips: [] });
ensureFile(GRANTS_FILE, { profiles: [], ips: [] });
ensureFile(ANSWERS_FILE, { answers: {} });
ensureFile(PROFILE_REGISTRY_FILE, { profiles: {} });
ensureFile(LIMITS_FILE, {
  profileDailyLimit: 5,
  ipDailyLimit: 10
});

// ==================== TÍNH CÁCH THẦY BÓI ====================

// ==================== TÍNH CÁCH THẦY BÓI ====================

const THAY_INSTRUCTIONS = `
# THẦY BÓI TÀI GIÓ — LUẬT NHẬP VAI TỐI CAO

## 1. DANH TÍNH
Ngươi là Thầy Bói Tài Gió, một ông thầy bói hư cấu người Việt, già đời, huyền bí, tự tin, sắc sảo, có uy, cực kỳ nóng tính, thích cà khịa và ghét kẻ nào khai báo vớ vẩn, trêu chọc hoặc hỏi nhảm.
Ngươi xưng "ta", gọi người hỏi là "con" hoặc "tín chủ".

## 2. QUY TẮC BẮT BÀI & CÁU GIẬN NỔI NÓNG (GIỮ NGUYÊN):
Trước khi luận quẻ, ngươi BẮT BUỘC phải soi kỹ thông tin hồ sơ và câu hỏi để phát hiện các trường hợp sau:
1. MÂU THUẪN GIỚI TÍNH (Nam hỏi lấy chồng / Nữ hỏi lấy vợ).
2. MÂU THUẪN GIA CẢNH (Độc thân khai có con / Đã kết hôn hỏi lấy vợ).
3. TRÊU THẦY / HỎI ĐỜI TƯ CỦA THẦY ("khi nào thầy có bồ", "thầy ăn cơm chưa",...).
4. HỎI NGOÀI LỀ / VỚ VẨN / KHOA HỌC / ĐỐ VUI.
👉 NỔI GIẬN BẮT BÀI VÀ QUÁT MẮNG TẾ TÁT NGHEN!

## 3. PHÁN BÓI THẬT SỰ — TUYỆT ĐỐI CẤM KHUYÊN NHỦ ĐẠO LÝ! (CỰC KỲ QUAN TRỌNG)

Khi câu hỏi nghiêm túc và thông tin chuẩn:
- **CẤM TUYỆT ĐỐI:** Không dùng các câu khuyên dạy đạo lý đời sống như: "hãy mở lòng", "hãy hạ bớt cái tôi", "đừng rụt rè", "chịu khó giao tiếp", "phải nỗ lực", "sửa tính khí đi"... Lời phán bói toán KHÔNG PHẢI là buổi tư vấn tâm lý!
- **NHÒM QUẺ BÓI TOÁN:** Phải phán đúng phong cách thầy bói tâm linh — đưa ra điềm báo, hiện tượng, vận hạn, thời điểm, đối tượng và nhân duyên số phận!

**QUY TẮC CẤU TRÚC LỜI PHÁN BÓI (3-5 CÂU):**
1. **Mở quẻ phán thẳng kết quả:** "Quẻ này là Quẻ [Tốt/Xấu/Trung bình], bấm tay thấy..."
2. **Nêu mốc thời gian & sự kiện số mệnh:** Chỉ ra chính xác mốc thời gian (ví dụ: "Tháng 8 âm lịch năm nay", "Sang xuân năm sau", "Vào tiết Thu phân"...).
3. **Mô tả đối tượng / điềm báo tâm linh:** Mô tả đặc điểm duyên số/người ấy (ví dụ: "Người này da ngăm, làm nghề kinh doanh", "Người ấy xuất hiện từ hướng Đông Nam", "Cơ nghiệp có điềm dịch chuyển",...).
4. **Phán vận hạn / rào cản từ số mệnh:** Chỉ ra hạn sao, vận xui (ví dụ: "Năm nay bị sao Tế Ngoái chiếu", "Bị vướng dây tơ hồng đứt đoạn", "Cẩn thận tiểu nhân chọc phá",...).

Ví dụ LỜI PHÁN BÓI ĐÚNG CHUẨN:
"Quẻ Tốt! Nghe đây con Võ Đức Tài: Bấm quẻ thấy dây tơ hồng của con đã chuyển màu đỏ thắm, mốc kết duyên rơi vào khoảng cuối năm nay đến giữa năm sau. Đối phương là người cách nơi con ở một quãng đường, dáng người mảnh khảnh, mệnh Thủy tương sinh với con. Tháng 10 âm lịch này sẽ có điềm báo gặp gỡ qua một buổi hội họp hoặc sự kiện bất ngờ. Chỉ lưu ý: Đầu năm sau có sao Thiên Không chiếu nhẹ, cẩn thận có kẻ thứ ba chọc ngoáy làm gián đoạn, qua được hạn đó là cầm tay nhau đi đăng ký kết hôn!"
`;

// ==================== HÀM TIỆN ÍCH ====================

function todayVietnam() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = {};
  for (const part of parts) values[part.type] = part.value;

  return `${values.year}-${values.month}-${values.day}`;
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ");
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function profileKey(profile) {
  return hash([
    normalize(profile.name),
    String(profile.dob || "").trim(),
    normalize(profile.gender)
  ].join("|"));
}

function answerKey(profile, topic, question) {
  return hash([
    profileKey(profile),
    normalize(topic),
    normalize(question)
  ].join("|"));
}

function getClientIp(req) {
  return String(req.ip || req.socket.remoteAddress || "unknown")
    .replace(/^::ffff:/, "");
}

function clampLimit(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 1000 ? number : fallback;
}

function getLimits() {
  const saved = readJson(LIMITS_FILE, {});
  return {
    profileDailyLimit: clampLimit(saved.profileDailyLimit, 5),
    ipDailyLimit: clampLimit(saved.ipDailyLimit, 10)
  };
}

function loadUsage() {
  const today = todayVietnam();
  let usage = readJson(USAGE_FILE, {
    day: today,
    profiles: {},
    ips: {},
    autoBlockedIps: {}
  });

  if (usage.day !== today) {
    usage = { day: today, profiles: {}, ips: {}, autoBlockedIps: {} };
    writeJson(USAGE_FILE, usage);
  }

  usage.profiles ||= {};
  usage.ips ||= {};
  usage.autoBlockedIps ||= {};

  return usage;
}

function getExtraQuestions(grants, profile, ip) {
  let profileExtra = 0;
  let ipExtra = 0;

  if (Array.isArray(grants.profiles)) {
    const grant = grants.profiles.find(item =>
      normalize(item.name) === normalize(profile.name) &&
      String(item.dob || "").trim() === String(profile.dob || "").trim() &&
      normalize(item.gender) === normalize(profile.gender)
    );
    if (grant) profileExtra = Math.max(0, Number(grant.extraQuestions) || 0);
  }

  if (Array.isArray(grants.ips)) {
    const grant = grants.ips.find(item => String(item.ip || "").trim() === ip);
    if (grant) ipExtra = Math.max(0, Number(grant.extraQuestions) || 0);
  }

  return { profileExtra, ipExtra };
}

function getBlockedIps() {
  const data = readJson(BLOCKED_FILE, { ips: [] });
  return Array.isArray(data.ips) ? data.ips.map(String) : [];
}

// ==================== ĐĂNG NHẬP QUẢN TRỊ ====================

function getAdminSession(req) {
  const cookies = String(req.headers.cookie || "");
  const match = cookies.match(/(?:^|;\s*)tai_gio_admin=([^;]+)/);
  if (!match) return null;

  let token;
  try { token = decodeURIComponent(match[1]); } catch { return null; }

  const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    return null;
  }

  session.expiresAt = Date.now() + ADMIN_SESSION_MS;
  return session;
}

function requireAdmin(req, res, next) {
  if (!getAdminSession(req)) {
    return res.status(401).json({ error: "Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại." });
  }
  next();
}

function safeEqual(a, b) {
  const first = Buffer.from(String(a || ""));
  const second = Buffer.from(String(b || ""));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

app.post("/api/admin/login", (req, res) => {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!expectedPassword) {
    return res.status(500).json({ error: "Chưa cấu hình ADMIN_PASSWORD trong file .env." });
  }

  if (!safeEqual(password, expectedPassword)) {
    return res.status(401).json({ error: "Mật khẩu quản trị không đúng." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, { expiresAt: Date.now() + ADMIN_SESSION_MS });

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`
  );

  res.json({ success: true });
});

app.post("/api/admin/logout", (req, res) => {
  const match = String(req.headers.cookie || "").match(/(?:^|;\s*)tai_gio_admin=([^;]+)/);
  if (match) {
    try { adminSessions.delete(decodeURIComponent(match[1])); } catch {}
  }
  res.setHeader("Set-Cookie", `${ADMIN_SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.json({ success: true });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ authenticated: true });
});

// ==================== BẢNG THỐNG KÊ QUẢN TRỊ ====================

app.get("/api/admin/dashboard", requireAdmin, (req, res) => {
  const usage = loadUsage();
  const registry = readJson(PROFILE_REGISTRY_FILE, { profiles: {} });
  const limits = getLimits();
  const grants = readJson(GRANTS_FILE, { profiles: [], ips: [] });
  const search = normalize(req.query.search || "");

  const profiles = Object.entries(registry.profiles || {})
    .map(([key, item]) => {
      const extra = getExtraQuestions(grants, item, item.lastIp || "");
      return {
        key,
        name: item.name || "",
        dob: item.dob || "",
        gender: item.gender || "",
        lastIp: item.lastIp || "",
        profileUsed: Number(usage.profiles[key] || 0),
        profileLimit: limits.profileDailyLimit + extra.profileExtra,
        updatedAt: item.updatedAt || ""
      };
    })
    .filter(item => {
      if (!search) return true;
      return [item.name, item.dob, item.gender, item.lastIp].some(v => normalize(v).includes(search));
    });

  const ips = Object.entries(usage.ips || {}).map(([ip, count]) => {
    const extra = getExtraQuestions(grants, {}, ip).ipExtra;
    return {
      ip,
      used: Number(count || 0),
      limit: limits.ipDailyLimit + extra,
      blocked: getBlockedIps().includes(ip),
      autoBlocked: usage.autoBlockedIps?.[ip] === usage.day
    };
  }).filter(item => !search || normalize(item.ip).includes(search));

  res.json({ day: usage.day, limits, profiles, ips, blockedIps: getBlockedIps() });
});

app.post("/api/admin/limits", requireAdmin, (req, res) => {
  const profileDailyLimit = Number(req.body?.profileDailyLimit);
  const ipDailyLimit = Number(req.body?.ipDailyLimit);

  if (!Number.isInteger(profileDailyLimit) || !Number.isInteger(ipDailyLimit) || profileDailyLimit < 1 || profileDailyLimit > 1000 || ipDailyLimit < 1 || ipDailyLimit > 1000) {
    return res.status(400).json({ error: "Giới hạn phải là số nguyên từ 1 đến 1000." });
  }

  const limits = { profileDailyLimit, ipDailyLimit };
  writeJson(LIMITS_FILE, limits);
  res.json({ success: true, limits });
});

app.post("/api/admin/extra-allowance", requireAdmin, (req, res) => {
  const type = req.body?.type;
  const extraQuestions = Number(req.body?.extraQuestions);

  if (!Number.isInteger(extraQuestions) || extraQuestions < 0 || extraQuestions > 1000) {
    return res.status(400).json({ error: "Số lượt cộng thêm phải từ 0 đến 1000." });
  }

  const grants = readJson(GRANTS_FILE, { profiles: [], ips: [] });
  grants.profiles ||= [];
  grants.ips ||= [];

  if (type === "profile") {
    const name = String(req.body?.name || "").trim();
    const dob = String(req.body?.dob || "").trim();
    const gender = String(req.body?.gender || "").trim();

    if (!name || !dob || !gender) {
      return res.status(400).json({ error: "Cần nhập họ tên, ngày sinh và giới tính." });
    }

    const found = grants.profiles.find(item =>
      normalize(item.name) === normalize(name) &&
      String(item.dob || "").trim() === dob &&
      normalize(item.gender) === normalize(gender)
    );

    if (found) found.extraQuestions = extraQuestions;
    else grants.profiles.push({ name, dob, gender, extraQuestions });
  } else if (type === "ip") {
    const ip = String(req.body?.ip || "").trim();
    if (!ip) return res.status(400).json({ error: "Cần nhập địa chỉ IP." });

    const found = grants.ips.find(item => String(item.ip || "").trim() === ip);
    if (found) found.extraQuestions = extraQuestions;
    else grants.ips.push({ ip, extraQuestions });
  } else {
    return res.status(400).json({ error: "Loại cấp lượt không hợp lệ." });
  }

  writeJson(GRANTS_FILE, grants);
  res.json({ success: true });
});

app.post("/api/admin/block-ip", requireAdmin, (req, res) => {
  const ip = String(req.body?.ip || "").trim();
  const blocked = req.body?.blocked === true;

  if (!ip) return res.status(400).json({ error: "Cần nhập địa chỉ IP." });

  const data = readJson(BLOCKED_FILE, { ips: [] });
  data.ips = Array.isArray(data.ips) ? data.ips.map(String) : [];

  if (blocked && !data.ips.includes(ip)) data.ips.push(ip);
  if (!blocked) data.ips = data.ips.filter(item => item !== ip);

  writeJson(BLOCKED_FILE, data);

  if (!blocked) {
    const usage = loadUsage();
    delete usage.autoBlockedIps[ip];
    writeJson(USAGE_FILE, usage);
  }

  res.json({ success: true, ips: data.ips });
});

// ==================== API BÓI TOÁN ====================

app.post("/api/fortune", async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    const profile = req.body?.profile;

    if (!prompt || prompt.length > 6000) {
      return res.status(400).json({ error: "Nội dung câu hỏi không hợp lệ." });
    }

    if (!profile || ["name", "gender", "dob"].some(f => typeof profile[f] !== "string" || !profile[f].trim())) {
      return res.status(400).json({ error: "Vui lòng nhập họ tên, giới tính và ngày sinh." });
    }

    const topic = typeof profile.topic === "string" ? profile.topic.trim() : "";
    const question = typeof profile.question === "string" ? profile.question.trim() : "";

    if (!topic || !question) {
      return res.status(400).json({ error: "Vui lòng chọn chủ đề và nhập câu hỏi." });
    }

    const ip = getClientIp(req);

    if (getBlockedIps().includes(ip)) {
      return res.status(403).json({ error: "IP này đang bị chủ trang chặn." });
    }

    const cache = readJson(ANSWERS_FILE, { answers: {} });
    cache.answers ||= {};

    const aKey = answerKey(profile, topic, question);
    const saved = cache.answers[aKey];

    if (saved && saved.answer) {
      return res.json({ answer: saved.answer, cached: true });
    }

    if (!client) {
      return res.status(500).json({ error: "Chưa cấu hình OPENAI_API_KEY trong file .env." });
    }

    const usage = loadUsage();
    const today = usage.day;

    if (usage.autoBlockedIps[ip] === today) {
      return res.status(429).json({ error: "IP đã hết lượt hôm nay. Mai hãy quay lại nhé!" });
    }

    const grants = readJson(GRANTS_FILE, { profiles: [], ips: [] });
    const pKey = profileKey(profile);
    const { profileExtra, ipExtra } = getExtraQuestions(grants, profile, ip);
    const limits = getLimits();

    const profileLimit = limits.profileDailyLimit + profileExtra;
    const ipLimit = limits.ipDailyLimit + ipExtra;

    const profileCount = Number(usage.profiles[pKey] || 0);
    const ipCount = Number(usage.ips[ip] || 0);

    if (profileCount >= profileLimit) {
      return res.status(429).json({ error: `Hồ sơ đã dùng hết ${profileLimit} lượt hôm nay.` });
    }

    if (ipCount >= ipLimit) {
      usage.autoBlockedIps[ip] = today;
      writeJson(USAGE_FILE, usage);
      return res.status(429).json({ error: `IP đã dùng hết ${ipLimit} lượt hôm nay.` });
    }

    let answer = "";
    if (client.responses && typeof client.responses.create === "function") {
      const result = await client.responses.create({
        model,
        input: `${THAY_INSTRUCTIONS}\n\nTHÔNG TIN HỒ SƠ VÀ CÂU HỎI:\n${prompt}\n\nLƯU Ý: Đọc kỹ thông tin hồ sơ và câu hỏi "${question}". Nếu mâu thuẫn giới tính (Nam hỏi lấy chồng/Nữ hỏi lấy vợ), mâu thuẫn gia cảnh, hỏi đời tư thầy, hoặc sai chủ đề -> PHẢI NỔI GIẬN VÀ BẮT BÀI NGAY!`,
        reasoning: { effort: "low" },
        max_output_tokens: 1200
      });
      answer = (result.output_text || "").trim();
    } else {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: THAY_INSTRUCTIONS },
          { role: "user", content: `${prompt}\n\nLƯU Ý: Đọc kỹ thông tin hồ sơ và câu hỏi "${question}". Nếu mâu thuẫn giới tính (Nam hỏi lấy chồng/Nữ hỏi lấy vợ), mâu thuẫn gia cảnh, hỏi đời tư thầy, hoặc sai chủ đề -> PHẢI NỔI GIẬN VÀ BẮT BÀI NGAY!` }
        ],
        max_tokens: 1000
      });
      answer = (completion.choices[0]?.message?.content || "").trim();
    }

    if (!answer) {
      return res.status(502).json({ error: "GPT chưa viết được lời phán. Vui lòng thử lại." });
    }

    usage.profiles[pKey] = profileCount + 1;
    usage.ips[ip] = ipCount + 1;
    writeJson(USAGE_FILE, usage);

    const registry = readJson(PROFILE_REGISTRY_FILE, { profiles: {} });
    registry.profiles ||= {};
    registry.profiles[pKey] = {
      name: profile.name.trim(),
      dob: profile.dob.trim(),
      gender: profile.gender.trim(),
      lastIp: ip,
      updatedAt: new Date().toISOString()
    };
    writeJson(PROFILE_REGISTRY_FILE, registry);

    cache.answers[aKey] = { answer, savedAt: new Date().toISOString() };
    writeJson(ANSWERS_FILE, cache);

    return res.json({ answer, cached: false });
  } catch (err) {
    console.error("OpenAI request failed:", err?.status || "", err?.message || err);
    return res.status(502).json({ error: "Không kết nối được máy chủ GPT. Lỗi: " + (err.message || "Unknown") });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Thầy Bói Tài Gió chạy tại http://localhost:${port}`);
});
