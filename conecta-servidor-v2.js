// Conecta: servidor (conecta-api v2). Gerado automaticamente a partir do código-fonte; carregado no deploy pela função do Supabase.

// deps:npm:hono
var Hono = globalThis.__conectaDeps.Hono;

// deps:npm:hono/cors
var cors = globalThis.__conectaDeps.cors;

// deps:npm:hono/logger
var logger = globalThis.__conectaDeps.logger;

// deps:npm:@supabase/supabase-js@2
var createClient = globalThis.__conectaDeps.createClient;

// ../conecta-api/kv_store.ts
var client = () => createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
);
var set = async (key, value) => {
  const supabase = client();
  const { error } = await supabase.from("kv_store_b92ddf44").upsert({
    key,
    value
  });
  if (error) {
    throw new Error(error.message);
  }
};
var get = async (key) => {
  const supabase = client();
  const { data, error } = await supabase.from("kv_store_b92ddf44").select("value").eq("key", key).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data?.value;
};
var del = async (key) => {
  const supabase = client();
  const { error } = await supabase.from("kv_store_b92ddf44").delete().eq("key", key);
  if (error) {
    throw new Error(error.message);
  }
};
var mdel = async (keys) => {
  const supabase = client();
  const { error } = await supabase.from("kv_store_b92ddf44").delete().in("key", keys);
  if (error) {
    throw new Error(error.message);
  }
};
var getByPrefix = async (prefix) => {
  const supabase = client();
  const { data, error } = await supabase.from("kv_store_b92ddf44").select("key, value").like("key", prefix + "%");
  if (error) {
    throw new Error(error.message);
  }
  return data?.map((d) => d.value) ?? [];
};

// ../conecta-api/push.ts
var b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var fromB64url = (value) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
};
var concat = (...parts) => {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((sum, part) => sum + part.length, 0)));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};
var text = (value) => new TextEncoder().encode(value);
async function vapidJwt(audience, privateKey, contact) {
  const header = b64url(text(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(text(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1e3) + 12 * 3600, sub: `mailto:${contact}` })));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, text(`${header}.${claims}`)));
  return `${header}.${claims}.${b64url(signature)}`;
}
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}
async function encryptPushPayload(payload, p256dh, authSecret) {
  const clientPublic = fromB64url(p256dh);
  const auth = fromB64url(authSecret);
  const serverPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey("raw", serverPair.publicKey));
  const clientKey = await crypto.subtle.importKey("raw", clientPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, serverPair.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(text("WebPush: info\0"), clientPublic, serverPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(salt, ikm, text("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, text("Content-Encoding: nonce\0"), 12);
  const aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, concat(text(payload), new Uint8Array([2]))));
  const recordSize = new Uint8Array([0, 0, 16, 0]);
  return concat(salt, recordSize, new Uint8Array([serverPublic.length]), serverPublic, encrypted);
}
async function generateVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: b64url(publicRaw), privateJwk };
}

// ../conecta-api/core.ts
var STAFF_ROLES = ["owner", "admin", "professor"];
var isStaff = (profile) => STAFF_ROLES.includes(profile.role);
var courseIds = /* @__PURE__ */ new Set(["colegio-apoio"]);
var builtInChannels = {
  "colegio-apoio": /* @__PURE__ */ new Set(["geral", "avisos", "duvidas", "estudos", "sala-voz"])
};
var OWNER_EMAIL = "gabrieltmacedo@aluno.colegioapoio.net";
var MEDIA_BUCKET = "conecta-media";
var MAX_IMAGE_BYTES = 15e5;
var REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "✅"];
var requestLimits = /* @__PURE__ */ new Map();
var SUPABASE_URL = () => Deno.env.get("SUPABASE_URL");
var SERVICE_KEY = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
var adminClient = () => createClient(SUPABASE_URL(), SERVICE_KEY(), { auth: { autoRefreshToken: false, persistSession: false } });
function inBackground(task) {
  const runtime = globalThis.EdgeRuntime;
  const safe = task.catch((error) => console.error("tarefa em segundo plano falhou:", error));
  if (runtime?.waitUntil) runtime.waitUntil(safe);
}
async function authenticatedUser(c) {
  const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  return error ? null : data.user;
}
async function profileFor(user) {
  const key = `profile:${user.id}`;
  const saved = await get(key);
  const ownerEmail = OWNER_EMAIL;
  if (saved) {
    let changed2 = false;
    if (!Array.isArray(saved.courses)) {
      saved.courses = [];
      changed2 = true;
    }
    if (!Array.isArray(saved.pendingCourses)) {
      saved.pendingCourses = [];
      changed2 = true;
    }
    if (ownerEmail && user.email?.toLowerCase() === ownerEmail && saved.role !== "owner") {
      saved.role = "owner";
      changed2 = true;
    }
    if (changed2) await set(key, saved);
    return saved;
  }
  const profile = {
    id: user.id,
    email: user.email ?? "",
    name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Aluno",
    bio: "",
    role: ownerEmail && user.email?.toLowerCase() === ownerEmail ? "owner" : "aluno",
    avatarDataUrl: null,
    bannerDataUrl: null,
    joinedAt: user.created_at ?? (/* @__PURE__ */ new Date()).toISOString(),
    courses: [],
    pendingCourses: []
  };
  await set(key, profile);
  return profile;
}
function requestedCourses(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((course) => typeof course === "string" && validCommunityId(course)))];
}
async function knownCourse(courseId) {
  return courseIds.has(courseId) || !!await get(`community:${courseId}`);
}
function validCommunityId(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 48;
}
function validImageDataUrl(value) {
  return value === null || typeof value === "string" && value.length <= 21e5 && /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/]+=*$/i.test(value);
}
var isStoredMediaUrl = (value) => typeof value === "string" && value.startsWith(`${SUPABASE_URL()}/storage/v1/object/public/${MEDIA_BUCKET}/`) && value.length < 600;
async function ensureMediaBucket() {
  const storage = adminClient().storage;
  const { data } = await storage.getBucket(MEDIA_BUCKET);
  if (data) {
    if (!data.public) {
      const { error: error2 } = await storage.updateBucket(MEDIA_BUCKET, { public: true });
      if (error2) throw new Error(error2.message);
    }
    return;
  }
  const { error } = await storage.createBucket(MEDIA_BUCKET, {
    public: true,
    fileSizeLimit: "2MB",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"]
  });
  if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
}
async function storeImage(dataUrl, userId, folder) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/]+=*)$/i.exec(dataUrl);
  if (!match) throw new Error("A imagem deve ser PNG, JPEG, WebP ou GIF.");
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("A imagem deve ter até 1,5 MB.");
  await ensureMediaBucket();
  const extension = match[1].split("/")[1].replace("jpeg", "jpg");
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await adminClient().storage.from(MEDIA_BUCKET).upload(path, bytes, {
    contentType: match[1],
    upsert: false
  });
  if (error) throw new Error(error.message);
  return adminClient().storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}
async function persistProfileImage(value, current, userId, folder) {
  if (value === null) return null;
  if (typeof value !== "string") return current;
  if (value === current && !value.startsWith("data:image/")) return current;
  if (!validImageDataUrl(value)) throw new Error("A imagem do perfil é inválida.");
  return storeImage(value, userId, `profile/${folder}`);
}
async function persistCommunityImage(value, current, communityId, folder) {
  if (value === null || value === void 0 || value === "") return null;
  if (typeof value !== "string") return current ?? null;
  if (value === current || isStoredMediaUrl(value)) return value;
  if (!validImageDataUrl(value)) return current ?? null;
  return storeImage(value, "communities", `${communityId}/${folder}`);
}
function withinRateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  if (requestLimits.size > 1e4) {
    for (const [storedKey, value] of requestLimits) {
      if (value.resetAt <= now) requestLimits.delete(storedKey);
    }
  }
  const current = requestLimits.get(key);
  if (!current || current.resetAt <= now) {
    requestLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= maxRequests) return false;
  current.count += 1;
  return true;
}
async function validMessageChannel(channel) {
  const [communityId, channelId, ...extra] = channel.split("::");
  if (extra.length || !communityId || !channelId || !/^[a-z0-9-]{1,48}$/.test(communityId) || !/^[a-z0-9-]{1,48}$/.test(channelId)) return false;
  const community = await get(`community:${communityId}`);
  if (community) return !!community.channels?.some((item) => item.id === channelId);
  return !!builtInChannels[communityId]?.has(channelId);
}
var friendshipKey = (userId, friendId) => `friend:${userId}:${friendId}`;
var privateConversationKey = (firstId, secondId) => `private-message:${[firstId, secondId].sort().join(":")}:`;
var validUserId = (id) => /^[0-9a-f-]{36}$/i.test(id);
var validId = (id) => /^[0-9a-f-]{36}$/i.test(id);
var SCHOOL_ID = "colegio-apoio";
async function communityFor(id) {
  const stored = await get(`community:${id}`);
  if (stored) return id === SCHOOL_ID ? { ...stored, requiresApproval: true } : stored;
  return id === SCHOOL_ID ? { id, name: "Colégio Apoio", requiresApproval: true } : null;
}
var validMemberLimit = (value) => Number.isInteger(value) && value >= 1 && value <= 1e5;
async function communityCapacity(communityId, profiles) {
  const community = await communityFor(communityId);
  const list = profiles ?? await getByPrefix("profile:");
  const count = list.filter((profile) => profile && profile.role !== "owner" && profile.courses?.includes(communityId)).length;
  const limit = validMemberLimit(community?.memberLimit) ? community.memberLimit : null;
  return { count, limit, full: limit !== null && count >= limit };
}
async function broadcast(topic, event, payload = {}) {
  try {
    const name = await topic;
    await fetch(`${SUPABASE_URL()}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SERVICE_KEY(), Authorization: `Bearer ${SERVICE_KEY()}` },
      body: JSON.stringify({ messages: [{ topic: name, event, payload }] }),
      signal: AbortSignal.timeout(4e3)
    });
  } catch (error) {
    console.error("aviso em tempo real falhou:", error);
  }
}
var channelTopic = (channel) => `conecta:canal:${channel}`;
var topicKeyCache = null;
async function sealedName(value) {
  if (!topicKeyCache) {
    const seed = await crypto.subtle.digest("SHA-256", text(`conecta-topicos:${SERVICE_KEY()}`));
    topicKeyCache = await crypto.subtle.importKey("raw", seed, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  }
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", topicKeyCache, text(value)));
  return b64url(signature.slice(0, 18));
}
var dmTopic = async (firstId, secondId) => `conecta:dm:${await sealedName(`dm:${[firstId, secondId].sort().join(":")}`)}`;
var userTopic = async (userId) => `conecta:pessoa:${await sealedName(`pessoa:${userId}`)}`;
var staffTopic = async () => `conecta:equipe:${await sealedName("equipe")}`;
var AGENDA_TOPIC = "conecta:agenda";
var vapidCache = null;
async function vapidKeys() {
  if (vapidCache) return vapidCache;
  let stored = await get("config:vapid");
  if (!stored) {
    stored = await generateVapidKeys();
    const again = await get("config:vapid");
    if (again) stored = again;
    else await set("config:vapid", stored);
  }
  const privateKey = await crypto.subtle.importKey("jwk", stored.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  vapidCache = { publicKey: stored.publicKey, privateKey };
  return vapidCache;
}
var PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)mozilla\.com$/, /(^|\.)mozaws\.net$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
var validPushEndpoint = (value) => {
  if (typeof value !== "string" || value.length > 1e3) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && PUSH_HOSTS.some((pattern) => pattern.test(url.hostname));
  } catch {
    return false;
  }
};
async function sendPush(subscription, notice) {
  const { publicKey, privateKey } = await vapidKeys();
  const endpoint = new URL(subscription.endpoint);
  const jwt = await vapidJwt(`${endpoint.protocol}//${endpoint.host}`, privateKey, OWNER_EMAIL);
  const body = await encryptPushPayload(JSON.stringify(notice), subscription.keys.p256dh, subscription.keys.auth);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      TTL: "86400",
      Urgency: "normal",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: `vapid t=${jwt}, k=${publicKey}`
    },
    body,
    signal: AbortSignal.timeout(8e3)
  });
  if (response.status === 404 || response.status === 410) await del(subscription.key);
}
async function notifyUsers(userIds, preference, notice, exceptUserId) {
  const subscriptions = await getByPrefix("push-sub:");
  const targets = subscriptions.filter((item) => item && item.userId !== exceptUserId && (!userIds || userIds.has(item.userId)) && item.prefs?.[preference] !== false).slice(0, 400);
  await Promise.allSettled(targets.map((item) => sendPush(item, notice)));
}
async function communityMembers(communityId) {
  const profiles = await getByPrefix("profile:");
  return new Set(profiles.filter((profile) => profile.courses?.includes(communityId) || isStaff(profile)).map((profile) => profile.id));
}
function calendarLines(events) {
  const today = /* @__PURE__ */ new Date();
  return events.filter((event) => {
    const eventDate = /* @__PURE__ */ new Date(`${event.date}T00:00:00.000Z`);
    const daysFromToday = (eventDate.getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 864e5;
    return daysFromToday >= -30 && daysFromToday <= 90;
  }).sort((first, second) => first.date.localeCompare(second.date) || first.time.localeCompare(second.time)).slice(0, 50).map((event) => {
    const kind = event.kind === "topic" ? "assunto" : event.kind === "event" ? "evento" : "prova";
    return `- ${(/* @__PURE__ */ new Date(`${event.date}T12:00:00.000Z`)).toLocaleDateString("pt-BR", { timeZone: "UTC" })}, ${event.time} (${kind}): ${event.subject} — ${event.topic}`;
  });
}
var schoolToday = () => (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
var validDay = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
var addDays = (day, amount) => {
  const date = /* @__PURE__ */ new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
var PRIVATE_BUCKET = "conecta-privado";
var privateBucketReady = false;
async function ensurePrivateBucket() {
  if (privateBucketReady) return;
  const storage = adminClient().storage;
  const { data } = await storage.getBucket(PRIVATE_BUCKET);
  if (data) {
    if (data.public) await storage.updateBucket(PRIVATE_BUCKET, { public: false });
  } else {
    const { error } = await storage.createBucket(PRIVATE_BUCKET, { public: false, fileSizeLimit: "2MB", allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"] });
    if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
  }
  privateBucketReady = true;
}
async function storePrivateImage(dataUrl, userId, folder) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/]+=*)$/i.exec(dataUrl);
  if (!match) throw new Error("A imagem deve ser PNG, JPEG, WebP ou GIF.");
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("A imagem deve ter até 1,5 MB.");
  await ensurePrivateBucket();
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${match[1].split("/")[1].replace("jpeg", "jpg")}`;
  const { error } = await adminClient().storage.from(PRIVATE_BUCKET).upload(path, bytes, { contentType: match[1], upsert: false });
  if (error) throw new Error(error.message);
  return path;
}
async function signPaths(paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  const result = /* @__PURE__ */ new Map();
  if (!unique.length) return result;
  const { data } = await adminClient().storage.from(PRIVATE_BUCKET).createSignedUrls(unique, 7 * 86400);
  for (const item of data ?? []) if (item.path && item.signedUrl && !item.error) result.set(item.path, item.signedUrl);
  return result;
}
async function withMedia(items) {
  const signed = await signPaths(items.map((item) => item.imagePath ?? "")).catch(() => /* @__PURE__ */ new Map());
  return items.map((item) => {
    if (!item.imagePath) return item;
    const { imagePath: _path, ...rest } = item;
    return { ...rest, imageUrl: signed.get(item.imagePath) ?? "" };
  });
}
var withOneMedia = async (item) => (await withMedia([item]))[0];
async function removePrivateImage(path) {
  if (!path) return;
  await adminClient().storage.from(PRIVATE_BUCKET).remove([path]).catch(() => {
  });
}
async function aiBlockedFor(profile) {
  if (profile.role !== "aluno") return null;
  const settings = await get("config:school");
  if (!settings?.requireAIConsent) return null;
  const consent = await get(`consent:${profile.id}`);
  return consent?.aiAllowed ? null : "A Conecta IA precisa da autorização do seu responsável. Peça para ele assinar o termo do Conecta e fale com a coordenação.";
}
async function addNotice(userId, notice) {
  const item = { ...notice, id: crypto.randomUUID(), createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  await set(`notice:${userId}:${item.id}`, item);
  inBackground(Promise.all([
    broadcast(userTopic(userId), "notices", {}),
    notifyUsers(/* @__PURE__ */ new Set([userId]), "messages", { title: "Mensagem removida pela coordenação", body: `Motivo: ${notice.reason}. Toque para ver e, se discordar, pedir revisão.`, url: "#/inicio", tag: `aviso:${item.id}` })
  ]));
  return item;
}

// ../conecta-api/moderation.ts
var LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i" };
function canonical(value) {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[0134578@$!]/g, (character) => LEET[character] ?? character).replace(/[^a-z\s]/g, " ").replace(/([a-z])\1+/g, "$1").replace(/\s+/g, " ").trim();
}
var canon = (list) => list.map(canonical);
var PROFANITY = new Set(canon([
  "porra",
  "caralho",
  "krl",
  "crl",
  "merda",
  "bosta",
  "puta",
  "puto",
  "putaria",
  "pqp",
  "fdp",
  "vsf",
  "vtnc",
  "tnc",
  "pnc",
  "buceta",
  "boceta",
  "cacete",
  "cuzao",
  "cuzinho",
  "arrombado",
  "arrombada",
  "vadia",
  "corno",
  "viado",
  "traveco",
  "punheta",
  "xota",
  "xoxota",
  "foda",
  "fodase",
  "foder",
  "fuder",
  "fudido",
  "fodido",
  "escroto",
  "escrota",
  "babaca"
]));
var PROFANITY_PREFIXES = canon(["fod", "fud", "caralh"]);
var INSULTS = canon([
  "idiota",
  "burro",
  "burra",
  "feio",
  "feia",
  "gordo",
  "gorda",
  "baleia",
  "lixo",
  "inutil",
  "nojento",
  "nojenta",
  "otario",
  "otaria",
  "imbecil",
  "retardado",
  "retardada",
  "estupido",
  "estupida",
  "fracassado",
  "fracassada",
  "ridiculo",
  "ridicula",
  "macaco",
  "macaca",
  "aberracao",
  "verme",
  "porco",
  "porca",
  "viado",
  "bicha",
  "traveco",
  "sapatao",
  "mongoloide",
  "jumento",
  "trouxa",
  "vagabundo",
  "vagabunda",
  "piranha",
  "vadia",
  "corno",
  "desgracado",
  "desgracada",
  "babaca",
  "escroto",
  "escrota",
  "arrombado",
  "arrombada",
  "doente mental",
  "lixo humano"
]);
var DIRECTED = canon([
  "seu",
  "sua",
  "seu grande",
  "sua grande",
  "voce e",
  "voce e um",
  "voce e uma",
  "vc e",
  "vc e um",
  "vc e uma",
  "voce eh",
  "vc eh",
  "tu e",
  "tu e um",
  "tu e uma",
  "teu",
  "cala a boca"
]);
var THREATS = canon([
  "vou te matar",
  "vou matar voce",
  "vou matar vc",
  "vou te bater",
  "vou bater em voce",
  "vou bater em vc",
  "te pego na saida",
  "te espero na saida",
  "vou acabar com voce",
  "vou acabar com vc",
  "vou quebrar sua cara",
  "vou quebrar tua cara",
  "voce vai apanhar",
  "vc vai apanhar",
  "vou te esfaquear",
  "vou te dar um tiro",
  "vou atirar em voce",
  "vou atirar em vc"
]);
var SELF_HARM_INCITEMENT = canon([
  "vai se matar",
  "va se matar",
  "se mata logo",
  "por que voce nao se mata",
  "pq vc nao se mata",
  "porque voce nao se mata",
  "devia se matar",
  "deveria se matar",
  "devia morrer",
  "deveria morrer",
  "merece morrer",
  "morre logo",
  "tomara que voce morra",
  "tomara que vc morra",
  "ninguem gosta de voce",
  "ninguem gosta de vc",
  "ninguem te ama",
  "ninguem liga pra voce",
  "ninguem liga pra vc",
  "kys"
]);
var HATE = canon([
  "volta pra senzala",
  "lugar de preto",
  "macaco imundo",
  "preto fedido",
  "bicha nojenta",
  "viado nojento",
  "gay nojento",
  "odeio gay",
  "odeio gays",
  "odeio preto",
  "odeio pretos",
  "odeio negro",
  "odeio negros",
  "nordestino burro"
]);
var contains = (text2, phrase) => !!phrase && ` ${text2} `.includes(` ${phrase} `);
var maskWord = (word) => word.length <= 1 ? "*" : `${word[0]}${"*".repeat(word.length - 1)}`;
function isProfane(token) {
  if (token === "cu" || token === "CU") return true;
  const word = canonical(token);
  if (!word) return false;
  if (PROFANITY.has(word)) return true;
  return PROFANITY_PREFIXES.some((prefix) => word.startsWith(prefix) && word.length <= prefix.length + 5);
}
function moderate(input) {
  const text2 = input ?? "";
  const flat = canonical(text2);
  if (!flat) return { action: "allow", text: text2 };
  if (THREATS.some((phrase) => contains(flat, phrase))) return { action: "block", text: text2, category: "ameaca" };
  if (SELF_HARM_INCITEMENT.some((phrase) => contains(flat, phrase))) return { action: "block", text: text2, category: "ameaca" };
  if (HATE.some((phrase) => contains(flat, phrase))) return { action: "block", text: text2, category: "odio" };
  for (const lead of DIRECTED) {
    for (const insult of INSULTS) {
      if (contains(flat, `${lead} ${insult}`)) return { action: "block", text: text2, category: "ofensa" };
    }
  }
  let changed2 = false;
  const masked = text2.replace(/[\p{L}\p{N}@$!]+/gu, (token) => {
    if (!isProfane(token)) return token;
    changed2 = true;
    return maskWord(token);
  });
  return changed2 ? { action: "mask", text: masked, category: "palavrao" } : { action: "allow", text: text2 };
}
var BLOCK_MESSAGE = {
  palavrao: "Sua mensagem tinha palavrões.",
  ofensa: "Sua mensagem não foi enviada porque pode ofender alguém. Que tal escrever de outro jeito? Mensagens bloqueadas ficam visíveis para a coordenação.",
  ameaca: "Sua mensagem não foi enviada porque parece uma ameaça ou incentivo a alguém se machucar. A coordenação foi avisada.",
  odio: "Sua mensagem não foi enviada porque tem discurso de ódio. A coordenação foi avisada."
};

// ../conecta-api/xp.ts
var BADGES = [
  { id: "primeira-revisao", title: "Primeira revisão", description: "Revisou a primeira ficha do Caderno.", icon: "cards", counter: "reviews", goal: 1 },
  { id: "revisor", title: "Revisor de elite", description: "Revisou 100 fichas.", icon: "cards", counter: "reviews", goal: 100 },
  { id: "sequencia-3", title: "Pegando o ritmo", description: "Estudou 3 dias seguidos.", icon: "flame", counter: "bestStreak", goal: 3 },
  { id: "sequencia-7", title: "Semana completa", description: "Estudou 7 dias seguidos.", icon: "flame", counter: "bestStreak", goal: 7 },
  { id: "sequencia-30", title: "Imparável", description: "Estudou 30 dias seguidos.", icon: "flame", counter: "bestStreak", goal: 30 },
  { id: "foco-1h", title: "Primeira hora de foco", description: "Somou 60 minutos no modo foco.", icon: "timer", counter: "focusMinutes", goal: 60 },
  { id: "foco-10h", title: "Maratonista", description: "Somou 10 horas no modo foco.", icon: "timer", counter: "focusMinutes", goal: 600 },
  { id: "simulado-1", title: "Primeiro simulado", description: "Terminou um simulado da Conecta IA.", icon: "target", counter: "quizzes", goal: 1 },
  { id: "simulado-10", title: "Mestre dos simulados", description: "Terminou 10 simulados.", icon: "target", counter: "quizzes", goal: 10 },
  { id: "gabaritou", title: "Gabaritou", description: "Acertou todas as questões de um simulado.", icon: "star", counter: "perfectQuizzes", goal: 1 },
  { id: "redacao-1", title: "Primeira redação", description: "Mandou uma redação para correção.", icon: "pen", counter: "essays", goal: 1 },
  { id: "redacao-900", title: "Redação nota 900", description: "Tirou 900 ou mais numa redação.", icon: "pen", counter: "bestEssay", goal: 900 },
  { id: "tarefas-10", title: "Em dia", description: "Entregou 10 tarefas.", icon: "checklist", counter: "tasks", goal: 10 },
  { id: "plano", title: "Planejado", description: "Completou um plano de estudos.", icon: "calendar", counter: "plansDone", goal: 1 },
  { id: "duelo-1", title: "Duelista", description: "Venceu o primeiro duelo.", icon: "swords", counter: "duelWins", goal: 1 },
  { id: "duelo-10", title: "Lenda dos duelos", description: "Venceu 10 duelos.", icon: "swords", counter: "duelWins", goal: 10 },
  { id: "quiz-podio", title: "No pódio", description: "Ficou entre os 3 primeiros num quiz ao vivo.", icon: "medal", counter: "livePodium", goal: 1 },
  { id: "quiz-campeao", title: "Campeão do quiz", description: "Ganhou um quiz ao vivo.", icon: "trophy", counter: "liveWins", goal: 1 },
  { id: "nivel-5", title: "Nível 5", description: "Chegou ao nível 5.", icon: "sparkles", counter: "level", goal: 5 },
  { id: "nivel-10", title: "Nível 10", description: "Chegou ao nível 10.", icon: "sparkles", counter: "level", goal: 10 }
];
var levelStart = (level) => 50 * level * (level - 1);
function levelFor(total) {
  let level = 1;
  while (levelStart(level + 1) <= total) level++;
  const start = levelStart(level);
  const next = levelStart(level + 1);
  return { level, current: total - start, span: next - start, progress: (total - start) / (next - start) };
}
function weekIdFor(day) {
  const date = /* @__PURE__ */ new Date(`${day}T12:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 864e5 - 3 + (firstThursday.getUTCDay() + 6) % 7) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function emptyRecord(userId) {
  return { userId, total: 0, weekId: weekIdFor(schoolToday()), week: 0, days: {}, counters: {}, subjects: {}, badges: {}, awarded: [], updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
async function readXP(userId) {
  const stored = await get(`xp:${userId}`);
  const record = stored && typeof stored.total === "number" ? { ...emptyRecord(userId), ...stored } : emptyRecord(userId);
  const currentWeek = weekIdFor(schoolToday());
  if (record.weekId !== currentWeek) {
    record.weekId = currentWeek;
    record.week = 0;
  }
  return record;
}
var weekPoints = (record) => record.weekId === weekIdFor(schoolToday()) ? record.week : 0;
async function awardXP(userId, points, options = {}) {
  const record = await readXP(userId);
  if (options.once && record.awarded.includes(options.once)) return null;
  const today = schoolToday();
  const day = { ...record.days[today] ?? { xp: 0 } };
  let gained = Math.max(0, Math.round(points));
  if (options.dailyCap) {
    const capKey = `cap:${options.dailyCap.key}:${today}`;
    const used = record.counters[capKey] ?? 0;
    gained = Math.max(0, Math.min(gained, options.dailyCap.max - used));
    for (const key of Object.keys(record.counters)) if (key.startsWith(`cap:${options.dailyCap.key}:`) && key !== capKey) delete record.counters[key];
    record.counters[capKey] = used + gained;
  }
  record.total += gained;
  record.week += gained;
  day.xp += gained;
  for (const [key, value] of Object.entries(options.stats ?? {})) {
    day[key] = (day[key] ?? 0) + value;
  }
  record.days[today] = day;
  for (const [key, value] of Object.entries(options.counters ?? {})) record.counters[key] = (record.counters[key] ?? 0) + value;
  for (const [key, value] of Object.entries(options.best ?? {})) record.counters[key] = Math.max(record.counters[key] ?? 0, value);
  if (options.subject) {
    const subject = options.subject.trim().slice(0, 40);
    if (subject) record.subjects[subject] = (record.subjects[subject] ?? 0) + (options.subjectPoints ?? gained);
  }
  if (options.once) record.awarded = [...record.awarded, options.once].slice(-800);
  const { level } = levelFor(record.total);
  record.counters.level = level;
  const newBadges = [];
  for (const badge of BADGES) {
    if (record.badges[badge.id]) continue;
    if ((record.counters[badge.counter] ?? 0) >= badge.goal) {
      record.badges[badge.id] = today;
      newBadges.push(badge);
    }
  }
  const oldest = addDays(today, -150);
  for (const key of Object.keys(record.days)) if (key < oldest) delete record.days[key];
  record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  await set(`xp:${userId}`, record);
  return { gained, total: record.total, level, newBadges };
}
function publicXP(record) {
  const level = levelFor(record.total);
  return {
    total: record.total,
    week: weekPoints(record),
    level: level.level,
    levelCurrent: level.current,
    levelSpan: level.span,
    hidden: !!record.hidden,
    badges: BADGES.map((badge) => ({
      ...badge,
      unlockedAt: record.badges[badge.id] ?? null,
      value: Math.min(record.counters[badge.counter] ?? 0, badge.goal)
    }))
  };
}
async function touchStreak(userId, today = schoolToday()) {
  const key = `streak:${userId}`;
  const stored = await get(key);
  let streak = stored ?? { current: 0, best: 0, lastDate: "" };
  if (streak.lastDate !== today) {
    const current = streak.lastDate === addDays(today, -1) ? streak.current + 1 : 1;
    streak = { current, best: Math.max(streak.best, current), lastDate: today };
    await set(key, streak);
  }
  return streak;
}

// ../conecta-api/ai.ts
var AIError = class extends Error {
  status;
  code;
  retryable;
  constructor(message, status, options = {}) {
    super(message);
    this.status = status;
    this.code = options.code;
    this.retryable = options.retryable ?? true;
  }
};
var SAFETY_RULES = [
  "Regras de segurança (sempre valem): você é uma inteligência artificial e deixa isso claro se perguntarem.",
  "Quem usa é estudante, muitas vezes menor de idade: use linguagem adequada para a idade.",
  "Recuse com gentileza conteúdo sexual, violência explícita, drogas, armas, apostas, ódio ou bullying, e não ajude a colar em provas durante a prova.",
  "Se a pessoa contar que está sofrendo, pensando em se machucar ou passando por violência, acolha com carinho, sugira conversar com um adulto de confiança ou com a coordenação e informe o CVV (ligue 188, 24 horas, grátis).",
  "Não peça nem guarde dados pessoais (endereço, telefone, documentos, senhas)."
].join(" ");
function providers() {
  const list = [];
  if (Deno.env.get("ANTHROPIC_API_KEY")) list.push({ id: "anthropic", vision: true, firstByteMs: 3e4 });
  if (Deno.env.get("POLLINATIONS_API_KEY")) list.push({ id: "pollinations", vision: true, firstByteMs: 4e4 });
  list.push({ id: "free", vision: false, firstByteMs: 6e4 });
  return list;
}
function aiCapabilities() {
  const list = providers();
  return { provider: list[0].id, vision: list.some((provider) => provider.vision) };
}
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function withTimeout(promise, ms, onTimeout) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          onTimeout();
          reject(new AIError("A IA grátis está com muita gente agora e demorou para responder. Tente de novo em instantes.", 504, { code: "timeout" }));
        }, ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function normalized(messages) {
  const out = [];
  for (const message of messages) {
    const last = out[out.length - 1];
    if (last && last.role === message.role) {
      last.content = `${last.content}

${message.content}`;
      if (message.images?.length) last.images = [...last.images ?? [], ...message.images];
    } else out.push({ role: message.role, content: message.content, images: message.images ? [...message.images] : void 0 });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}
function requestFor(provider, system, messages, options) {
  const maxTokens = options.maxTokens ?? 900;
  if (provider.id === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      init: {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": Deno.env.get("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: Deno.env.get("ANTHROPIC_MODEL") || "claude-haiku-4-5-20251001",
          max_tokens: maxTokens,
          temperature: options.temperature ?? 0.4,
          stream: true,
          system,
          messages: messages.map((message) => ({
            role: message.role,
            content: message.images?.length ? [
              ...message.images.map((image) => ({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } })),
              { type: "text", text: message.content || "Veja a imagem." }
            ] : message.content
          }))
        })
      }
    };
  }
  const keyed = provider.id === "pollinations";
  const url = keyed ? "https://gen.pollinations.ai/v1/chat/completions" : Deno.env.get("CONECTA_AI_URL") || "https://text.pollinations.ai/openai";
  return {
    url,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", ...keyed ? { Authorization: `Bearer ${Deno.env.get("POLLINATIONS_API_KEY")}` } : {} },
      body: JSON.stringify({
        model: keyed ? Deno.env.get("POLLINATIONS_MODEL") || "openai/gpt-5.4-nano" : "openai",
        stream: true,
        temperature: options.temperature ?? 0.4,
        // o modelo grátis "pensa" antes de responder: esforço baixo deixa a resposta bem mais rápida
        ...keyed ? { max_tokens: maxTokens } : { max_tokens: maxTokens + 600, reasoning_effort: "low" },
        messages: [
          { role: "system", content: system },
          ...messages.map((message) => ({
            role: message.role,
            content: message.images?.length && provider.vision ? [
              { type: "text", text: message.content || "Veja a imagem." },
              ...message.images.map((image) => ({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.data}` } }))
            ] : message.content
          }))
        ]
      })
    }
  };
}
function httpError(provider, status) {
  if (status === 429) {
    return new AIError("Muitas perguntas na IA ao mesmo tempo. Espere alguns segundos e tente de novo.", 429, { code: "busy" });
  }
  if ((status === 401 || status === 403 || status === 402) && provider.id !== "free") {
    return new AIError("O provedor da IA recusou a chave configurada no Supabase.", 502, { code: "key" });
  }
  if (status === 400 || status === 413 || status === 422) {
    return new AIError("A IA não aceitou esta pergunta. Tente escrever de outro jeito ou enviar uma foto menor.", 400, { code: "rejected", retryable: false });
  }
  return new AIError("A IA está instável agora. Tente de novo em instantes.", 502, { code: "upstream" });
}
async function* readEvents(body, idleMs) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (; ; ) {
      const { done, value } = await withTimeout(reader.read(), idleMs, () => void reader.cancel().catch(() => {
      }));
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let index;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        let event = "message";
        const data = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
        }
        if (data.length) yield { event, data: data.join("\n") };
      }
    }
    if (buffer.trim().startsWith("data:")) yield { event: "message", data: buffer.trim().slice(5).trim() };
  } finally {
    reader.releaseLock();
  }
}
async function* runProvider(provider, system, messages, options, deadline) {
  const { url, init } = requestFor(provider, system, messages, options);
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const firstByte = Math.max(5e3, Math.min(provider.firstByteMs, deadline - Date.now()));
    let response;
    try {
      response = await withTimeout(fetch(url, { ...init, signal: controller.signal }), firstByte, abort);
    } catch (error) {
      if (error instanceof AIError) throw error;
      if (options.signal?.aborted) throw new AIError("Pergunta cancelada.", 499, { code: "cancelled", retryable: false });
      throw new AIError("Não foi possível conectar à IA. Tente de novo.", 502, { code: "network" });
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {
      });
      throw httpError(provider, response.status);
    }
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("event-stream")) {
      const result = await response.json().catch(() => ({}));
      const text2 = provider.id === "anthropic" ? (result.content ?? []).filter((block) => block.type === "text").map((block) => block.text).join("\n") : result.choices?.[0]?.message?.content;
      if (typeof text2 === "string" && text2.trim()) yield { type: "delta", text: text2 };
      return;
    }
    let thinking = false;
    const idle = Math.max(5e3, Math.min(45e3, deadline - Date.now()));
    for await (const { data } of readEvents(response.body, idle)) {
      if (data === "[DONE]") break;
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (provider.id === "anthropic") {
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta" && parsed.delta.text) yield { type: "delta", text: parsed.delta.text };
        else if (parsed.type === "error") throw new AIError("A IA está instável agora. Tente de novo em instantes.", 502, { code: "upstream" });
        continue;
      }
      const delta = parsed.choices?.[0]?.delta ?? {};
      if (typeof delta.content === "string" && delta.content) yield { type: "delta", text: delta.content };
      else if (!thinking && (delta.reasoning || delta.reasoning_content)) {
        thinking = true;
        yield { type: "status", stage: "thinking" };
      }
      if (parsed.error) throw new AIError("A IA está instável agora. Tente de novo em instantes.", 502, { code: "upstream" });
    }
  } finally {
    options.signal?.removeEventListener("abort", abort);
  }
}
async function* streamAI(system, input, options = {}) {
  const messages = normalized(input);
  if (!messages.length) throw new AIError("Envie uma pergunta para a Conecta IA.", 400, { retryable: false });
  const needVision = messages.some((message) => message.images?.length);
  let chain = providers();
  if (needVision) {
    chain = chain.filter((provider) => provider.vision);
    if (!chain.length) throw new AIError("A IA configurada não lê imagens.", 422, { code: "vision-unavailable", retryable: false });
  }
  const fullSystem = `${system}

${SAFETY_RULES}`;
  const deadline = Date.now() + (options.totalMs ?? 118e3);
  let lastError = null;
  for (const provider of chain) {
    const attempts = provider.id === "free" ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (deadline - Date.now() < 1e4 || options.signal?.aborted) break;
      let wrote = false;
      try {
        yield { type: "provider", provider: provider.id, vision: provider.vision };
        for await (const event of runProvider(provider, fullSystem, messages, options, deadline)) {
          if (event.type === "delta") wrote = true;
          yield event;
        }
        if (!wrote) throw new AIError("A IA não retornou uma resposta. Tente de novo.", 502, { code: "empty" });
        return;
      } catch (error) {
        if (wrote) throw error instanceof AIError ? error : new AIError("A resposta da IA foi interrompida. Tente de novo.", 502, { code: "interrupted" });
        lastError = error;
        if (error instanceof AIError && !error.retryable) throw error;
        if (attempt + 1 < attempts) await sleep(1200);
      }
    }
  }
  if (lastError instanceof AIError) throw lastError;
  throw new AIError("Não foi possível falar com a IA agora. Tente de novo em instantes.", 502, { code: "unavailable" });
}
async function completeAI(system, messages, options = {}) {
  let text2 = "";
  let provider = "free";
  for await (const event of streamAI(system, messages, options)) {
    if (event.type === "delta") text2 += event.text;
    else if (event.type === "provider") {
      provider = event.provider;
      text2 = "";
    }
  }
  if (!text2.trim()) throw new AIError("A IA não retornou uma resposta. Tente de novo.", 502, { code: "empty" });
  return { text: text2.trim(), provider };
}
function extractJson(raw) {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    try {
      return JSON.parse(cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}
function imagesFrom(value) {
  if (value === void 0 || value === null) return [];
  if (!Array.isArray(value) || value.length > 3) return null;
  const images = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length > 21e5) return null;
    const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/]+=*)$/i.exec(item);
    if (!match) return null;
    images.push({ mediaType: match[1].toLowerCase(), data: match[2] });
  }
  return images;
}
function sseResponse(run, onDone) {
  const encoder = new TextEncoder();
  const controller = new AbortController();
  let closed = false;
  const stream = new ReadableStream({
    async start(output) {
      const send = (chunk) => {
        if (closed) return;
        try {
          output.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const event = (name, data) => send(`event: ${name}
data: ${JSON.stringify(data)}

`);
      const ping = setInterval(() => send(": ping\n\n"), 8e3);
      let text2 = "";
      try {
        send(": conectado\n\n");
        for await (const item of run(controller.signal)) {
          if (item.type === "delta") {
            text2 += item.text;
            event("delta", { t: item.text });
          } else if (item.type === "status") event("status", { stage: item.stage });
          else {
            text2 = "";
            event("meta", { provider: item.provider, vision: item.vision });
          }
        }
        await onDone?.(text2);
        event("done", {});
      } catch (error) {
        event("error", {
          message: error instanceof Error ? error.message : "Não foi possível falar com a IA.",
          code: error instanceof AIError ? error.code : void 0
        });
      } finally {
        clearInterval(ping);
        closed = true;
        try {
          output.close();
        } catch {
        }
      }
    },
    cancel() {
      closed = true;
      controller.abort();
    }
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" }
  });
}

// ../conecta-api/study.ts
var aiFailure = (c, error) => {
  const status = error instanceof AIError ? error.status : 502;
  return c.json(
    { error: error instanceof Error ? error.message : "Não foi possível falar com a IA.", code: error instanceof AIError ? error.code : void 0 },
    status >= 400 && status < 600 ? status : 502
  );
};
var str = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
var firstName = (profile) => profile.name.split(" ")[0];
async function tutorPrompt(userId, profile) {
  const [events, subjects] = await Promise.all([
    getByPrefix("calendar-event:"),
    getByPrefix(`study-subject:${userId}:`)
  ]);
  const currentDate = (/* @__PURE__ */ new Date()).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full" });
  const lines = calendarLines(events);
  const calendar = lines.length ? `Calendário escolar (eventos recentes e próximos, fonte oficial):
${lines.join("\n")}
Use estes dados para responder sobre provas e assuntos da escola. Diferencie eventos passados e futuros e não invente eventos ausentes.` : "O calendário escolar não tem provas ou eventos cadastrados no momento. Se perguntarem sobre datas da escola, diga que ainda não há informação no calendário.";
  const notebook = subjects.slice(0, 20).map((subject) => `- ${subject.name}: ${subject.topics.slice(0, 12).map((topic) => topic.title).join("; ") || "sem assuntos anotados"}`).join("\n");
  const notebookGuidance = notebook ? `Caderno pessoal de ${firstName(profile)} (matérias e assuntos que a pessoa anotou):
${notebook}
Quando pedirem ajuda para estudar ou para "a prova", ligue a resposta aos assuntos do calendário e do caderno.` : "";
  const role = isStaff(profile) ? `Quem pergunta é ${firstName(profile)}, da equipe da escola: ajude também a preparar aulas, listas, simulados e revisões.` : `Quem pergunta é ${firstName(profile)}, estudante: explique passo a passo e incentive o raciocínio em vez de só dar a resposta.`;
  const web = aiCapabilities().provider === "anthropic" ? "" : "Você não tem acesso à internet: avise quando não puder verificar fatos atuais.";
  return [
    `Você é a Conecta IA, a tutora de estudos do Conecta, a plataforma da escola. Hoje é ${currentDate}.`,
    "Responda em português do Brasil, com clareza, em parágrafos curtos e Markdown simples (listas, **negrito**, tabelas pequenas). Escreva contas com caracteres comuns (x², √, ≤, ÷), sem LaTeX.",
    role,
    calendar,
    notebookGuidance,
    web
  ].filter(Boolean).join("\n\n");
}
function chatMessages(value, images) {
  if (!Array.isArray(value)) return null;
  const list = value.filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string").slice(-16).map((message) => ({ role: message.role, content: message.content.slice(0, 6e3) }));
  if (!list.length || list[list.length - 1].role !== "user") return null;
  if (images?.length) list[list.length - 1].images = images;
  return list;
}
function parseQuiz(raw) {
  const data = extractJson(raw);
  const list = Array.isArray(data?.questions) ? data.questions : [];
  return list.map((item) => ({
    question: typeof item?.question === "string" ? item.question.trim().slice(0, 500) : "",
    options: Array.isArray(item?.options) ? item.options.filter((option) => typeof option === "string").map((option) => option.trim().slice(0, 240)) : [],
    answer: Number.isInteger(item?.answer) ? item.answer : Number.isInteger(Number(item?.answer)) ? Number(item.answer) : -1,
    explanation: typeof item?.explanation === "string" ? item.explanation.trim().slice(0, 600) : ""
  })).filter((item) => item.question && item.options.length >= 2 && item.options.length <= 5 && item.answer >= 0 && item.answer < item.options.length);
}
var QUIZ_SYSTEM = 'Você cria simulados escolares em português para o ensino médio brasileiro. Responda SOMENTE com JSON válido, sem texto antes ou depois, no formato {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}. "answer" é o índice (0 a 3) da alternativa correta. Cada questão tem exatamente 4 alternativas plausíveis e uma explicação curta de por que a correta está certa. Varie a posição da resposta correta. Não use LaTeX: escreva fórmulas com caracteres comuns (x², √, ≤).';
async function generateQuiz(subject, topic, count) {
  const prompt = `Crie ${count} questões de múltipla escolha sobre ${topic || subject}${topic && subject ? ` (${subject})` : ""}. Misture questões de conceito e de aplicação, do fácil ao médio.`;
  let questions = [];
  for (let attempt = 0; attempt < 2 && questions.length < Math.min(3, count); attempt++) {
    const result = await completeAI(QUIZ_SYSTEM, [{ role: "user", content: prompt }], { maxTokens: Math.min(3200, 400 + count * 280), temperature: 0.5 });
    questions = parseQuiz(result.text);
  }
  if (!questions.length) throw new AIError("A IA não conseguiu montar as questões agora. Tente de novo.", 502, { code: "format" });
  return questions.slice(0, count);
}
var COMPETENCIES = [
  "Domínio da escrita formal da língua portuguesa",
  "Compreensão da proposta e desenvolvimento do tema",
  "Seleção e organização das informações e argumentos",
  "Coesão: uso dos mecanismos linguísticos",
  "Proposta de intervenção para o problema"
];
var ESSAY_SYSTEM = `Você é uma corretora experiente de redações do ENEM e ajuda estudantes do ensino médio a melhorar.
Avalie a redação dissertativo-argumentativa pelas 5 competências oficiais:
C1 ${COMPETENCIES[0]}; C2 ${COMPETENCIES[1]} (tipo dissertativo-argumentativo, repertório); C3 ${COMPETENCIES[2]} em defesa de um ponto de vista; C4 ${COMPETENCIES[3]}; C5 ${COMPETENCIES[4]}, respeitando os direitos humanos (agente, ação, meio/modo, finalidade e detalhamento).
Cada competência vale 0, 40, 80, 120, 160 ou 200. Seja justa e realista, como a banca: só dê 200 quando não houver falhas; textos curtos, fora do tema ou sem proposta de intervenção perdem bastante.
Responda SOMENTE com JSON válido, sem nada antes ou depois, no formato:
{"transcription":"texto da redação transcrito (só quando ela vier em foto)","competencies":[{"score":120,"feedback":"comentário curto e específico, citando trechos"}],"summary":"visão geral em 2 frases","strengths":["ponto forte"],"improvements":["o que fazer para subir a nota"],"intervention":{"agente":true,"acao":true,"meio":false,"finalidade":true,"detalhamento":false}}
A lista "competencies" tem exatamente 5 itens, na ordem C1 a C5. Escreva em português do Brasil, com tom encorajador.`;
var snap = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(200, Math.round(number / 40) * 40));
};
var strings = (value, max, size) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim().slice(0, size)).slice(0, max) : [];
function parseEssay(raw) {
  const data = extractJson(raw);
  if (!data || !Array.isArray(data.competencies) || data.competencies.length < 5) return null;
  const competencies = data.competencies.slice(0, 5).map((item, index) => ({
    title: COMPETENCIES[index],
    score: snap(item?.score),
    feedback: str(item?.feedback, 700)
  }));
  const intervention = {};
  for (const key of ["agente", "acao", "meio", "finalidade", "detalhamento"]) intervention[key] = data.intervention?.[key] === true;
  return {
    transcription: str(data.transcription, 6e3),
    total: competencies.reduce((sum, item) => sum + item.score, 0),
    competencies,
    summary: str(data.summary, 500),
    strengths: strings(data.strengths, 5, 240),
    improvements: strings(data.improvements, 6, 260),
    intervention
  };
}
var NOTES_SYSTEM = `Você transforma o conteúdo do quadro ou do caderno de uma aula em material de estudo para o ensino médio.
Responda SOMENTE com JSON válido, sem nada antes ou depois, no formato:
{"title":"título curto do assunto","subject":"matéria provável","summary":"resumo em Markdown com tópicos curtos e as fórmulas/definições importantes","flashcards":[{"question":"pergunta objetiva","answer":"resposta curta"}]}
Crie de 4 a 10 fichas. Não invente o que não estiver no conteúdo; se algo estiver ilegível, diga isso no resumo. Não use LaTeX.`;
function parseNotes(raw) {
  const data = extractJson(raw);
  if (!data) return null;
  const flashcards = Array.isArray(data.flashcards) ? data.flashcards.map((item) => ({ question: str(item?.question, 500), answer: str(item?.answer, 1e3) })).filter((item) => item.question && item.answer).slice(0, 12) : [];
  const summary = str(data.summary, 4e3);
  if (!summary && !flashcards.length) return null;
  return { title: str(data.title, 100) || "Resumo da aula", subject: str(data.subject, 60), summary, flashcards };
}
var TEST_SYSTEM = `Você lê provas escolares corrigidas e monta a lista de questões com o resultado de cada uma.
Responda SOMENTE com JSON válido, sem nada antes ou depois, no formato:
{"maxScore":10,"questions":[{"label":"1","value":1,"status":"right","items":[]},{"label":"2","value":2,"items":[{"label":"a","value":1,"status":"wrong"},{"label":"b","value":1,"status":"half"}]}]}
- status: "right" (marcada como certa: ✓, C, certo), "wrong" (errada: ✗, X, E, errado), "half" (meio certo), "blank" (em branco) ou "unknown" (não dá para saber).
- Se a questão tiver itens (a, b, c…), coloque cada item em "items" e não preencha o status da questão.
- "value" é quanto a questão ou item vale, se aparecer na prova; senão use null. "maxScore" é a nota máxima da prova, se aparecer; senão null.
- Não invente questões que não aparecem.`;
var STATUSES = /* @__PURE__ */ new Set(["right", "wrong", "half", "blank", "unknown"]);
var scoreValue = (value) => {
  const number = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1e3 ? Math.round(number * 100) / 100 : null;
};
function parseTest(raw) {
  const data = extractJson(raw);
  if (!data || !Array.isArray(data.questions)) return null;
  const item = (entry, index) => ({
    label: str(entry?.label, 6) || String(index + 1),
    value: entry?.value === null || entry?.value === void 0 ? null : scoreValue(entry.value),
    status: STATUSES.has(entry?.status) ? entry.status : "unknown"
  });
  const questions = data.questions.slice(0, 60).map((entry, index) => ({
    ...item(entry, index),
    items: Array.isArray(entry?.items) ? entry.items.slice(0, 10).map((sub, subIndex) => item(sub, subIndex)).map((sub, subIndex) => ({ ...sub, label: sub.label || String.fromCharCode(97 + subIndex) })) : []
  }));
  if (!questions.length) return null;
  return { maxScore: data.maxScore === null || data.maxScore === void 0 ? null : scoreValue(data.maxScore), questions };
}
var PLAN_SYSTEM = `Você monta planos de estudo para provas escolares do ensino médio brasileiro.
Responda SOMENTE com JSON válido, sem nada antes ou depois, no formato:
{"days":[{"date":"AAAA-MM-DD","title":"foco do dia","items":[{"text":"atividade concreta","minutes":20}]}]}
Use exatamente as datas informadas, na mesma ordem. Cada dia tem de 2 a 4 atividades concretas (ler e resumir um tópico, fazer exercícios, revisar fichas, explicar em voz alta, simulado curto) que somam o tempo diário informado. Divida o conteúdo do mais básico ao mais difícil. O último dia é revisão geral com simulado curto. Não use LaTeX.`;
function planDates(today, examDate) {
  const days = [];
  for (let day = today; day < examDate && days.length < 60; day = addDays(day, 1)) days.push(day);
  if (!days.length) return [today];
  if (days.length <= 14) return days;
  const picked = /* @__PURE__ */ new Set();
  for (let index = 0; index < 14; index++) picked.add(days[Math.round(index * (days.length - 1) / 13)]);
  return [...picked];
}
function registerStudy(api2) {
  api2.get("/ai/capabilities", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    return c.json(aiCapabilities());
  });
  api2.post("/ai", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para conversar com a Conecta IA." }, 401);
    if (!withinRateLimit(`ai:${user.id}`, 12, 60 * 1e3)) return c.json({ error: "Muitas perguntas em pouco tempo. Aguarde um minuto para continuar." }, 429);
    {
      const blocked = await aiBlockedFor(await profileFor(user));
      if (blocked) return c.json({ error: blocked, code: "consent" }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const messages = chatMessages(body.messages, []);
    if (!messages) return c.json({ error: "Envie uma pergunta para a Conecta IA." }, 400);
    try {
      const result = await completeAI(await tutorPrompt(user.id, await profileFor(user)), messages, { maxTokens: 900 });
      return c.json({ text: result.text });
    } catch (error) {
      return aiFailure(c, error);
    }
  });
  api2.post("/ai/stream", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para conversar com a Conecta IA." }, 401);
    if (!withinRateLimit(`ai:${user.id}`, 12, 60 * 1e3)) return c.json({ error: "Muitas perguntas em pouco tempo. Aguarde um minuto para continuar." }, 429);
    {
      const blocked = await aiBlockedFor(await profileFor(user));
      if (blocked) return c.json({ error: blocked, code: "consent" }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const images = imagesFrom(body.images);
    if (images === null) return c.json({ error: "Envie até 3 fotos de até 1,5 MB cada." }, 400);
    if (images.length && !aiCapabilities().vision) return c.json({ error: "A IA configurada não lê imagens.", code: "vision-unavailable" }, 422);
    const messages = chatMessages(body.messages, images);
    if (!messages) return c.json({ error: "Envie uma pergunta para a Conecta IA." }, 400);
    const system = await tutorPrompt(user.id, await profileFor(user));
    return sseResponse((signal) => streamAI(system, messages, { maxTokens: 900, signal }));
  });
  api2.post("/ai/quiz", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para fazer um simulado." }, 401);
    if (!withinRateLimit(`quiz:${user.id}`, 5, 60 * 1e3)) return c.json({ error: "Muitos simulados em pouco tempo. Aguarde um minuto." }, 429);
    {
      const blocked = await aiBlockedFor(await profileFor(user));
      if (blocked) return c.json({ error: blocked, code: "consent" }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const subject = str(body.subject, 60);
    const topic = str(body.topic, 160);
    const count = Number.isInteger(body.count) ? Math.min(10, Math.max(3, body.count)) : 5;
    if (!subject && !topic) return c.json({ error: "Diga a matéria ou o assunto do simulado." }, 400);
    try {
      return c.json({ subject, topic, questions: await generateQuiz(subject, topic, count) });
    } catch (error) {
      return aiFailure(c, error);
    }
  });
  api2.post("/xp/quiz", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    if (!withinRateLimit(`xp-quiz:${user.id}`, 6, 60 * 60 * 1e3)) return c.json({ ok: true, xp: null });
    const body = await c.req.json().catch(() => ({}));
    const total = Number.isInteger(body.total) ? body.total : 0;
    const correct = Number.isInteger(body.correct) ? body.correct : -1;
    if (total < 3 || total > 10 || correct < 0 || correct > total) return c.json({ error: "Resultado inválido." }, 400);
    const xp = await awardXP(user.id, Math.min(25, 5 + correct * 2), {
      counters: { quizzes: 1, ...correct === total ? { perfectQuizzes: 1 } : {} },
      stats: { quizzes: 1, correct },
      subject: str(body.subject, 40) || void 0,
      subjectPoints: correct
    });
    return c.json({ ok: true, xp });
  });
  api2.post("/ai/essay", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para corrigir sua redação." }, 401);
    if (!withinRateLimit(`essay:${user.id}`, 6, 60 * 60 * 1e3)) return c.json({ error: "Você já mandou muitas redações nesta hora. Tente mais tarde." }, 429);
    {
      const blocked = await aiBlockedFor(await profileFor(user));
      if (blocked) return c.json({ error: blocked, code: "consent" }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const theme = str(body.theme, 200);
    const text2 = str(body.text, 6e3);
    const images = imagesFrom(body.images);
    if (images === null) return c.json({ error: "Envie até 3 fotos de até 1,5 MB cada." }, 400);
    if (images.length && !aiCapabilities().vision) return c.json({ error: "A IA configurada não lê imagens.", code: "vision-unavailable" }, 422);
    const words = text2.split(/\s+/).filter(Boolean).length;
    if (!images.length && words < 60) return c.json({ error: "A redação precisa ter pelo menos uns 7 parágrafos curtos ou 60 palavras para ser corrigida." }, 400);
    const prompt = `${theme ? `Tema da redação: ${theme}

` : "Tema não informado: avalie se o texto tem um tema claro.\n\n"}${text2 ? `Redação:
"""
${text2}
"""` : 'A redação está nas fotos. Transcreva o texto em "transcription" e avalie.'}`;
    try {
      let parsed = null;
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        const result = await completeAI(ESSAY_SYSTEM, [{ role: "user", content: prompt, images }], { maxTokens: 1800, temperature: 0.2 });
        parsed = parseEssay(result.text);
      }
      if (!parsed) return c.json({ error: "A IA não conseguiu corrigir agora. Tente de novo." }, 502);
      const essay = {
        id: crypto.randomUUID(),
        theme,
        text: (text2 || parsed.transcription).slice(0, 6e3),
        result: { ...parsed, transcription: void 0 },
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await set(`essay:${user.id}:${essay.id}`, essay);
      const xp = await awardXP(user.id, 20, { counters: { essays: 1 }, best: { bestEssay: parsed.total }, stats: { essays: 1 }, subject: "Redação" });
      return c.json({ ...essay, transcription: parsed.transcription, xp });
    } catch (error) {
      return aiFailure(c, error);
    }
  });
  api2.get("/essays", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const items = await getByPrefix(`essay:${user.id}:`);
    return c.json(items.sort((first, second) => second.createdAt.localeCompare(first.createdAt)).slice(0, 30).map((item) => ({ id: item.id, theme: item.theme, total: item.result?.total ?? 0, createdAt: item.createdAt, preview: item.text.slice(0, 140) })));
  });
  api2.get("/essays/:id", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const id = c.req.param("id");
    const essay = validId(id) ? await get(`essay:${user.id}:${id}`) : null;
    return essay ? c.json(essay) : c.json({ error: "Redação não encontrada." }, 404);
  });
  api2.delete("/essays/:id", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const id = c.req.param("id");
    if (!validId(id)) return c.json({ error: "Redação inválida." }, 400);
    await del(`essay:${user.id}:${id}`);
    return c.json({ ok: true });
  });
  api2.post("/ai/notes", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para criar resumos." }, 401);
    if (!withinRateLimit(`notes:${user.id}`, 10, 60 * 60 * 1e3)) return c.json({ error: "Muitos resumos nesta hora. Tente mais tarde." }, 429);
    {
      const blocked = await aiBlockedFor(await profileFor(user));
      if (blocked) return c.json({ error: blocked, code: "consent" }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const text2 = str(body.text, 8e3);
    const subject = str(body.subject, 60);
    const images = imagesFrom(body.images);
    if (images === null) return c.json({ error: "Envie até 3 fotos de até 1,5 MB cada." }, 400);
    if (images.length && !aiCapabilities().vision) return c.json({ error: "A IA configurada não lê imagens.", code: "vision-unavailable" }, 422);
    if (!images.length && text2.length < 20) return c.json({ error: "Não encontrei texto suficiente. Tire a foto mais de perto e com boa luz." }, 400);
    const prompt = `${subject ? `Matéria: ${subject}

` : ""}${text2 ? `Conteúdo da aula (texto lido da foto, pode ter erros de leitura):
"""
${text2}
"""` : "O conteúdo está nas fotos."}`;
    try {
      let parsed = null;
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        const result = await completeAI(NOTES_SYSTEM, [{ role: "user", content: prompt, images }], { maxTokens: 2e3, temperature: 0.3 });
        parsed = parseNotes(result.text);
      }
      return parsed ? c.json(parsed) : c.json({ error: "A IA não conseguiu montar o resumo agora. Tente de novo." }, 502);
    } catch (error) {
      return aiFailure(c, error);
    }
  });
  api2.post("/study-subjects/:id/cards/batch", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para criar fichas." }, 401);
    const id = c.req.param("id");
    if (!validId(id)) return c.json({ error: "Matéria inválida." }, 400);
    const key = `study-subject:${user.id}:${id}`;
    const subject = await get(key);
    if (!subject) return c.json({ error: "Matéria não encontrada." }, 404);
    const body = await c.req.json().catch(() => ({}));
    const cards = Array.isArray(body.cards) ? body.cards.map((card) => ({ question: str(card?.question, 500), answer: str(card?.answer, 1e3) })).filter((card) => card.question && card.answer) : [];
    if (!cards.length) return c.json({ error: "Nenhuma ficha válida." }, 400);
    const room = 100 - subject.flashcards.length;
    if (room <= 0) return c.json({ error: "Esta matéria já atingiu o limite de fichas." }, 400);
    subject.flashcards.push(...cards.slice(0, room).map((card) => ({ id: crypto.randomUUID(), ...card })));
    await set(key, subject);
    return c.json({ subject, added: Math.min(room, cards.length) });
  });
  api2.post("/ai/test-reader", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para ler a prova." }, 401);
    if (!withinRateLimit(`test-reader:${user.id}`, 12, 60 * 60 * 1e3)) return c.json({ error: "Muitas leituras nesta hora. Tente mais tarde." }, 429);
    {
      const blocked = await aiBlockedFor(await profileFor(user));
      if (blocked) return c.json({ error: blocked, code: "consent" }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const text2 = str(body.text, 6e3);
    const images = imagesFrom(body.images);
    if (images === null) return c.json({ error: "Envie até 3 fotos de até 1,5 MB cada." }, 400);
    if (images.length && !aiCapabilities().vision) return c.json({ error: "A IA configurada não lê imagens.", code: "vision-unavailable" }, 422);
    if (!images.length && text2.length < 10) return c.json({ error: "Não encontrei texto na foto. Tente com mais luz e mais de perto." }, 400);
    const prompt = text2 ? `Texto lido da foto da prova (pode ter erros de leitura e normalmente não mostra as marcas de certo e errado):
"""
${text2}
"""
Monte a lista de questões e itens com os valores. Use "unknown" quando não houver marca.` : "A prova corrigida está nas fotos.";
    try {
      let parsed = null;
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        const result = await completeAI(TEST_SYSTEM, [{ role: "user", content: prompt, images }], { maxTokens: 1500, temperature: 0.1 });
        parsed = parseTest(result.text);
      }
      return parsed ? c.json(parsed) : c.json({ error: "Não consegui entender a prova. Confira a foto ou preencha à mão." }, 502);
    } catch (error) {
      return aiFailure(c, error);
    }
  });
  api2.get("/study-plans", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const plans = await getByPrefix(`study-plan:${user.id}:`);
    return c.json(plans.sort((first, second) => first.examDate.localeCompare(second.examDate)));
  });
  api2.post("/study-plans", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para montar um plano." }, 401);
    if (!withinRateLimit(`plan:${user.id}`, 6, 60 * 60 * 1e3)) return c.json({ error: "Muitos planos nesta hora. Tente mais tarde." }, 429);
    {
      const blocked = await aiBlockedFor(await profileFor(user));
      if (blocked) return c.json({ error: blocked, code: "consent" }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const today = schoolToday();
    let subject = str(body.subject, 60);
    let topic = str(body.topic, 180);
    let examDate = validDay(body.examDate) ? body.examDate : "";
    let examId = null;
    if (typeof body.examId === "string" && validId(body.examId)) {
      const event = await get(`calendar-event:${body.examId}`);
      if (!event) return c.json({ error: "Prova não encontrada na agenda." }, 404);
      examId = event.id;
      subject = event.subject;
      topic = event.topic;
      examDate = event.date;
    }
    if (!subject || !topic || !examDate) return c.json({ error: "Informe a matéria, o assunto e a data da prova." }, 400);
    if (examDate < today) return c.json({ error: "Essa prova já passou." }, 400);
    const minutesPerDay = Number.isInteger(body.minutesPerDay) ? Math.min(240, Math.max(15, body.minutesPerDay)) : 45;
    const notes = str(body.notes, 300);
    const dates = planDates(today, examDate);
    const prompt = [
      `Prova de ${subject}: ${topic}. Data da prova: ${examDate}.`,
      `Tempo por dia: cerca de ${minutesPerDay} minutos.`,
      notes ? `Observação da pessoa: ${notes}` : "",
      `Datas das sessões (use exatamente estas, ${dates.length} no total): ${dates.join(", ")}.`
    ].filter(Boolean).join("\n");
    try {
      let days = [];
      for (let attempt = 0; attempt < 2 && !days.length; attempt++) {
        const result = await completeAI(PLAN_SYSTEM, [{ role: "user", content: prompt }], { maxTokens: Math.min(3e3, 300 + dates.length * 160), temperature: 0.4 });
        const data = extractJson(result.text);
        const returned = Array.isArray(data?.days) ? data.days : [];
        if (!returned.length) continue;
        days = dates.map((date, index) => {
          const source = returned.find((day) => day?.date === date) ?? returned[index] ?? null;
          const items = Array.isArray(source?.items) ? source.items.map((item) => ({ id: crypto.randomUUID(), text: str(item?.text, 200), minutes: Math.min(120, Math.max(5, Math.round(Number(item?.minutes) || 15))), done: false })).filter((item) => item.text).slice(0, 5) : [];
          return {
            date,
            title: str(source?.title, 80) || (index === dates.length - 1 ? "Revisão geral" : `Estudo de ${topic}`),
            items: items.length ? items : [{ id: crypto.randomUUID(), text: `Revisar ${topic} e fazer exercícios`, minutes: minutesPerDay, done: false }]
          };
        });
      }
      if (!days.length) return c.json({ error: "A IA não conseguiu montar o plano agora. Tente de novo." }, 502);
      const plan = { id: crypto.randomUUID(), examId, subject, topic, examDate, minutesPerDay, days, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
      if (examId) {
        const existing = (await getByPrefix(`study-plan:${user.id}:`)).filter((item) => item.examId === examId);
        for (const item of existing) await del(`study-plan:${user.id}:${item.id}`);
      }
      await set(`study-plan:${user.id}:${plan.id}`, plan);
      return c.json(plan, 201);
    } catch (error) {
      return aiFailure(c, error);
    }
  });
  api2.patch("/study-plans/:id/items/:itemId", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const id = c.req.param("id");
    const itemId = c.req.param("itemId");
    if (!validId(id) || !validId(itemId)) return c.json({ error: "Item inválido." }, 400);
    const key = `study-plan:${user.id}:${id}`;
    const plan = await get(key);
    const item = plan?.days.flatMap((day) => day.items).find((entry) => entry.id === itemId);
    if (!plan || !item) return c.json({ error: "Item não encontrado." }, 404);
    const body = await c.req.json().catch(() => ({}));
    item.done = body.done !== false;
    const all = plan.days.flatMap((day) => day.items);
    const finished = all.every((entry) => entry.done);
    const firstCompletion = finished && !plan.completedAt;
    if (firstCompletion) plan.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    await set(key, plan);
    let xp = null;
    if (item.done) {
      xp = await awardXP(user.id, 5, { once: `plan:${itemId}`, stats: { plan: 1 }, subject: plan.subject, subjectPoints: 1 });
      if (firstCompletion) xp = await awardXP(user.id, 30, { once: `plan-done:${plan.id}`, counters: { plansDone: 1 } }) ?? xp;
    }
    return c.json({ plan, xp });
  });
  api2.delete("/study-plans/:id", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const id = c.req.param("id");
    if (!validId(id)) return c.json({ error: "Plano inválido." }, 400);
    await del(`study-plan:${user.id}:${id}`);
    return c.json({ ok: true });
  });
  api2.post("/focus/sessions", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para registrar o tempo de foco." }, 401);
    if (!withinRateLimit(`focus:${user.id}`, 20, 60 * 60 * 1e3)) return c.json({ error: "Muitas sessões em pouco tempo." }, 429);
    const body = await c.req.json().catch(() => ({}));
    const minutes = Number.isInteger(body.minutes) ? body.minutes : 0;
    if (minutes < 1 || minutes > 120) return c.json({ error: "Sessão inválida." }, 400);
    const subject = str(body.subject, 40);
    const streak = await touchStreak(user.id);
    const xp = await awardXP(user.id, minutes, {
      counters: { focusMinutes: minutes, focusSessions: 1 },
      best: { bestStreak: streak.best },
      stats: { focus: minutes },
      subject: subject || void 0,
      subjectPoints: minutes,
      dailyCap: { key: "focus", max: 240 }
    });
    return c.json({ ok: true, streak, xp });
  });
}

// ../conecta-api/school.ts
var str2 = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
var isManager = (profile) => profile.role === "owner" || profile.role === "admin";
var REPORT_REASONS = {
  ofensa: "Ofensa ou bullying",
  assedio: "Assédio ou ameaça",
  improprio: "Conteúdo impróprio",
  spam: "Spam ou golpe",
  outro: "Outro motivo"
};
async function managers() {
  const profiles = await getByPrefix("profile:");
  return new Set(profiles.filter((profile) => profile && isManager(profile)).map((profile) => profile.id));
}
async function announceReport(report) {
  await Promise.all([
    broadcast(staffTopic(), "reports", {}),
    managers().then(
      (ids) => notifyUsers(ids, "messages", {
        title: report.kind === "filter" ? "Mensagem bloqueada pelo filtro" : "Nova denúncia",
        body: `${report.reportedName}: ${report.text}`.slice(0, 160),
        url: "#/gestao/denuncias",
        tag: `denuncia:${report.id}`
      })
    )
  ]);
}
async function fileFilterReport(author, text2, category, where) {
  const report = {
    id: crypto.randomUUID(),
    status: "open",
    kind: "filter",
    reportedUserId: author.id,
    reportedName: author.name,
    text: text2.slice(0, 2e3),
    reason: category === "ameaca" ? "Ameaça ou incentivo a se machucar" : category === "odio" ? "Discurso de ódio" : "Ofensa direta",
    note: "",
    category,
    where,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await set(`report:${report.id}`, report);
  inBackground(announceReport(report));
}
function registerSchool(api2) {
  const CATALOG_KEY = "video-catalog";
  const readCatalog = async () => {
    const stored = await get(CATALOG_KEY);
    return { added: Array.isArray(stored?.added) ? stored.added : [], hidden: Array.isArray(stored?.hidden) ? stored.hidden : [] };
  };
  api2.get("/videos", async (c) => c.json(await readCatalog()));
  api2.post("/videos", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const profile = await profileFor(user);
    if (!isStaff(profile)) return c.json({ error: "Apenas professores, a coordenação e o proprietário mudam os vídeos." }, 403);
    const body = await c.req.json().catch(() => ({}));
    const youtubeId = typeof body.youtubeId === "string" && /^[A-Za-z0-9_-]{11}$/.test(body.youtubeId) ? body.youtubeId : "";
    const title = str2(body.title, 120);
    const channel = str2(body.channel, 80);
    const subject = str2(body.subject, 40);
    const topic = str2(body.topic, 80);
    if (!youtubeId || !title || !subject) return c.json({ error: "Informe o link do vídeo, o título e a matéria." }, 400);
    const catalog = await readCatalog();
    if (catalog.added.some((video2) => video2.youtubeId === youtubeId)) return c.json({ error: "Esse vídeo já está no catálogo." }, 409);
    const video = { id: `v-${youtubeId}`, youtubeId, title, channel: channel || "YouTube", subject, topic: topic || subject, addedBy: profile.name, addedAt: (/* @__PURE__ */ new Date()).toISOString() };
    catalog.added = [...catalog.added, video].slice(-500);
    catalog.hidden = catalog.hidden.filter((id) => id !== video.id);
    await set(CATALOG_KEY, catalog);
    return c.json(video, 201);
  });
  api2.delete("/videos/:id", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    if (!isStaff(await profileFor(user))) return c.json({ error: "Apenas professores, a coordenação e o proprietário mudam os vídeos." }, 403);
    const id = c.req.param("id");
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return c.json({ error: "Vídeo inválido." }, 400);
    const catalog = await readCatalog();
    if (catalog.added.some((video) => video.id === id)) catalog.added = catalog.added.filter((video) => video.id !== id);
    else if (!catalog.hidden.includes(id)) catalog.hidden = [...catalog.hidden, id].slice(-500);
    await set(CATALOG_KEY, catalog);
    return c.json({ ok: true });
  });
  api2.post("/videos/restore", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    if (!isManager(await profileFor(user))) return c.json({ error: "Apenas a coordenação e o proprietário restauram o catálogo." }, 403);
    const catalog = await readCatalog();
    await set(CATALOG_KEY, { ...catalog, hidden: [] });
    return c.json({ ok: true });
  });
  api2.get("/videos/lookup", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    if (!isStaff(await profileFor(user))) return c.json({ error: "Sem permissão." }, 403);
    const id = c.req.query("id") ?? "";
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return c.json({ error: "Link inválido." }, 400);
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, { signal: AbortSignal.timeout(6e3) });
      if (!response.ok) return c.json({ error: "Não encontrei esse vídeo. Ele pode ser privado." }, 404);
      const data = await response.json();
      return c.json({ title: str2(data.title, 120), channel: str2(data.author_name, 80) });
    } catch {
      return c.json({ error: "Não foi possível consultar o YouTube agora." }, 502);
    }
  });
  api2.get("/communities/:id/capacity", async (c) => {
    const user = await authenticatedUser(c);
    if (!user || (await profileFor(user)).role !== "owner") return c.json({ error: "Apenas o proprietário vê a lotação." }, 403);
    const id = c.req.param("id");
    if (!validCommunityId(id) || !await communityFor(id)) return c.json({ error: "Comunidade não encontrada." }, 404);
    return c.json(await communityCapacity(id));
  });
  api2.put("/communities/:id/limit", async (c) => {
    const user = await authenticatedUser(c);
    if (!user || (await profileFor(user)).role !== "owner") return c.json({ error: "Apenas o proprietário define o limite de pessoas." }, 403);
    const id = c.req.param("id");
    if (!validCommunityId(id)) return c.json({ error: "Comunidade inválida." }, 400);
    const stored = await get(`community:${id}`);
    if (!stored) return c.json({ error: "Salve a comunidade em Editar antes de definir o limite." }, 404);
    const body = await c.req.json().catch(() => ({}));
    if (body.limit !== null && !validMemberLimit(body.limit)) return c.json({ error: "O limite deve ser um número de 1 a 100.000, ou nenhum." }, 400);
    const { memberLimit: _old, ...rest } = stored;
    await set(`community:${id}`, body.limit === null ? rest : { ...rest, memberLimit: body.limit });
    return c.json(await communityCapacity(id));
  });
  api2.post("/reports", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para denunciar uma mensagem." }, 401);
    if (!withinRateLimit(`report:${user.id}`, 10, 60 * 60 * 1e3)) return c.json({ error: "Você já fez muitas denúncias nesta hora." }, 429);
    const body = await c.req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" && REPORT_REASONS[body.reason] ? body.reason : "";
    const note = str2(body.note, 500);
    const messageId = typeof body.messageId === "string" && validId(body.messageId) ? body.messageId : "";
    if (!reason || !messageId) return c.json({ error: "Escolha o motivo da denúncia." }, 400);
    const reporter = await profileFor(user);
    let report;
    if (body.kind === "dm") {
      const friendId = typeof body.friendId === "string" && validUserId(body.friendId) ? body.friendId : "";
      const friendship = friendId ? await get(friendshipKey(user.id, friendId)) : void 0;
      if (friendship?.status !== "accepted") return c.json({ error: "Conversa não encontrada." }, 404);
      const message = await get(`${privateConversationKey(user.id, friendId)}${messageId}`);
      if (!message) return c.json({ error: "Mensagem não encontrada." }, 404);
      if (message.userId === user.id) return c.json({ error: "Você não pode denunciar a sua própria mensagem." }, 400);
      report = {
        id: crypto.randomUUID(),
        status: "open",
        kind: "dm",
        messageId,
        pair: [user.id, friendId].sort(),
        reportedUserId: message.userId,
        reportedName: message.author,
        text: message.text.slice(0, 2e3),
        reason: REPORT_REASONS[reason],
        note,
        reporterId: user.id,
        reporterName: reporter.name,
        where: "Conversa privada",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } else {
      const channel = typeof body.channel === "string" ? body.channel : "";
      if (!await validMessageChannel(channel)) return c.json({ error: "Canal inválido." }, 400);
      const courseId = channel.split("::")[0];
      if (!reporter.courses.includes(courseId) && !isStaff(reporter)) return c.json({ error: "Entre nesta comunidade antes de denunciar." }, 403);
      const message = await get(`message:${channel}:${messageId}`);
      if (!message) return c.json({ error: "Mensagem não encontrada." }, 404);
      if (message.userId === user.id) return c.json({ error: "Você não pode denunciar a sua própria mensagem." }, 400);
      const community = await communityFor(courseId);
      const channelName = community?.channels?.find((item) => item.id === channel.split("::")[1])?.name ?? channel.split("::")[1];
      report = {
        id: crypto.randomUUID(),
        status: "open",
        kind: "channel",
        channel,
        messageId,
        reportedUserId: message.userId,
        reportedName: message.author,
        text: (message.text || message.poll?.question || "").slice(0, 2e3),
        ...message.imageUrl ? { imageUrl: message.imageUrl } : {},
        ...message.imagePath ? { imagePath: message.imagePath } : {},
        reason: REPORT_REASONS[reason],
        note,
        reporterId: user.id,
        reporterName: reporter.name,
        where: `#${channelName} · ${community?.name ?? courseId}`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const existing = await getByPrefix("report:");
    if (existing.some((item) => item.status === "open" && item.messageId === messageId && item.reporterId === user.id)) {
      return c.json({ error: "Você já denunciou esta mensagem. A coordenação vai analisar." }, 409);
    }
    await set(`report:${report.id}`, report);
    inBackground(announceReport(report));
    return c.json({ ok: true }, 201);
  });
  api2.get("/reports", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    if (!isManager(await profileFor(user))) return c.json({ error: "Apenas a coordenação e o proprietário veem as denúncias." }, 403);
    const status = c.req.query("status") === "all" ? "all" : "open";
    const reports = await getByPrefix("report:");
    return c.json(await withMedia(reports.filter((report) => report && (status === "all" || report.status === "open")).sort((first, second) => second.createdAt.localeCompare(first.createdAt)).slice(0, 200)));
  });
  api2.patch("/reports/:id", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const profile = await profileFor(user);
    if (!isManager(profile)) return c.json({ error: "Apenas a coordenação e o proprietário resolvem denúncias." }, 403);
    const id = c.req.param("id");
    const report = validId(id) ? await get(`report:${id}`) : void 0;
    if (!report) return c.json({ error: "Denúncia não encontrada." }, 404);
    const body = await c.req.json().catch(() => ({}));
    const status = body.status === "dismissed" ? "dismissed" : body.status === "open" ? "open" : "resolved";
    if (body.deleteMessage === true && report.messageId && !report.messageDeleted) {
      if (report.kind === "channel" && report.channel) {
        const original = await get(`message:${report.channel}:${report.messageId}`);
        await del(`message:${report.channel}:${report.messageId}`);
        await removePrivateImage(original?.imagePath);
        inBackground(broadcast(channelTopic(report.channel), "messages", { channel: report.channel, kind: "delete", id: report.messageId }));
      } else if (report.kind === "dm" && report.pair) {
        await del(`${privateConversationKey(report.pair[0], report.pair[1])}${report.messageId}`);
        inBackground(broadcast(dmTopic(report.pair[0], report.pair[1]), "dm", { from: report.reportedUserId }));
      }
      report.messageDeleted = true;
      await addNotice(report.reportedUserId, { kind: "removed", text: report.text.slice(0, 300), reason: report.reason, where: report.where ?? "" });
    }
    if (report.kind === "appeal" && report.noticeId && status !== "open") {
      const noticeKey = `notice:${report.reportedUserId}:${report.noticeId}`;
      const notice = await get(noticeKey);
      if (notice?.appeal) {
        await set(noticeKey, { ...notice, appeal: { ...notice.appeal, status: "analisado" } });
        inBackground(broadcast(userTopic(report.reportedUserId), "notices", {}));
      }
    }
    const updated = { ...report, status, ...status === "open" ? {} : { resolvedAt: (/* @__PURE__ */ new Date()).toISOString(), resolvedBy: profile.name } };
    await set(`report:${id}`, updated);
    inBackground(broadcast(staffTopic(), "reports", {}));
    return c.json(updated);
  });
  const teacherStudent = (first, second) => !!first && !!second && (first.role === "professor" && second.role === "aluno" || first.role === "aluno" && second.role === "professor");
  const person3 = (profile) => ({ id: profile.id, name: profile.name, avatarDataUrl: profile.avatarDataUrl, role: profile.role });
  api2.get("/safety/conversations", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    if (!isManager(await profileFor(user))) return c.json({ error: "Apenas a coordenação e o proprietário acessam esta área." }, 403);
    const [profiles, relationships] = await Promise.all([
      getByPrefix("profile:"),
      getByPrefix("friend:")
    ]);
    const byId = new Map(profiles.filter(Boolean).map((profile) => [profile.id, profile]));
    const pairs = relationships.filter((item) => item?.status === "accepted" && item.userId < item.friendId && teacherStudent(byId.get(item.userId), byId.get(item.friendId)));
    const result = await Promise.all(pairs.map(async (pair) => {
      const first = byId.get(pair.userId);
      const second = byId.get(pair.friendId);
      const teacher = first.role === "professor" ? first : second;
      const student = first.role === "professor" ? second : first;
      const messages = (await getByPrefix(privateConversationKey(pair.userId, pair.friendId))).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const last = messages[messages.length - 1];
      return { teacher: person3(teacher), student: person3(student), count: messages.length, lastAt: last?.createdAt ?? null, lastText: last ? `${last.author}: ${last.text}`.slice(0, 120) : "" };
    }));
    return c.json(result.sort((first, second) => (second.lastAt ?? "").localeCompare(first.lastAt ?? "")));
  });
  api2.get("/safety/conversations/:first/:second", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const viewer = await profileFor(user);
    if (!isManager(viewer)) return c.json({ error: "Apenas a coordenação e o proprietário acessam esta área." }, 403);
    const firstId = c.req.param("first");
    const secondId = c.req.param("second");
    if (!validUserId(firstId) || !validUserId(secondId)) return c.json({ error: "Conversa inválida." }, 400);
    const [first, second] = await Promise.all([get(`profile:${firstId}`), get(`profile:${secondId}`)]);
    if (!teacherStudent(first, second)) return c.json({ error: "Só as conversas entre professores e alunos podem ser vistas." }, 403);
    const messages = (await getByPrefix(privateConversationKey(firstId, secondId))).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const teacher = first.role === "professor" ? first : second;
    const student = first.role === "professor" ? second : first;
    const at = (/* @__PURE__ */ new Date()).toISOString();
    await set(`dm-audit:${at}:${crypto.randomUUID().slice(0, 8)}`, {
      at,
      viewerId: viewer.id,
      viewerName: viewer.name,
      viewerRole: viewer.role,
      teacherId: teacher.id,
      teacherName: teacher.name,
      studentId: student.id,
      studentName: student.name,
      messages: messages.length
    });
    return c.json({ teacher: person3(teacher), student: person3(student), messages });
  });
  api2.get("/safety/audit", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    if ((await profileFor(user)).role !== "owner") return c.json({ error: "Apenas o proprietário vê o registro de acessos." }, 403);
    const entries = await getByPrefix("dm-audit:");
    return c.json(entries.sort((first, second) => second.at.localeCompare(first.at)).slice(0, 100));
  });
}

// ../conecta-api/games.ts
var str3 = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
var aiFailure2 = (c, error) => {
  const status = error instanceof AIError ? error.status : 502;
  return c.json({ error: error instanceof Error ? error.message : "Não foi possível falar com a IA." }, status >= 400 && status < 600 ? status : 502);
};
var person = (profile) => ({ id: profile.id, name: profile.name, avatarDataUrl: profile.avatarDataUrl });
function cleanQuestions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) return null;
  const questions = value.map((item) => ({
    question: str3(item?.question, 400),
    options: Array.isArray(item?.options) ? item.options.filter((option) => typeof option === "string" && option.trim()).map((option) => option.trim().slice(0, 160)).slice(0, 4) : [],
    answer: Number.isInteger(item?.answer) ? item.answer : -1,
    explanation: str3(item?.explanation, 400)
  }));
  return questions.every((item) => item.question && item.options.length >= 2 && item.answer >= 0 && item.answer < item.options.length) ? questions : null;
}
var liveTopic = (code) => `conecta:live:${code}`;
function liveScores(players, answers) {
  const totals = /* @__PURE__ */ new Map();
  for (const answer of answers) {
    const entry = totals.get(answer.userId) ?? { score: 0, correct: 0 };
    entry.score += answer.points;
    entry.correct += answer.correct ? 1 : 0;
    totals.set(answer.userId, entry);
  }
  return players.map((player) => ({ userId: player.userId, name: player.name, avatarDataUrl: player.avatarDataUrl, ...totals.get(player.userId) ?? { score: 0, correct: 0 } })).sort((first, second) => second.score - first.score || second.correct - first.correct || first.name.localeCompare(second.name, "pt-BR"));
}
async function liveAwards(session) {
  const [players, answers] = await Promise.all([
    getByPrefix(`live-player:${session.code}:`),
    getByPrefix(`live-answer:${session.code}:`)
  ]);
  const board = liveScores(players, answers);
  for (const [index, entry] of board.entries()) {
    const counters = { liveGames: 1 };
    if (board.length >= 2 && index === 0 && entry.score > 0) counters.liveWins = 1;
    if (board.length >= 3 && index < 3 && entry.score > 0) counters.livePodium = 1;
    await awardXP(entry.userId, Math.min(60, 10 + entry.correct * 5), { once: `live:${session.code}`, counters, stats: { live: 1, correct: entry.correct }, subject: session.subject || void 0, subjectPoints: entry.correct });
  }
}
var DUEL_QUESTION_MS = 2e4;
var DUEL_EXPIRES_MS = 3 * 864e5;
var playKey = (duelId, userId) => `duel-play:${duelId}:${userId}`;
var emptyPlay = (duelId, userId) => ({ duelId, userId, index: 0, openedAt: null, answers: [] });
async function finishDuel(duel, plays) {
  const scores = {};
  for (const play of plays) scores[play.userId] = { correct: play.answers.filter((answer) => answer.correct).length, ms: play.answers.reduce((sum, answer) => sum + answer.ms, 0) };
  const [first, second] = [duel.challengerId, duel.opponentId].map((id) => scores[id] ?? { correct: 0, ms: Infinity });
  let winnerId = null;
  if (first.correct !== second.correct) winnerId = first.correct > second.correct ? duel.challengerId : duel.opponentId;
  else if (first.ms !== second.ms) winnerId = first.ms < second.ms ? duel.challengerId : duel.opponentId;
  const done = { ...duel, status: "done", finishedAt: (/* @__PURE__ */ new Date()).toISOString(), result: { winnerId, scores } };
  await set(`duel:${duel.id}`, done);
  for (const id of [duel.challengerId, duel.opponentId]) {
    const won = id === winnerId;
    await awardXP(id, won ? 40 : 15, { once: `duel:${duel.id}`, counters: { duels: 1, ...won ? { duelWins: 1 } : {} }, stats: { duels: 1 }, subject: duel.subject || void 0, subjectPoints: scores[id]?.correct ?? 0 });
    inBackground(broadcast(userTopic(id), "duel", { id: duel.id }));
  }
  return done;
}
async function freshDuel(duel) {
  if ((duel.status === "pending" || duel.status === "active") && Date.now() - Date.parse(duel.createdAt) > DUEL_EXPIRES_MS) {
    const expired = { ...duel, status: "expired" };
    await set(`duel:${duel.id}`, expired);
    return expired;
  }
  return duel;
}
var SUM_KEYS = ["xp", "focus", "reviews", "quizzes", "correct", "tasks", "essays", "plan", "duels", "live"];
function archetype(totals) {
  const scores = [
    ["foco", "Mestre do foco", totals.focus / 25],
    ["fichas", "Lenda das fichas", totals.reviews / 15],
    ["simulados", "Fera dos simulados", totals.quizzes * 1.5],
    ["redacao", "Pena afiada", totals.essays * 2],
    ["duelos", "Duelista nato", totals.duels * 1.2],
    ["quiz", "Estrela do quiz ao vivo", totals.live * 1.5],
    ["tarefas", "Sempre em dia", totals.tasks],
    ["plano", "Estrategista", totals.plan / 3]
  ];
  const best = scores.sort((first, second) => second[2] - first[2])[0];
  return best[2] > 0 ? { id: best[0], title: best[1] } : { id: "comeco", title: "Começando a jornada" };
}
function registerGames(api2) {
  api2.get("/xp", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    return c.json(publicXP(await readXP(user.id)));
  });
  api2.put("/xp/visibility", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const body = await c.req.json().catch(() => ({}));
    const record = await readXP(user.id);
    record.hidden = body.hidden === true;
    await set(`xp:${user.id}`, record);
    return c.json(publicXP(record));
  });
  api2.get("/ranking", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para ver o ranking." }, 401);
    const scope = c.req.query("scope") === "all" ? "all" : "week";
    const group = c.req.query("group") === "friends" ? "friends" : "school";
    const [profiles, records] = await Promise.all([getByPrefix("profile:"), getByPrefix("xp:")]);
    const byUser = new Map(records.filter((record) => record?.userId).map((record) => [record.userId, record]));
    let pool = profiles.filter((profile) => profile && profile.role === "aluno");
    if (group === "friends") {
      const friends = await getByPrefix(`friend:${user.id}:`);
      const ids = /* @__PURE__ */ new Set([user.id, ...friends.filter((item) => item.status === "accepted").map((item) => item.friendId)]);
      pool = pool.filter((profile) => ids.has(profile.id));
    }
    const entries = pool.map((profile) => {
      const record = byUser.get(profile.id);
      const points = record ? scope === "week" ? weekPoints(record) : record.total : 0;
      return { ...person(profile), points, level: levelFor(record?.total ?? 0).level, hidden: !!record?.hidden };
    }).filter((entry) => !entry.hidden || entry.id === user.id).sort((first, second) => second.points - first.points || first.name.localeCompare(second.name, "pt-BR")).map((entry, index) => ({ ...entry, rank: index + 1 }));
    const mine = entries.find((entry) => entry.id === user.id) ?? null;
    return c.json({ scope, group, entries: entries.filter((entry) => entry.points > 0 || entry.id === user.id).slice(0, 50), me: mine });
  });
  api2.post("/live", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const profile = await profileFor(user);
    if (!isStaff(profile)) return c.json({ error: "Só professores e a coordenação abrem um quiz ao vivo." }, 403);
    if (!withinRateLimit(`live:${user.id}`, 10, 60 * 60 * 1e3)) return c.json({ error: "Muitos quizzes nesta hora." }, 429);
    const body = await c.req.json().catch(() => ({}));
    const questions = cleanQuestions(body.questions);
    const title = str3(body.title, 80);
    if (!questions || !title) return c.json({ error: "Dê um nome ao quiz e tenha pelo menos uma pergunta com 2 a 4 alternativas." }, 400);
    const duration = Number.isInteger(body.duration) ? Math.min(60, Math.max(10, body.duration)) : 20;
    let code = "";
    for (let attempt = 0; attempt < 8 && !code; attempt++) {
      const candidate = String(1e5 + crypto.getRandomValues(new Uint32Array(1))[0] % 9e5);
      if (!await get(`live:${candidate}`)) code = candidate;
    }
    if (!code) return c.json({ error: "Não foi possível criar a sala agora. Tente de novo." }, 503);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const session = { code, hostId: user.id, hostName: profile.name, title, subject: str3(body.subject, 60), questions, duration, state: "lobby", index: 0, startedAt: null, createdAt: now, updatedAt: now };
    const channel = typeof body.channel === "string" ? body.channel : "";
    if (channel && await validMessageChannel(channel)) {
      session.channel = channel;
      const message = {
        id: crypto.randomUUID(),
        channel,
        author: profile.name,
        avatar: profile.avatarDataUrl ?? "",
        text: `Quiz ao vivo: ${title}`,
        time: new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
        userId: profile.id,
        createdAt: now,
        live: { code, title }
      };
      await set(`message:${channel}:${message.id}`, message);
      inBackground(broadcast(channelTopic(channel), "messages", { channel, kind: "new", id: message.id }));
    }
    await set(`live:${code}`, session);
    const index = await get(`live-index:${user.id}`) ?? [];
    const old = index.filter((item) => Date.now() - Date.parse(item.createdAt) > 2 * 864e5);
    for (const item of old) {
      const keys = [
        `live:${item.code}`,
        ...(await getByPrefix(`live-player:${item.code}:`)).map((player) => `live-player:${item.code}:${player.userId}`),
        ...(await getByPrefix(`live-answer:${item.code}:`)).map((answer) => `live-answer:${item.code}:${answer.index}:${answer.userId}`)
      ];
      for (let start = 0; start < keys.length; start += 100) await mdel(keys.slice(start, start + 100));
    }
    await set(`live-index:${user.id}`, [...index.filter((item) => !old.includes(item)), { code, createdAt: now }].slice(-30));
    return c.json({ code, title }, 201);
  });
  api2.get("/live/:code", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para jogar." }, 401);
    const code = c.req.param("code");
    const session = /^\d{6}$/.test(code) ? await get(`live:${code}`) : void 0;
    if (!session) return c.json({ error: "Sala não encontrada. Confira o código." }, 404);
    const [players, answers] = await Promise.all([
      getByPrefix(`live-player:${code}:`),
      getByPrefix(`live-answer:${code}:`)
    ]);
    const isHost = session.hostId === user.id;
    const board = liveScores(players, answers);
    const current = answers.filter((answer) => answer.index === session.index);
    const showAnswer = session.state === "reveal" || session.state === "final";
    const question = session.state === "lobby" ? null : session.questions[session.index];
    const mine = current.find((answer) => answer.userId === user.id) ?? null;
    const myRank = board.findIndex((entry) => entry.userId === user.id);
    return c.json({
      code,
      title: session.title,
      subject: session.subject,
      hostName: session.hostName,
      state: session.state,
      index: session.index,
      total: session.questions.length,
      duration: session.duration,
      startedAt: session.startedAt,
      serverNow: (/* @__PURE__ */ new Date()).toISOString(),
      isHost,
      players: players.length,
      roster: players.slice(0, 80).map((player) => ({ userId: player.userId, name: player.name, avatarDataUrl: player.avatarDataUrl })),
      answered: current.length,
      question: question ? { text: question.question, options: question.options, ...showAnswer ? { answer: question.answer, explanation: question.explanation } : {} } : null,
      distribution: showAnswer && question ? question.options.map((_, option) => current.filter((answer) => answer.option === option).length) : null,
      leaderboard: showAnswer || isHost ? board.slice(0, 10) : null,
      me: {
        joined: players.some((player) => player.userId === user.id),
        score: myRank >= 0 ? board[myRank].score : 0,
        correct: myRank >= 0 ? board[myRank].correct : 0,
        rank: myRank >= 0 ? myRank + 1 : null,
        answered: !!mine,
        lastOption: mine ? mine.option : null,
        lastCorrect: showAnswer && mine ? mine.correct : null,
        lastPoints: showAnswer && mine ? mine.points : null
      }
    });
  });
  api2.post("/live/:code/join", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para jogar." }, 401);
    const code = c.req.param("code");
    const session = /^\d{6}$/.test(code) ? await get(`live:${code}`) : void 0;
    if (!session) return c.json({ error: "Sala não encontrada. Confira o código." }, 404);
    if (session.state === "final") return c.json({ error: "Este quiz já terminou." }, 409);
    if (session.hostId === user.id) return c.json({ ok: true, host: true });
    const key = `live-player:${code}:${user.id}`;
    if (!await get(key)) {
      const profile = await profileFor(user);
      await set(key, { userId: user.id, name: profile.name, avatarDataUrl: profile.avatarDataUrl, joinedAt: (/* @__PURE__ */ new Date()).toISOString() });
      inBackground(broadcast(liveTopic(code), "players", {}));
    }
    return c.json({ ok: true });
  });
  api2.post("/live/:code/answer", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para jogar." }, 401);
    const code = c.req.param("code");
    const session = /^\d{6}$/.test(code) ? await get(`live:${code}`) : void 0;
    if (!session) return c.json({ error: "Sala não encontrada." }, 404);
    const body = await c.req.json().catch(() => ({}));
    if (session.state !== "question" || body.index !== session.index || !session.startedAt) return c.json({ error: "Esta pergunta já fechou." }, 409);
    const question = session.questions[session.index];
    const option = Number.isInteger(body.option) ? body.option : -1;
    if (option < 0 || option >= question.options.length) return c.json({ error: "Alternativa inválida." }, 400);
    const elapsed = Date.now() - Date.parse(session.startedAt);
    if (elapsed > session.duration * 1e3 + 1500) return c.json({ error: "O tempo acabou." }, 409);
    if (!await get(`live-player:${code}:${user.id}`)) return c.json({ error: "Entre na sala antes de responder." }, 403);
    const key = `live-answer:${code}:${session.index}:${user.id}`;
    if (await get(key)) return c.json({ error: "Você já respondeu esta pergunta." }, 409);
    const correct = option === question.answer;
    const fraction = Math.min(1, Math.max(0, elapsed / (session.duration * 1e3)));
    const answer = { userId: user.id, index: session.index, option, correct, points: correct ? Math.round(1e3 * (1 - fraction / 2)) : 0, ms: elapsed };
    await set(key, answer);
    inBackground(broadcast(liveTopic(code), "answer", {}));
    return c.json({ ok: true });
  });
  api2.post("/live/:code/control", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const code = c.req.param("code");
    const session = /^\d{6}$/.test(code) ? await get(`live:${code}`) : void 0;
    if (!session) return c.json({ error: "Sala não encontrada." }, 404);
    if (session.hostId !== user.id) return c.json({ error: "Só quem abriu o quiz controla as perguntas." }, 403);
    const body = await c.req.json().catch(() => ({}));
    const action = body.action;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let next = { ...session, updatedAt: now };
    if (action === "start" && session.state === "lobby") next = { ...next, state: "question", index: 0, startedAt: now };
    else if (action === "reveal" && session.state === "question") next = { ...next, state: "reveal" };
    else if (action === "next" && session.state === "reveal") {
      next = session.index + 1 < session.questions.length ? { ...next, state: "question", index: session.index + 1, startedAt: now } : { ...next, state: "final" };
    } else if (action === "end") next = { ...next, state: "final" };
    else return c.json({ error: "Ação inválida agora." }, 409);
    if (next.state === "final" && !session.awarded) next.awarded = true;
    await set(`live:${code}`, next);
    if (next.state === "final" && !session.awarded) inBackground(liveAwards(next));
    inBackground(broadcast(liveTopic(code), "state", {}));
    return c.json({ ok: true, state: next.state, index: next.index });
  });
  const duelSummary = async (duel, viewerId, profiles) => {
    const otherId = duel.challengerId === viewerId ? duel.opponentId : duel.challengerId;
    const [mine, theirs] = await Promise.all([get(playKey(duel.id, viewerId)), get(playKey(duel.id, otherId))]);
    const other = profiles.get(otherId);
    return {
      id: duel.id,
      subject: duel.subject,
      topic: duel.topic,
      status: duel.status,
      createdAt: duel.createdAt,
      incoming: duel.opponentId === viewerId,
      total: duel.questions.length,
      opponent: other ? person(other) : { id: otherId, name: "Conta removida", avatarDataUrl: null },
      myProgress: mine?.answers.length ?? 0,
      myFinished: !!mine?.finishedAt,
      theirProgress: theirs?.answers.length ?? 0,
      theirFinished: !!theirs?.finishedAt,
      result: duel.result ?? null
    };
  };
  api2.post("/duels", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para desafiar alguém." }, 401);
    if (!withinRateLimit(`duel:${user.id}`, 6, 10 * 60 * 1e3)) return c.json({ error: "Muitos desafios em pouco tempo. Espere uns minutos." }, 429);
    {
      const blocked = await aiBlockedFor(await profileFor(user));
      if (blocked) return c.json({ error: blocked, code: "consent" }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const friendId = typeof body.friendId === "string" ? body.friendId : "";
    const subject = str3(body.subject, 60);
    const topic = str3(body.topic, 120);
    if (!validId(friendId) || friendId === user.id) return c.json({ error: "Escolha um amigo para desafiar." }, 400);
    if (!subject && !topic) return c.json({ error: "Escolha a matéria ou o assunto do duelo." }, 400);
    const friendship = await get(friendshipKey(user.id, friendId));
    if (friendship?.status !== "accepted") return c.json({ error: "Você só pode desafiar amigos." }, 403);
    try {
      const questions = await generateQuiz(subject, topic, 5);
      const duel = { id: crypto.randomUUID(), challengerId: user.id, opponentId: friendId, subject, topic, questions, status: "pending", createdAt: (/* @__PURE__ */ new Date()).toISOString() };
      await set(`duel:${duel.id}`, duel);
      const profile = await profileFor(user);
      inBackground(Promise.all([
        broadcast(userTopic(friendId), "duel", { id: duel.id }),
        notifyUsers(/* @__PURE__ */ new Set([friendId]), "dms", { title: "Desafio para um duelo", body: `${profile.name} te desafiou: ${topic || subject}. Topa?`, url: `#/desafios/duelo/${duel.id}`, tag: `duelo:${duel.id}` })
      ]));
      return c.json({ id: duel.id }, 201);
    } catch (error) {
      return aiFailure2(c, error);
    }
  });
  api2.get("/duels", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const [duels, profiles] = await Promise.all([getByPrefix("duel:"), getByPrefix("profile:")]);
    const byId = new Map(profiles.filter(Boolean).map((profile) => [profile.id, profile]));
    const mine = await Promise.all(duels.filter((duel) => duel && (duel.challengerId === user.id || duel.opponentId === user.id)).sort((first, second) => second.createdAt.localeCompare(first.createdAt)).slice(0, 30).map(freshDuel));
    return c.json(await Promise.all(mine.filter((duel) => duel.status !== "declined" || duel.challengerId === user.id).map((duel) => duelSummary(duel, user.id, byId))));
  });
  api2.get("/duels/:id", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const id = c.req.param("id");
    const stored = validId(id) ? await get(`duel:${id}`) : void 0;
    if (!stored || stored.challengerId !== user.id && stored.opponentId !== user.id) return c.json({ error: "Duelo não encontrado." }, 404);
    const duel = await freshDuel(stored);
    const profiles = new Map((await Promise.all([duel.challengerId, duel.opponentId].map((pid) => get(`profile:${pid}`)))).filter(Boolean).map((profile) => [profile.id, profile]));
    const summary = await duelSummary(duel, user.id, profiles);
    const play = await get(playKey(duel.id, user.id));
    const otherId = duel.challengerId === user.id ? duel.opponentId : duel.challengerId;
    const review = duel.status === "done" || play?.finishedAt ? {
      questions: duel.questions.map((question, index) => ({ ...question, mine: play?.answers[index] ?? null })),
      theirs: duel.status === "done" ? (await get(playKey(duel.id, otherId)))?.answers ?? [] : null
    } : null;
    return c.json({ ...summary, review, questionMs: DUEL_QUESTION_MS });
  });
  api2.post("/duels/:id/respond", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const id = c.req.param("id");
    const duel = validId(id) ? await get(`duel:${id}`) : void 0;
    if (!duel || duel.opponentId !== user.id) return c.json({ error: "Duelo não encontrado." }, 404);
    if (duel.status !== "pending") return c.json({ error: "Este duelo já começou." }, 409);
    await set(`duel:${id}`, { ...duel, status: "declined" });
    inBackground(broadcast(userTopic(duel.challengerId), "duel", { id }));
    return c.json({ ok: true });
  });
  api2.post("/duels/:id/next", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const id = c.req.param("id");
    const stored = validId(id) ? await get(`duel:${id}`) : void 0;
    if (!stored || stored.challengerId !== user.id && stored.opponentId !== user.id) return c.json({ error: "Duelo não encontrado." }, 404);
    const duel = await freshDuel(stored);
    if (duel.status === "declined" || duel.status === "expired" || duel.status === "done") return c.json({ error: "Este duelo não está mais valendo." }, 409);
    const key = playKey(id, user.id);
    const play = await get(key) ?? emptyPlay(id, user.id);
    if (play.finishedAt) return c.json({ error: "Você já respondeu tudo. Espere o resultado." }, 409);
    if (!play.openedAt) {
      play.openedAt = (/* @__PURE__ */ new Date()).toISOString();
      await set(key, play);
    }
    if (duel.status === "pending" && user.id === duel.opponentId) {
      await set(`duel:${id}`, { ...duel, status: "active" });
      inBackground(broadcast(userTopic(duel.challengerId), "duel", { id }));
    }
    const question = duel.questions[play.index];
    return c.json({ index: play.index, total: duel.questions.length, question: { text: question.question, options: question.options }, openedAt: play.openedAt, serverNow: (/* @__PURE__ */ new Date()).toISOString(), limitMs: DUEL_QUESTION_MS });
  });
  api2.post("/duels/:id/answer", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const id = c.req.param("id");
    const duel = validId(id) ? await get(`duel:${id}`) : void 0;
    if (!duel || duel.challengerId !== user.id && duel.opponentId !== user.id) return c.json({ error: "Duelo não encontrado." }, 404);
    if (duel.status !== "pending" && duel.status !== "active") return c.json({ error: "Este duelo não está mais valendo." }, 409);
    const body = await c.req.json().catch(() => ({}));
    const key = playKey(id, user.id);
    const play = await get(key);
    if (!play || !play.openedAt || body.index !== play.index || play.finishedAt) return c.json({ error: "Pergunta fora de ordem. Recarregue o duelo." }, 409);
    const question = duel.questions[play.index];
    const elapsed = Date.now() - Date.parse(play.openedAt);
    const option = Number.isInteger(body.option) ? body.option : -1;
    const inTime = elapsed <= DUEL_QUESTION_MS + 1500;
    const correct = inTime && option === question.answer;
    play.answers.push({ option, correct, ms: Math.min(elapsed, DUEL_QUESTION_MS) });
    play.index += 1;
    play.openedAt = null;
    if (play.index >= duel.questions.length) play.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    await set(key, play);
    const otherId = duel.challengerId === user.id ? duel.opponentId : duel.challengerId;
    let result = null;
    if (play.finishedAt) {
      const other = await get(playKey(id, otherId));
      if (other?.finishedAt) result = (await finishDuel(duel, [play, other])).result ?? null;
    }
    inBackground(broadcast(userTopic(otherId), "duel", { id }));
    return c.json({ correct, answer: question.answer, explanation: question.explanation, timedOut: !inTime, finished: !!play.finishedAt, result });
  });
  api2.get("/retrospective", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Entre para ver sua retrospectiva." }, 401);
    const today = schoolToday();
    const from = addDays(today, -60);
    const [profile, record, streak, grades, essays, students] = await Promise.all([
      profileFor(user),
      readXP(user.id),
      get(`streak:${user.id}`),
      getByPrefix(`grade:${user.id}:`),
      getByPrefix(`essay:${user.id}:`),
      getByPrefix("xp:")
    ]);
    const totals = Object.fromEntries(SUM_KEYS.map((key) => [key, 0]));
    let activeDays = 0;
    for (const [day, stats] of Object.entries(record.days)) {
      if (day < from || day > today) continue;
      if ((stats.xp ?? 0) > 0) activeDays++;
      for (const key of SUM_KEYS) totals[key] += stats[key] ?? 0;
    }
    const periodEssays = essays.filter((essay) => essay.createdAt.slice(0, 10) >= from);
    const ranked = students.filter((item) => item && typeof item.total === "number").sort((first, second) => second.total - first.total);
    const position = ranked.findIndex((item) => item.userId === user.id);
    const stage = (subject, key) => {
      const values = Object.values(subject.stages?.[key] ?? {}).filter((value) => typeof value === "number");
      return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
    };
    const badges = BADGES.filter((badge) => record.badges[badge.id] && record.badges[badge.id] >= from).map((badge) => ({ id: badge.id, title: badge.title, icon: badge.icon }));
    return c.json({
      name: profile.name.split(" ")[0],
      from,
      to: today,
      ...totals,
      activeDays,
      bestStreak: Math.max(streak?.best ?? 0, record.counters.bestStreak ?? 0),
      essaysCount: periodEssays.length,
      bestEssay: periodEssays.reduce((best, essay) => Math.max(best, essay.result?.total ?? 0), 0),
      duelWins: record.counters.duelWins ?? 0,
      topSubjects: Object.entries(record.subjects).sort((first, second) => second[1] - first[1]).slice(0, 3).map(([subject, points]) => ({ subject, points })),
      grades: grades.map((subject) => ({ subject: subject.subject, stages: [stage(subject, "1"), stage(subject, "2"), stage(subject, "3")] })).filter((item) => item.stages.some((value) => value !== null)),
      badges,
      level: levelFor(record.total).level,
      totalXP: record.total,
      rank: position >= 0 && profile.role === "aluno" ? position + 1 : null,
      archetype: archetype(totals)
    });
  });
}

// ../conecta-api/family.ts
var isManager2 = (profile) => profile.role === "owner" || profile.role === "admin";
var person2 = (profile) => ({ id: profile.id, name: profile.name, avatarDataUrl: profile.avatarDataUrl, role: profile.role });
function registerFamily(api2) {
  api2.get("/school-settings", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const settings = await get("config:school");
    return c.json({ requireAIConsent: !!settings?.requireAIConsent });
  });
  api2.put("/school-settings", async (c) => {
    const user = await authenticatedUser(c);
    if (!user || (await profileFor(user)).role !== "owner") return c.json({ error: "Apenas o proprietário muda esta configuração." }, 403);
    const body = await c.req.json().catch(() => ({}));
    const settings = { requireAIConsent: body.requireAIConsent === true };
    await set("config:school", settings);
    return c.json(settings);
  });
  api2.get("/consents", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    if (!isManager2(await profileFor(user))) return c.json({ error: "Apenas a coordenação e o proprietário veem os termos." }, 403);
    const [profiles, consents] = await Promise.all([
      getByPrefix("profile:"),
      getByPrefix("consent:")
    ]);
    const byUser = new Map(consents.filter((item) => item?.userId).map((item) => [item.userId, item]));
    return c.json(profiles.filter((profile) => profile?.role === "aluno").sort((first, second) => first.name.localeCompare(second.name, "pt-BR")).map((profile) => {
      const consent = byUser.get(profile.id);
      return { ...person2(profile), termSigned: !!consent?.termSigned, aiAllowed: !!consent?.aiAllowed, updatedAt: consent?.updatedAt ?? null, updatedBy: consent?.updatedBy ?? null };
    }));
  });
  api2.put("/consents/:id", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const manager = await profileFor(user);
    if (!isManager2(manager)) return c.json({ error: "Apenas a coordenação e o proprietário registram os termos." }, 403);
    const id = c.req.param("id");
    const student = validUserId(id) ? await get(`profile:${id}`) : void 0;
    if (!student || student.role !== "aluno") return c.json({ error: "Aluno não encontrado." }, 404);
    const body = await c.req.json().catch(() => ({}));
    const current = await get(`consent:${id}`) ?? { userId: id, termSigned: false, aiAllowed: false };
    const termSigned = typeof body.termSigned === "boolean" ? body.termSigned : current.termSigned;
    const aiAllowed = termSigned && (typeof body.aiAllowed === "boolean" ? body.aiAllowed : current.aiAllowed);
    const consent = { userId: id, termSigned, aiAllowed, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), updatedBy: manager.name };
    await set(`consent:${id}`, consent);
    return c.json(consent);
  });
  api2.get("/notices", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const notices = await getByPrefix(`notice:${user.id}:`);
    return c.json(notices.sort((first, second) => second.createdAt.localeCompare(first.createdAt)).slice(0, 30));
  });
  api2.post("/notices/:id/appeal", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    if (!withinRateLimit(`appeal:${user.id}`, 5, 60 * 60 * 1e3)) return c.json({ error: "Muitos pedidos nesta hora." }, 429);
    const id = c.req.param("id");
    const key = `notice:${user.id}:${id}`;
    const notice = validId(id) ? await get(key) : void 0;
    if (!notice) return c.json({ error: "Aviso não encontrado." }, 404);
    if (notice.appeal) return c.json({ error: "Você já pediu revisão desta remoção." }, 409);
    const body = await c.req.json().catch(() => ({}));
    const text2 = typeof body.text === "string" ? body.text.trim().slice(0, 600) : "";
    if (text2.length < 5) return c.json({ error: "Conte em poucas palavras por que a remoção deve ser revista." }, 400);
    const profile = await profileFor(user);
    const report = {
      id: crypto.randomUUID(),
      status: "open",
      kind: "appeal",
      reportedUserId: user.id,
      reportedName: profile.name,
      text: notice.text,
      reason: "Pedido de revisão de mensagem removida",
      note: text2,
      reporterId: user.id,
      reporterName: profile.name,
      where: notice.where,
      noticeId: notice.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await set(`report:${report.id}`, report);
    const updated = { ...notice, appeal: { text: text2, at: report.createdAt, status: "em análise", reportId: report.id } };
    await set(key, updated);
    inBackground(broadcast(staffTopic(), "reports", {}));
    return c.json(updated);
  });
  api2.get("/guardians", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    if (!isManager2(await profileFor(user))) return c.json({ error: "Apenas a coordenação e o proprietário veem os responsáveis." }, 403);
    const profiles = await getByPrefix("profile:");
    const byId = new Map(profiles.filter(Boolean).map((profile) => [profile.id, profile]));
    return c.json(profiles.filter((profile) => profile?.role === "responsavel").map((profile) => ({ ...person2(profile), children: (profile.children ?? []).map((childId) => byId.get(childId)).filter(Boolean).map((child) => person2(child)) })));
  });
  api2.put("/guardians/:id", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    if (!isManager2(await profileFor(user))) return c.json({ error: "Apenas a coordenação e o proprietário vinculam responsáveis." }, 403);
    const id = c.req.param("id");
    const guardian = validUserId(id) ? await get(`profile:${id}`) : void 0;
    if (!guardian || guardian.role !== "responsavel") return c.json({ error: "Primeiro mude o papel desta conta para Responsável." }, 404);
    const body = await c.req.json().catch(() => ({}));
    const requested = Array.isArray(body.children) ? [...new Set(body.children.filter((item) => typeof item === "string" && validUserId(item)))] : null;
    if (!requested) return c.json({ error: "Escolha os alunos." }, 400);
    const students = await Promise.all(requested.slice(0, 10).map((childId) => get(`profile:${childId}`)));
    if (students.some((student) => !student || student.role !== "aluno")) return c.json({ error: "Só é possível vincular contas de alunos." }, 400);
    const updated = { ...guardian, children: requested.slice(0, 10) };
    await set(`profile:${id}`, updated);
    return c.json({ ...person2(updated), children: students.map((student) => person2(student)) });
  });
  api2.get("/guardian/overview", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "Sessão inválida." }, 401);
    const guardian = await profileFor(user);
    if (guardian.role !== "responsavel") return c.json({ error: "Esta área é dos responsáveis." }, 403);
    const tasks = await getByPrefix("task:");
    const children = await Promise.all((guardian.children ?? []).map(async (childId) => {
      const child = await get(`profile:${childId}`);
      if (!child) return null;
      const [grades, relationships, consent] = await Promise.all([
        getByPrefix(`grade:${childId}:`),
        getByPrefix(`friend:${childId}:`),
        get(`consent:${childId}`)
      ]);
      const contacts = await Promise.all(relationships.filter((item) => item.status === "accepted").map((item) => get(`profile:${item.friendId}`)));
      return {
        ...person2(child),
        grades: grades.sort((first, second) => first.subject.localeCompare(second.subject, "pt-BR")),
        tasks: tasks.filter((task) => task && Array.isArray(task.doneBy)).sort((first, second) => first.dueDate.localeCompare(second.dueDate)).slice(-30).map((task) => ({ id: task.id, title: task.title, subject: task.subject, dueDate: task.dueDate, done: task.doneBy.includes(childId) })),
        contacts: contacts.filter(Boolean).map((contact) => ({ ...person2(contact), adult: isStaff(contact) || contact.role === "responsavel" })),
        consent: { termSigned: !!consent?.termSigned, aiAllowed: !!consent?.aiAllowed }
      };
    }));
    return c.json({ children: children.filter(Boolean) });
  });
}

// ../conecta-api/index.ts
var API_VERSION = "conecta-api-2";
var api = new Hono();
api.use("*", logger(console.log));
api.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600
  })
);
api.get("/communities", async (c) => {
  return c.json(await getByPrefix("community:"));
});
api.post("/communities", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para criar uma comunidade." }, 401);
  if ((await profileFor(user)).role !== "owner") return c.json({ error: "Apenas o proprietário pode criar comunidades." }, 403);
  const body = await c.req.json().catch(() => ({}));
  const id = validCommunityId(body.id) ? body.id : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 240) : "";
  const emoji = typeof body.emoji === "string" ? body.emoji.slice(0, 8) : "📚";
  const color = typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : "#a9e58b";
  const channels = Array.isArray(body.channels) ? body.channels.slice(0, 12).filter(
    (channel) => channel && typeof channel.id === "string" && /^[a-z0-9-]{1,48}$/.test(channel.id) && typeof channel.name === "string" && ["text", "voice"].includes(channel.type)
  ).map((channel) => ({ id: channel.id, name: channel.name.slice(0, 40), type: channel.type, emoji: typeof channel.emoji === "string" ? channel.emoji.slice(0, 8) : void 0 })) : [];
  if (!id || !name || channels.length === 0 || courseIds.has(id)) return c.json({ error: "Nome, identificador e ao menos um canal válido são obrigatórios." }, 400);
  if (await get(`community:${id}`)) return c.json({ error: "Já existe uma comunidade com esse nome." }, 409);
  const requiresApproval = id === SCHOOL_ID || body.requiresApproval === true;
  try {
    const logoDataUrl = await persistCommunityImage(body.logoDataUrl, null, id, "logo");
    const bannerDataUrl = await persistCommunityImage(body.bannerDataUrl, null, id, "banner");
    const community = { id, name, emoji, color, description, channels, logoDataUrl, bannerDataUrl, requiresApproval };
    await set(`community:${id}`, community);
    return c.json(community, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Não foi possível salvar as imagens." }, 400);
  }
});
api.put("/communities/:id", async (c) => {
  const user = await authenticatedUser(c);
  if (!user || (await profileFor(user)).role !== "owner") return c.json({ error: "Apenas o proprietário pode editar comunidades." }, 403);
  const id = c.req.param("id");
  if (!validCommunityId(id)) return c.json({ error: "Comunidade inválida." }, 400);
  const body = await c.req.json().catch(() => ({}));
  const current = await communityFor(id);
  if (!current) return c.json({ error: "Comunidade não encontrada." }, 404);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 240) : "";
  const emoji = typeof body.emoji === "string" ? body.emoji.slice(0, 8) : "📚";
  const color = typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : "#a9e58b";
  const channels = Array.isArray(body.channels) ? body.channels.slice(0, 20).filter(
    (channel) => channel && typeof channel.id === "string" && /^[a-z0-9-]{1,48}$/.test(channel.id) && typeof channel.name === "string" && channel.name.trim() && ["text", "voice"].includes(channel.type)
  ).map((channel) => ({ id: channel.id, name: channel.name.trim().slice(0, 40), type: channel.type, emoji: typeof channel.emoji === "string" ? channel.emoji.slice(0, 8) : void 0 })) : [];
  if (!name || channels.length === 0) return c.json({ error: "Nome e ao menos um canal são obrigatórios." }, 400);
  try {
    const community = {
      id,
      name,
      description,
      emoji,
      color,
      channels,
      logoDataUrl: await persistCommunityImage(body.logoDataUrl, current.logoDataUrl, id, "logo"),
      bannerDataUrl: await persistCommunityImage(body.bannerDataUrl, current.bannerDataUrl, id, "banner"),
      requiresApproval: id === SCHOOL_ID || body.requiresApproval === true,
      ...validMemberLimit(current.memberLimit) ? { memberLimit: current.memberLimit } : {}
    };
    await set(`community:${id}`, community);
    return c.json(community);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Não foi possível salvar as imagens." }, 400);
  }
});
api.get("/health", (c) => c.json({ status: "ok", version: API_VERSION }));
api.get("/realtime", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  const profile = await profileFor(user);
  const manager = profile.role === "owner" || profile.role === "admin";
  return c.json({ personal: await userTopic(user.id), ...manager ? { staff: await staffTopic() } : {} });
});
api.post("/signup", async (c) => {
  const origin = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!withinRateLimit(`signup:${origin}`, 5, 60 * 60 * 1e3)) {
    return c.json({ error: "Muitas tentativas de cadastro. Tente novamente mais tarde." }, 429);
  }
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const courses = requestedCourses(body.courses);
  const communities = await Promise.all(courses.map(communityFor));
  if (!email || !name || password.length < 6 || courses.length === 0 || communities.some((community) => !community)) {
    return c.json({ error: "Informe nome, e-mail, senha com ao menos 6 caracteres e escolha um curso." }, 400);
  }
  const everyone = await getByPrefix("profile:");
  for (const [index, courseId] of courses.entries()) {
    if (communities[index]?.requiresApproval) continue;
    if ((await communityCapacity(courseId, everyone)).full) {
      return c.json({ error: `${communities[index]?.name ?? "Esta comunidade"} está lotada. Fale com a escola.` }, 409);
    }
  }
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name }
  });
  if (error || !data.user) return c.json({ error: error?.message ?? "Não foi possível criar a conta." }, 400);
  const profile = await profileFor(data.user);
  profile.courses = courses.filter((_, index) => !communities[index]?.requiresApproval);
  profile.pendingCourses = courses.filter((_, index) => communities[index]?.requiresApproval);
  await set(`profile:${profile.id}`, profile);
  return c.json({ id: profile.id });
});
api.get("/profile", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  return c.json(await profileFor(user));
});
api.put("/profile", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  const profile = await profileFor(user);
  const body = await c.req.json().catch(() => ({}));
  try {
    if (typeof body.name === "string" && body.name.trim()) profile.name = body.name.trim().slice(0, 60);
    if (typeof body.bio === "string") profile.bio = body.bio.slice(0, 300);
    if ("avatarDataUrl" in body) profile.avatarDataUrl = await persistProfileImage(body.avatarDataUrl, profile.avatarDataUrl, user.id, "avatar");
    if ("bannerDataUrl" in body) profile.bannerDataUrl = await persistProfileImage(body.bannerDataUrl, profile.bannerDataUrl, user.id, "banner");
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a imagem." }, 400);
  }
  await set(`profile:${user.id}`, profile);
  return c.json(profile);
});
api.post("/courses", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para participar de um curso." }, 401);
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.courseId !== "string" || !await knownCourse(body.courseId)) {
    return c.json({ error: "Curso inválido." }, 400);
  }
  const profile = await profileFor(user);
  const community = await communityFor(body.courseId);
  if (community?.requiresApproval) {
    profile.pendingCourses = [.../* @__PURE__ */ new Set([...profile.pendingCourses, body.courseId])];
    await set(`profile:${user.id}`, profile);
    return c.json(profile, 202);
  }
  if (!profile.courses.includes(body.courseId) && (await communityCapacity(body.courseId)).full) {
    return c.json({ error: `${community?.name ?? "Esta comunidade"} está lotada no momento.` }, 409);
  }
  profile.courses = [.../* @__PURE__ */ new Set([...profile.courses, body.courseId])];
  await set(`profile:${user.id}`, profile);
  return c.json(profile);
});
api.get("/users", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  const requester = await profileFor(user);
  const profiles = await getByPrefix("profile:");
  return c.json(profiles.map(({ id, email, name, role, joinedAt, avatarDataUrl }) => ({
    id,
    email: requester.role === "owner" ? email : void 0,
    avatarDataUrl,
    name,
    role,
    joinedAt
  })));
});
api.delete("/users/:id", async (c) => {
  const user = await authenticatedUser(c);
  if (!user || (await profileFor(user)).role !== "owner") {
    return c.json({ error: "Apenas o proprietário pode excluir contas." }, 403);
  }
  const targetId = c.req.param("id");
  if (!validUserId(targetId) || targetId === user.id) {
    return c.json({ error: "Não é possível excluir esta conta." }, 400);
  }
  const targetProfile = await get(`profile:${targetId}`);
  const client2 = adminClient();
  const { data: targetAuth, error: lookupError } = await client2.auth.admin.getUserById(targetId);
  if (lookupError && lookupError.status !== 404) {
    return c.json({ error: `Não foi possível verificar a conta: ${lookupError.message}` }, 400);
  }
  const targetEmail = (targetAuth.user?.email ?? targetProfile?.email ?? "").toLowerCase();
  const isOwnerAccount = targetProfile?.role === "owner" || targetEmail === OWNER_EMAIL;
  const isDuplicateOwnerAccount = user.email?.toLowerCase() === OWNER_EMAIL && targetEmail === OWNER_EMAIL && targetId !== user.id;
  if (isOwnerAccount && !isDuplicateOwnerAccount) {
    return c.json({ error: "A conta ativa do proprietário não pode ser excluída. Uma conta duplicada do proprietário só pode ser excluída por outra sessão ativa do proprietário." }, 403);
  }
  const relationships = await getByPrefix(`friend:${targetId}:`);
  const relatedUserIds = relationships.flatMap(
    (relationship) => typeof relationship.friendId === "string" && validUserId(relationship.friendId) ? [relationship.friendId] : []
  );
  const friendshipKeys = relatedUserIds.flatMap((friendId) => [
    friendshipKey(targetId, friendId),
    friendshipKey(friendId, targetId)
  ]);
  const privateMessageKeys = (await Promise.all(relatedUserIds.map(async (friendId) => {
    const prefix = privateConversationKey(targetId, friendId);
    const messages = await getByPrefix(prefix);
    return messages.map((message) => `${prefix}${message.id}`);
  }))).flat();
  const studySubjects = await getByPrefix(`study-subject:${targetId}:`);
  const gradeRecords = await getByPrefix(`grade:${targetId}:`);
  const pushSubscriptions = await getByPrefix(`push-sub:${targetId}:`);
  const essays = await getByPrefix(`essay:${targetId}:`);
  const plans = await getByPrefix(`study-plan:${targetId}:`);
  if (targetAuth.user) {
    const { error: deleteAuthError } = await client2.auth.admin.deleteUser(targetId);
    if (deleteAuthError && deleteAuthError.status !== 404) {
      return c.json({ error: `Não foi possível excluir a conta de autenticação: ${deleteAuthError.message}` }, 400);
    }
  }
  const keysToDelete = [.../* @__PURE__ */ new Set([
    `profile:${targetId}`,
    `ai-conversations:${targetId}`,
    `streak:${targetId}`,
    ...friendshipKeys,
    ...privateMessageKeys,
    ...studySubjects.map((subject) => `study-subject:${targetId}:${subject.id}`),
    ...gradeRecords.map((record) => `grade:${targetId}:${encodeURIComponent(record.subject.toLocaleLowerCase("pt-BR"))}`),
    ...pushSubscriptions.map((subscription) => subscription.key),
    `xp:${targetId}`,
    `live-index:${targetId}`,
    ...essays.map((essay) => `essay:${targetId}:${essay.id}`),
    ...plans.map((plan) => `study-plan:${targetId}:${plan.id}`)
  ])];
  for (let index = 0; index < keysToDelete.length; index += 100) {
    await mdel(keysToDelete.slice(index, index + 100));
  }
  return c.json({ ok: true });
});
api.put("/users/role", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  if ((await profileFor(user)).role !== "owner") return c.json({ error: "Apenas o proprietário pode alterar papéis." }, 403);
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role;
  if (!email || !["admin", "professor", "aluno", "responsavel"].includes(role)) return c.json({ error: "E-mail ou papel inválido." }, 400);
  const client2 = adminClient();
  let target = null;
  for (let page = 1; !target; page++) {
    const { data, error } = await client2.auth.admin.listUsers({ page, perPage: 1e3 });
    if (error) return c.json({ error: error.message }, 400);
    target = data.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
    if (target || data.users.length < 1e3) break;
  }
  if (!target) return c.json({ error: "Essa conta ainda não existe. Peça à pessoa para criar uma conta primeiro." }, 404);
  const targetProfile = await profileFor(target);
  targetProfile.role = role;
  await set(`profile:${target.id}`, targetProfile);
  return c.json({ id: target.id, email: target.email, role });
});
api.post("/users/:id/password", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  const requester = await profileFor(user);
  if (requester.role !== "owner" && requester.role !== "admin") {
    return c.json({ error: "Apenas o proprietário e a coordenação podem redefinir senhas." }, 403);
  }
  const targetId = c.req.param("id");
  if (!validUserId(targetId) || targetId === user.id) return c.json({ error: "Use a opção Trocar senha para a sua própria conta." }, 400);
  if (!withinRateLimit(`password-reset:${user.id}`, 10, 60 * 60 * 1e3)) {
    return c.json({ error: "Muitas redefinições em pouco tempo. Tente mais tarde." }, 429);
  }
  const target = await get(`profile:${targetId}`);
  if (!target) return c.json({ error: "Conta não encontrada." }, 404);
  if (target.role === "owner" || target.email?.toLowerCase() === OWNER_EMAIL) {
    return c.json({ error: "A senha do proprietário só pode ser trocada por ele mesmo." }, 403);
  }
  if (requester.role === "admin" && target.role === "admin") {
    return c.json({ error: "A coordenação não pode redefinir a senha de outra pessoa da coordenação." }, 403);
  }
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const random = crypto.getRandomValues(new Uint8Array(8));
  const password = `conecta-${[...random].map((value) => alphabet[value % alphabet.length]).join("")}`;
  const { error } = await adminClient().auth.admin.updateUserById(targetId, { password });
  if (error) return c.json({ error: `Não foi possível redefinir a senha: ${error.message}` }, 400);
  return c.json({ password });
});
api.get("/grades/:studentId", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para consultar as notas." }, 401);
  const studentId = c.req.param("studentId");
  if (!validUserId(studentId)) return c.json({ error: "Conta inválida." }, 400);
  const requester = await profileFor(user);
  const isGuardian = requester.role === "responsavel" && !!requester.children?.includes(studentId);
  if (user.id !== studentId && !isStaff(requester) && !isGuardian) {
    return c.json({ error: "Você só pode consultar suas próprias notas." }, 403);
  }
  if (!await get(`profile:${studentId}`)) return c.json({ error: "Conta não encontrada." }, 404);
  const subjects = await getByPrefix(`grade:${studentId}:`);
  return c.json({ studentId, subjects: subjects.sort((first, second) => first.subject.localeCompare(second.subject, "pt-BR")) });
});
api.put("/grades/:studentId", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para lançar notas." }, 401);
  const requester = await profileFor(user);
  if (!isStaff(requester)) {
    return c.json({ error: "Apenas professores e a administração podem lançar notas." }, 403);
  }
  const studentId = c.req.param("studentId");
  if (!validUserId(studentId)) return c.json({ error: "Conta inválida." }, 400);
  const student = await get(`profile:${studentId}`);
  if (!student || student.role !== "aluno") return c.json({ error: "Conta de aluno não encontrada." }, 404);
  const body = await c.req.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Informe a matéria e as notas das três etapas." }, 400);
  }
  const payload = body;
  const subject = typeof payload.subject === "string" ? payload.subject.trim().slice(0, 60) : "";
  const stageNames = ["1", "2", "3"];
  const assessmentNames = ["parcial", "globalizadora", "semanal", "simulado"];
  const submittedStages = payload.stages;
  if (!subject || !submittedStages || typeof submittedStages !== "object" || Array.isArray(submittedStages)) {
    return c.json({ error: "Informe a matéria e as notas das três etapas." }, 400);
  }
  const stageValues = submittedStages;
  const stages = {};
  for (const stage of stageNames) {
    const submitted = stageValues[stage];
    if (!submitted || typeof submitted !== "object" || Array.isArray(submitted)) {
      return c.json({ error: `Notas inválidas para a etapa ${stage}.` }, 400);
    }
    const assessmentValues = submitted;
    const validated = {};
    for (const assessment of assessmentNames) {
      const value = assessmentValues[assessment];
      if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100)) {
        return c.json({ error: "As notas devem estar entre 0 e 100 ou em branco." }, 400);
      }
      validated[assessment] = value;
    }
    stages[stage] = validated;
  }
  const record = {
    studentId,
    subject,
    stages,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedBy: requester.name
  };
  await set(`grade:${studentId}:${encodeURIComponent(subject.toLocaleLowerCase("pt-BR"))}`, record);
  inBackground(broadcast(userTopic(studentId), "grades", {}));
  return c.json(record);
});
var stageAverage = (stage) => {
  const values = stage ? Object.values(stage).filter((value) => typeof value === "number") : [];
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
};
var finalAverage = (stages) => {
  const weights = { "1": 1, "2": 1, "3": 2 };
  let total = 0;
  let weight = 0;
  for (const stage of ["1", "2", "3"]) {
    const average = stageAverage(stages?.[stage]);
    if (average === null) continue;
    total += average * weights[stage];
    weight += weights[stage];
  }
  return weight ? total / weight : null;
};
api.get("/reports/grades", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  if (!isStaff(await profileFor(user))) return c.json({ error: "Apenas a equipe vê o relatório." }, 403);
  const [profiles, records] = await Promise.all([
    getByPrefix("profile:"),
    getByPrefix("grade:")
  ]);
  const students = new Map(profiles.filter((profile) => profile.role === "aluno").map((profile) => [profile.id, profile]));
  const bySubject = /* @__PURE__ */ new Map();
  const atRisk = [];
  for (const record of records) {
    const student = students.get(record.studentId);
    if (!student) continue;
    const average = finalAverage(record.stages);
    if (average === null) continue;
    const list = bySubject.get(record.subject) ?? [];
    list.push(average);
    bySubject.set(record.subject, list);
    if (average < 70) atRisk.push({ studentId: student.id, name: student.name, subject: record.subject, average });
  }
  const subjects = [...bySubject.entries()].map(([subject, values]) => ({
    subject,
    students: values.length,
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    below: values.filter((value) => value < 70).length
  })).sort((first, second) => first.subject.localeCompare(second.subject, "pt-BR"));
  return c.json({
    students: students.size,
    graded: new Set(records.filter((record) => students.has(record.studentId)).map((record) => record.studentId)).size,
    subjects,
    atRisk: atRisk.sort((first, second) => first.average - second.average).slice(0, 100)
  });
});
api.get("/access-requests", async (c) => {
  const user = await authenticatedUser(c);
  if (!user || (await profileFor(user)).role !== "owner") return c.json({ error: "Apenas o proprietário pode ver solicitações." }, 403);
  const profiles = await getByPrefix("profile:");
  return c.json(profiles.flatMap(({ id, name, email, pendingCourses }) => (pendingCourses ?? []).map((communityId) => ({ id, name, email, communityId }))));
});
api.put("/access-requests/:userId", async (c) => {
  const user = await authenticatedUser(c);
  if (!user || (await profileFor(user)).role !== "owner") return c.json({ error: "Apenas o proprietário pode aprovar solicitações." }, 403);
  const userId = c.req.param("userId");
  const body = await c.req.json().catch(() => ({}));
  const communityId = typeof body.communityId === "string" ? body.communityId : "";
  const approved = body.approved === true;
  const profile = await get(`profile:${userId}`);
  if (!profile || !profile.pendingCourses?.includes(communityId)) return c.json({ error: "Solicitação não encontrada." }, 404);
  if (approved) {
    const capacity = await communityCapacity(communityId);
    if (capacity.full) {
      return c.json({ error: `A comunidade chegou ao limite de ${capacity.limit} pessoas. Aumente ou tire o limite para aceitar mais gente.`, code: "full" }, 409);
    }
  }
  profile.pendingCourses = profile.pendingCourses.filter((id) => id !== communityId);
  if (approved) profile.courses = [.../* @__PURE__ */ new Set([...profile.courses, communityId])];
  await set(`profile:${userId}`, profile);
  if (approved) {
    const community = await communityFor(communityId);
    inBackground(Promise.all([
      broadcast(userTopic(userId), "profile", {}),
      notifyUsers(/* @__PURE__ */ new Set([userId]), "messages", {
        title: "Entrada aprovada",
        body: `Você já pode conversar em ${community?.name ?? "sua comunidade"}.`,
        url: "#/conversas",
        tag: `aprovado:${communityId}`
      })
    ]));
  }
  return c.json({ ok: true });
});
api.get("/friends/search", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para encontrar pessoas." }, 401);
  const query = (c.req.query("q") ?? "").trim().toLocaleLowerCase("pt-BR");
  if (query.length < 2) return c.json([]);
  if (!withinRateLimit(`friend-search:${user.id}`, 30, 60 * 1e3)) {
    return c.json({ error: "Muitas buscas em pouco tempo. Aguarde um instante." }, 429);
  }
  const profiles = await getByPrefix("profile:");
  const people = profiles.filter((profile) => profile.id !== user.id && `${profile.name} ${profile.email}`.toLocaleLowerCase("pt-BR").includes(query)).slice(0, 20).map(({ id, name, avatarDataUrl }) => ({ id, name, avatarDataUrl }));
  return c.json(people);
});
api.get("/friends", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para acessar seus amigos." }, 401);
  const relationships = await getByPrefix(`friend:${user.id}:`);
  const me = await profileFor(user);
  const result = await Promise.all(relationships.map(async (relationship) => {
    const profile = await get(`profile:${relationship.friendId}`);
    if (!profile) return null;
    const monitored = me.role === "professor" && profile.role === "aluno" || me.role === "aluno" && profile.role === "professor";
    const direction = relationship.status === "accepted" ? "accepted" : relationship.requestedBy === user.id ? "outgoing" : "incoming";
    return {
      ...relationship,
      direction,
      ...direction === "accepted" ? { realtimeTopic: await dmTopic(user.id, relationship.friendId) } : {},
      ...monitored ? { monitored: true } : {},
      friend: { id: profile.id, name: profile.name, avatarDataUrl: profile.avatarDataUrl, role: profile.role }
    };
  }));
  return c.json(result.filter(Boolean).sort((first, second) => first.friend.name.localeCompare(second.friend.name, "pt-BR")));
});
api.post("/friends", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para adicionar amigos." }, 401);
  const body = await c.req.json().catch(() => ({}));
  const friendId = typeof body.userId === "string" ? body.userId : "";
  if (!validUserId(friendId) || friendId === user.id) return c.json({ error: "Pessoa inválida." }, 400);
  const target = await get(`profile:${friendId}`);
  if (!target) return c.json({ error: "Esta pessoa não foi encontrada." }, 404);
  const ownKey = friendshipKey(user.id, friendId);
  const reverseKey = friendshipKey(friendId, user.id);
  const existing = await get(ownKey);
  const reverse = await get(reverseKey);
  if (existing?.status === "accepted" || reverse?.status === "accepted") return c.json({ error: "Vocês já são amigos." }, 409);
  if (existing || reverse) return c.json({ error: "Já existe um pedido de amizade entre vocês." }, 409);
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const outgoing = { userId: user.id, friendId, requestedBy: user.id, status: "pending", createdAt };
  const incoming = { userId: friendId, friendId: user.id, requestedBy: user.id, status: "pending", createdAt };
  await Promise.all([set(ownKey, outgoing), set(reverseKey, incoming)]);
  const profile = await profileFor(user);
  inBackground(Promise.all([
    broadcast(userTopic(friendId), "friends", {}),
    notifyUsers(/* @__PURE__ */ new Set([friendId]), "dms", { title: "Novo pedido de amizade", body: `${profile.name} quer ser seu amigo no Conecta.`, url: "#/conversas/amigos", tag: `amizade:${user.id}` })
  ]));
  return c.json({ ok: true }, 201);
});
api.put("/friends/:id", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para responder ao pedido." }, 401);
  const friendId = c.req.param("id");
  if (!validUserId(friendId) || friendId === user.id) return c.json({ error: "Pessoa inválida." }, 400);
  const body = await c.req.json().catch(() => ({}));
  const action = body.action;
  if (action !== "accept" && action !== "decline") return c.json({ error: "Resposta inválida." }, 400);
  const ownKey = friendshipKey(user.id, friendId);
  const reverseKey = friendshipKey(friendId, user.id);
  const relationship = await get(ownKey);
  const reverseRelationship = await get(reverseKey);
  if (!relationship || relationship.status !== "pending") return c.json({ error: "Pedido não encontrado." }, 404);
  if (!reverseRelationship) return c.json({ error: "Pedido inconsistente." }, 409);
  if (action === "accept" && relationship.requestedBy === user.id) return c.json({ error: "Somente quem recebeu o pedido pode aceitá-lo." }, 403);
  if (action === "decline") {
    await Promise.all([del(ownKey), del(reverseKey)]);
    inBackground(broadcast(userTopic(friendId), "friends", {}));
    return c.json({ ok: true });
  }
  await Promise.all([
    set(ownKey, { ...relationship, status: "accepted" }),
    set(reverseKey, { ...reverseRelationship, status: "accepted" })
  ]);
  const profile = await profileFor(user);
  inBackground(Promise.all([
    broadcast(userTopic(friendId), "friends", {}),
    notifyUsers(/* @__PURE__ */ new Set([friendId]), "dms", { title: "Pedido aceito", body: `${profile.name} aceitou seu pedido de amizade.`, url: `#/conversas/amigo/${user.id}`, tag: `amizade:${user.id}` })
  ]));
  return c.json({ ok: true });
});
api.delete("/friends/:id", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para remover um amigo." }, 401);
  const friendId = c.req.param("id");
  if (!validUserId(friendId) || friendId === user.id) return c.json({ error: "Pessoa inválida." }, 400);
  const ownKey = friendshipKey(user.id, friendId);
  const reverseKey = friendshipKey(friendId, user.id);
  if (!await get(ownKey)) return c.json({ error: "Amizade não encontrada." }, 404);
  await Promise.all([del(ownKey), del(reverseKey)]);
  inBackground(broadcast(userTopic(friendId), "friends", {}));
  return c.json({ ok: true });
});
api.get("/friends/:id/messages", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para acessar suas mensagens privadas." }, 401);
  const friendId = c.req.param("id");
  if (!validUserId(friendId)) return c.json({ error: "Pessoa inválida." }, 400);
  const friendship = await get(friendshipKey(user.id, friendId));
  if (friendship?.status !== "accepted") {
    return c.json({ error: "Mensagens privadas disponíveis apenas entre amigos." }, 403);
  }
  const messages = await getByPrefix(privateConversationKey(user.id, friendId));
  return c.json(messages.sort((first, second) => first.createdAt.localeCompare(second.createdAt)));
});
api.post("/friends/:id/messages", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para enviar mensagens privadas." }, 401);
  const friendId = c.req.param("id");
  if (!validUserId(friendId)) return c.json({ error: "Pessoa inválida." }, 400);
  const friendship = await get(friendshipKey(user.id, friendId));
  if (friendship?.status !== "accepted") {
    return c.json({ error: "Mensagens privadas disponíveis apenas entre amigos." }, 403);
  }
  if (!withinRateLimit(`private-message:${user.id}:${friendId}`, 30, 60 * 1e3)) {
    return c.json({ error: "Muitas mensagens em pouco tempo. Aguarde um instante." }, 429);
  }
  const body = await c.req.json().catch(() => ({}));
  const typed = typeof body.text === "string" ? body.text.trim().slice(0, 2e3) : "";
  if (!typed) return c.json({ error: "Escreva uma mensagem antes de enviar." }, 400);
  const profile = await profileFor(user);
  const checked = moderate(typed);
  if (checked.action === "block") {
    await fileFilterReport(profile, typed, checked.category, "Conversa privada");
    return c.json({ error: BLOCK_MESSAGE[checked.category], code: "blocked" }, 422);
  }
  const content = checked.text;
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const message = {
    id: crypto.randomUUID(),
    userId: user.id,
    author: profile.name,
    avatar: profile.avatarDataUrl ?? "",
    text: content,
    time: new Date(createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    createdAt
  };
  await set(`${privateConversationKey(user.id, friendId)}${message.id}`, message);
  inBackground(Promise.all([
    broadcast(dmTopic(user.id, friendId), "dm", { from: user.id }),
    broadcast(userTopic(friendId), "dm", { from: user.id }),
    notifyUsers(/* @__PURE__ */ new Set([friendId]), "dms", { title: profile.name, body: content.slice(0, 180), url: `#/conversas/amigo/${user.id}`, tag: `dm:${user.id}` })
  ]));
  return c.json(message, 201);
});
api.get("/calendar", async (c) => {
  const events = await getByPrefix("calendar-event:");
  return c.json(events.sort(
    (first, second) => first.date.localeCompare(second.date) || first.time.localeCompare(second.time)
  ));
});
api.post("/calendar", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para adicionar ao calendário." }, 401);
  const profile = await profileFor(user);
  if (!isStaff(profile)) {
    return c.json({ error: "Apenas professores, administradores e o proprietário podem adicionar ao calendário." }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 60) : "";
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 180) : "";
  const kind = body.kind === "topic" ? "topic" : body.kind === "event" ? "event" : "exam";
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`) : null;
  const validDate = !!parsedDate && !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
  if (!subject || !topic || !validDate || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return c.json({ error: "Informe uma categoria, descrição, data e horário válidos." }, 400);
  }
  const event = {
    id: crypto.randomUUID(),
    subject,
    topic,
    kind,
    date,
    time,
    createdBy: profile.name
  };
  await set(`calendar-event:${event.id}`, event);
  const when = (/* @__PURE__ */ new Date(`${date}T12:00:00.000Z`)).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  const label = kind === "exam" ? "Prova marcada" : kind === "topic" ? "Assunto novo" : "Evento na agenda";
  inBackground(Promise.all([
    broadcast(AGENDA_TOPIC, "calendar", {}),
    notifyUsers(null, "agenda", { title: `${label}: ${subject}`, body: `${topic} · ${when} às ${time}`, url: `#/agenda/dia/${date}`, tag: `agenda:${event.id}` }, user.id)
  ]));
  return c.json(event, 201);
});
api.delete("/calendar/:id", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para remover um evento do calendário." }, 401);
  const profile = await profileFor(user);
  if (!isStaff(profile)) {
    return c.json({ error: "Apenas professores, administradores e o proprietário podem remover eventos." }, 403);
  }
  const id = c.req.param("id");
  if (!validId(id)) return c.json({ error: "Evento inválido." }, 400);
  const key = `calendar-event:${id}`;
  if (!await get(key)) return c.json({ error: "Evento não encontrado." }, 404);
  await del(key);
  inBackground(broadcast(AGENDA_TOPIC, "calendar", {}));
  return c.json({ ok: true });
});
var publicTask = (task, viewerId, staff) => {
  const { doneBy, ...rest } = task;
  return { ...rest, done: doneBy.includes(viewerId), doneCount: staff ? doneBy.length : void 0, doneBy: staff ? doneBy : void 0 };
};
api.get("/tasks", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para ver as tarefas." }, 401);
  const profile = await profileFor(user);
  const tasks = await getByPrefix("task:");
  return c.json(tasks.filter((task) => task && validDay(task.dueDate)).sort((first, second) => first.dueDate.localeCompare(second.dueDate) || first.createdAt.localeCompare(second.createdAt)).map((task) => publicTask({ ...task, doneBy: Array.isArray(task.doneBy) ? task.doneBy : [] }, user.id, isStaff(profile))));
});
api.post("/tasks", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para criar tarefas." }, 401);
  const profile = await profileFor(user);
  if (!isStaff(profile)) return c.json({ error: "Apenas a equipe passa tarefas." }, 403);
  const body = await c.req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1e3) : "";
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 60) : "";
  const dueDate = body.dueDate;
  if (!title || !subject || !validDay(dueDate)) return c.json({ error: "Informe título, matéria e prazo." }, 400);
  const task = {
    id: crypto.randomUUID(),
    title,
    description,
    subject,
    dueDate,
    createdBy: profile.name,
    createdById: profile.id,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    doneBy: []
  };
  await set(`task:${task.id}`, task);
  const when = (/* @__PURE__ */ new Date(`${dueDate}T12:00:00.000Z`)).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  inBackground(Promise.all([
    broadcast(AGENDA_TOPIC, "tasks", {}),
    notifyUsers(null, "agenda", { title: `Tarefa nova de ${subject}`, body: `${title} · entrega até ${when}`, url: "#/agenda/tarefas", tag: `tarefa:${task.id}` }, user.id)
  ]));
  return c.json(publicTask(task, user.id, true), 201);
});
api.delete("/tasks/:id", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  if (!isStaff(await profileFor(user))) return c.json({ error: "Apenas a equipe remove tarefas." }, 403);
  const id = c.req.param("id");
  if (!validId(id) || !await get(`task:${id}`)) return c.json({ error: "Tarefa não encontrada." }, 404);
  await del(`task:${id}`);
  inBackground(broadcast(AGENDA_TOPIC, "tasks", {}));
  return c.json({ ok: true });
});
api.post("/tasks/:id/done", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  const id = c.req.param("id");
  const task = validId(id) ? await get(`task:${id}`) : void 0;
  if (!task) return c.json({ error: "Tarefa não encontrada." }, 404);
  const body = await c.req.json().catch(() => ({}));
  const doneBy = new Set(Array.isArray(task.doneBy) ? task.doneBy : []);
  if (body.done === false) doneBy.delete(user.id);
  else doneBy.add(user.id);
  const updated = { ...task, doneBy: [...doneBy] };
  await set(`task:${id}`, updated);
  const xp = body.done === false ? null : await awardXP(user.id, 10, { once: `task:${id}`, counters: { tasks: 1 }, stats: { tasks: 1 }, subject: task.subject, subjectPoints: 2 });
  return c.json({ ...publicTask(updated, user.id, isStaff(await profileFor(user))), xp });
});
api.get("/study-subjects", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para acessar suas matérias e fichas." }, 401);
  const subjects = await getByPrefix(`study-subject:${user.id}:`);
  return c.json(subjects.sort((first, second) => first.name.localeCompare(second.name, "pt-BR")));
});
api.post("/study-subjects", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para criar uma matéria." }, 401);
  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return c.json({ error: "Informe o nome da matéria." }, 400);
  const subject = {
    id: crypto.randomUUID(),
    name,
    topics: [],
    flashcards: [],
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await set(`study-subject:${user.id}:${subject.id}`, subject);
  return c.json(subject, 201);
});
api.post("/study-subjects/:id/topics", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para adicionar assuntos." }, 401);
  const id = c.req.param("id");
  if (!validId(id)) return c.json({ error: "Matéria inválida." }, 400);
  const key = `study-subject:${user.id}:${id}`;
  const subject = await get(key);
  if (!subject) return c.json({ error: "Matéria não encontrada." }, 404);
  if (subject.topics.length >= 100) return c.json({ error: "Esta matéria já atingiu o limite de assuntos." }, 400);
  const body = await c.req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 4e3) : "";
  if (!title) return c.json({ error: "Informe o título do assunto." }, 400);
  subject.topics.push({ id: crypto.randomUUID(), title, notes });
  await set(key, subject);
  return c.json(subject);
});
api.post("/study-subjects/:id/cards", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para criar fichas." }, 401);
  const id = c.req.param("id");
  if (!validId(id)) return c.json({ error: "Matéria inválida." }, 400);
  const key = `study-subject:${user.id}:${id}`;
  const subject = await get(key);
  if (!subject) return c.json({ error: "Matéria não encontrada." }, 404);
  if (subject.flashcards.length >= 100) return c.json({ error: "Esta matéria já atingiu o limite de fichas." }, 400);
  const body = await c.req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  const answer = typeof body.answer === "string" ? body.answer.trim().slice(0, 1e3) : "";
  if (!question || !answer) return c.json({ error: "Preencha a pergunta e a resposta da ficha." }, 400);
  subject.flashcards.push({ id: crypto.randomUUID(), question, answer });
  await set(key, subject);
  return c.json(subject);
});
var REVIEW_GAPS = [0, 1, 2, 4, 8, 16, 32];
var visibleStreak = (streak, today) => {
  if (!streak) return { current: 0, best: 0, lastDate: "" };
  const alive = streak.lastDate === today || streak.lastDate === addDays(today, -1);
  return { ...streak, current: alive ? streak.current : 0 };
};
api.post("/study-subjects/:id/cards/:cardId/review", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para revisar fichas." }, 401);
  const id = c.req.param("id");
  const cardId = c.req.param("cardId");
  if (!validId(id) || !validId(cardId)) return c.json({ error: "Ficha inválida." }, 400);
  const body = await c.req.json().catch(() => ({}));
  const result = body.result;
  if (!["again", "good", "easy"].includes(result)) return c.json({ error: "Resultado inválido." }, 400);
  const today = validDay(body.today) && Math.abs(Date.parse(`${body.today}T12:00:00Z`) - Date.now()) < 2 * 864e5 ? body.today : schoolToday();
  const key = `study-subject:${user.id}:${id}`;
  const subject = await get(key);
  const card = subject?.flashcards.find((item) => item.id === cardId);
  if (!subject || !card) return c.json({ error: "Ficha não encontrada." }, 404);
  const box = result === "again" ? 1 : Math.min(REVIEW_GAPS.length - 1, (card.review?.box ?? 0) + (result === "easy" ? 2 : 1));
  card.review = { box, due: addDays(today, result === "again" ? 1 : REVIEW_GAPS[box]), last: today };
  await set(key, subject);
  const streak = await touchStreak(user.id, today);
  const xp = await awardXP(user.id, result === "again" ? 1 : 2, {
    counters: { reviews: 1 },
    best: { bestStreak: streak.best },
    stats: { reviews: 1 },
    subject: subject.name,
    subjectPoints: 1,
    dailyCap: { key: "reviews", max: 200 }
  });
  return c.json({ subject, streak, xp });
});
api.get("/streak", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  const today = validDay(c.req.query("today")) ? c.req.query("today") : schoolToday();
  return c.json(visibleStreak(await get(`streak:${user.id}`), today));
});
api.delete("/study-subjects/:id/items/:itemId", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para remover itens de estudo." }, 401);
  const id = c.req.param("id");
  const itemId = c.req.param("itemId");
  const kind = c.req.query("kind");
  if (!validId(id) || !validId(itemId) || !["topic", "card"].includes(kind ?? "")) {
    return c.json({ error: "Item inválido." }, 400);
  }
  const key = `study-subject:${user.id}:${id}`;
  const subject = await get(key);
  if (!subject) return c.json({ error: "Matéria não encontrada." }, 404);
  if (kind === "topic") subject.topics = subject.topics.filter((topic) => topic.id !== itemId);
  else subject.flashcards = subject.flashcards.filter((card) => card.id !== itemId);
  await set(key, subject);
  return c.json(subject);
});
api.delete("/study-subjects/:id", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para remover uma matéria." }, 401);
  const id = c.req.param("id");
  if (!validId(id)) return c.json({ error: "Matéria inválida." }, 400);
  const key = `study-subject:${user.id}:${id}`;
  if (!await get(key)) return c.json({ error: "Matéria não encontrada." }, 404);
  await del(key);
  return c.json({ ok: true });
});
api.get("/messages", async (c) => {
  const channel = c.req.query("channel") ?? "";
  const access = await memberProfile(c, channel);
  if (!access.ok) return access.response;
  const items = await getByPrefix(`message:${channel}:`);
  return c.json(await withMedia(items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))));
});
async function memberProfile(c, channel) {
  const user = await authenticatedUser(c);
  if (!user) return { ok: false, response: c.json({ error: "Sessão inválida." }, 401) };
  if (!await validMessageChannel(channel)) return { ok: false, response: c.json({ error: "Canal inválido." }, 400) };
  const profile = await profileFor(user);
  const courseId = channel.split("::")[0];
  if (!profile.courses.includes(courseId) && !isStaff(profile)) {
    return { ok: false, response: c.json({ error: "Entre neste curso antes de participar." }, 403) };
  }
  return { ok: true, user, profile };
}
function changed(channel, kind, id) {
  inBackground(broadcast(channelTopic(channel), "messages", { channel, kind, id }));
}
api.post("/messages", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para enviar mensagens." }, 401);
  const body = await c.req.json().catch(() => ({}));
  const channel = typeof body.channel === "string" ? body.channel : "";
  const typed = typeof body.text === "string" ? body.text.trim().slice(0, 2e3) : "";
  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
  const courseId = channel.split("::")[0];
  const pollInput = body.poll && typeof body.poll === "object" ? body.poll : null;
  const pollQuestion = typeof pollInput?.question === "string" ? pollInput.question.trim().slice(0, 200) : "";
  const pollOptions = Array.isArray(pollInput?.options) ? [...new Set(pollInput.options.filter((option) => typeof option === "string").map((option) => option.trim().slice(0, 80)).filter(Boolean))].slice(0, 6) : [];
  if (pollInput && (!pollQuestion || pollOptions.length < 2)) return c.json({ error: "A enquete precisa de uma pergunta e pelo menos duas opções." }, 400);
  if (!await validMessageChannel(channel) || !await knownCourse(courseId) || !typed && !imageDataUrl && !pollInput) {
    return c.json({ error: "Canal ou mensagem inválidos." }, 400);
  }
  if (imageDataUrl && !validImageDataUrl(imageDataUrl)) return c.json({ error: "A imagem é inválida ou maior que 1,5 MB." }, 400);
  const profile = await profileFor(user);
  if (!profile.courses.includes(courseId) && !isStaff(profile)) {
    return c.json({ error: "Entre neste curso antes de enviar mensagens." }, 403);
  }
  if (!withinRateLimit(`message:${user.id}`, 40, 60 * 1e3)) {
    return c.json({ error: "Muitas mensagens em pouco tempo. Aguarde um instante." }, 429);
  }
  const checked = moderate([typed, pollQuestion, ...pollOptions].join("\n"));
  if (checked.action === "block") {
    const community2 = await communityFor(courseId);
    const channelName2 = community2?.channels?.find((item) => item.id === channel.split("::")[1])?.name ?? channel.split("::")[1];
    await fileFilterReport(profile, [typed, pollQuestion].filter(Boolean).join(" · "), checked.category, `#${channelName2} · ${community2?.name ?? courseId}`);
    return c.json({ error: BLOCK_MESSAGE[checked.category], code: "blocked" }, 422);
  }
  const content = moderate(typed).text;
  const cleanQuestion = moderate(pollQuestion).text;
  const cleanOptions = pollOptions.map((option) => moderate(option).text);
  let replyTo;
  if (typeof body.replyTo === "string" && validId(body.replyTo)) {
    const original = await get(`message:${channel}:${body.replyTo}`);
    if (original) replyTo = { id: original.id, author: original.author, text: (original.text || original.poll?.question || "").slice(0, 160), hasImage: !!original.imageUrl };
  }
  let imagePath;
  try {
    imagePath = imageDataUrl ? await storePrivateImage(imageDataUrl, user.id, `messages/${courseId}`) : void 0;
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a imagem." }, 400);
  }
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const message = {
    id: crypto.randomUUID(),
    channel,
    author: profile.name,
    avatar: profile.avatarDataUrl ?? "",
    text: content || (pollInput ? cleanQuestion : ""),
    ...imagePath ? { imagePath } : {},
    time: new Date(createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    userId: profile.id,
    createdAt,
    ...replyTo ? { replyTo } : {},
    ...pollInput ? { poll: { question: cleanQuestion, options: cleanOptions.map((option) => ({ id: crypto.randomUUID().slice(0, 8), text: option, votes: [] })) } } : {},
    ...body.requiresAck === true && isStaff(profile) ? { requiresAck: true, acks: [] } : {}
  };
  await set(`message:${channel}:${message.id}`, message);
  changed(channel, "new", message.id);
  const community = await communityFor(courseId);
  const channelName = community?.channels?.find((item) => item.id === channel.split("::")[1])?.name ?? channel.split("::")[1];
  inBackground(communityMembers(courseId).then(
    (members) => notifyUsers(members, "messages", {
      title: `#${channelName} · ${community?.name ?? courseId}`,
      body: `${profile.name}: ${message.poll ? `📊 ${message.poll.question}` : message.text || "📷 Imagem"}`.slice(0, 200),
      url: `#/conversas/canal/${courseId}/${channel.split("::")[1]}`,
      tag: `canal:${channel}`
    }, user.id)
  ));
  return c.json(await withOneMedia(message));
});
api.patch("/messages/:id", async (c) => {
  const channel = c.req.query("channel") ?? "";
  const id = c.req.param("id");
  if (!validId(id)) return c.json({ error: "Mensagem inválida." }, 400);
  const access = await memberProfile(c, channel);
  if (!access.ok) return access.response;
  const key = `message:${channel}:${id}`;
  const message = await get(key);
  if (!message) return c.json({ error: "Mensagem não encontrada." }, 404);
  if (message.userId !== access.user.id) return c.json({ error: "Você só pode editar as suas mensagens." }, 403);
  const body = await c.req.json().catch(() => ({}));
  const typed = typeof body.text === "string" ? body.text.trim().slice(0, 2e3) : "";
  if (!typed && !message.imageUrl) return c.json({ error: "A mensagem não pode ficar vazia." }, 400);
  const checked = moderate(typed);
  if (checked.action === "block") {
    await fileFilterReport(access.profile, typed, checked.category, "Mensagem editada num canal");
    return c.json({ error: BLOCK_MESSAGE[checked.category], code: "blocked" }, 422);
  }
  const content = checked.text;
  const updated = { ...message, text: content, editedAt: (/* @__PURE__ */ new Date()).toISOString() };
  await set(key, updated);
  changed(channel, "edit", id);
  return c.json(await withOneMedia(updated));
});
api.delete("/messages/:id", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  const channel = c.req.query("channel") ?? "";
  const id = c.req.param("id");
  if (!await validMessageChannel(channel) || !validId(id)) return c.json({ error: "Canal ou mensagem inválidos." }, 400);
  const key = `message:${channel}:${id}`;
  const message = await get(key);
  if (!message) return c.json({ error: "Mensagem não encontrada." }, 404);
  const profile = await profileFor(user);
  if (message.userId !== user.id && !isStaff(profile)) {
    return c.json({ error: "Você não pode apagar esta mensagem." }, 403);
  }
  await del(key);
  await removePrivateImage(message.imagePath);
  changed(channel, "delete", id);
  return c.json({ ok: true });
});
api.post("/messages/:id/pin", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  const channel = c.req.query("channel") ?? "";
  const id = c.req.param("id");
  if (!await validMessageChannel(channel) || !validId(id)) return c.json({ error: "Canal ou mensagem inválidos." }, 400);
  const profile = await profileFor(user);
  if (!isStaff(profile)) return c.json({ error: "Apenas professores e a gestão podem fixar mensagens." }, 403);
  const body = await c.req.json().catch(() => ({}));
  const durationDays = body && typeof body === "object" ? body.durationDays : void 0;
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 7) {
    return c.json({ error: "A duração da fixação deve ser de 1 a 7 dias." }, 400);
  }
  const key = `message:${channel}:${id}`;
  const message = await get(key);
  if (!message) return c.json({ error: "Mensagem não encontrada." }, 404);
  const pinned = { ...message, pinnedUntil: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1e3).toISOString() };
  await set(key, pinned);
  changed(channel, "pin", id);
  return c.json(await withOneMedia(pinned));
});
api.delete("/messages/:id/pin", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  const channel = c.req.query("channel") ?? "";
  const id = c.req.param("id");
  if (!await validMessageChannel(channel) || !validId(id)) return c.json({ error: "Canal ou mensagem inválidos." }, 400);
  const profile = await profileFor(user);
  if (!isStaff(profile)) return c.json({ error: "Apenas professores e a gestão podem desafixar mensagens." }, 403);
  const key = `message:${channel}:${id}`;
  const message = await get(key);
  if (!message) return c.json({ error: "Mensagem não encontrada." }, 404);
  const { pinnedUntil: _pinnedUntil, ...unpinned } = message;
  await set(key, unpinned);
  changed(channel, "unpin", id);
  return c.json(await withOneMedia(unpinned));
});
api.post("/messages/:id/reactions", async (c) => {
  const channel = c.req.query("channel") ?? "";
  const id = c.req.param("id");
  if (!validId(id)) return c.json({ error: "Mensagem inválida." }, 400);
  const access = await memberProfile(c, channel);
  if (!access.ok) return access.response;
  const body = await c.req.json().catch(() => ({}));
  const emoji = typeof body.emoji === "string" ? body.emoji : "";
  if (!REACTIONS.includes(emoji)) return c.json({ error: "Reação inválida." }, 400);
  if (!withinRateLimit(`reaction:${access.user.id}`, 60, 60 * 1e3)) return c.json({ error: "Calma! Muitas reações seguidas." }, 429);
  const key = `message:${channel}:${id}`;
  const message = await get(key);
  if (!message) return c.json({ error: "Mensagem não encontrada." }, 404);
  const reactions = { ...message.reactions ?? {} };
  const people = new Set(reactions[emoji] ?? []);
  if (people.has(access.user.id)) people.delete(access.user.id);
  else people.add(access.user.id);
  if (people.size) reactions[emoji] = [...people];
  else delete reactions[emoji];
  const updated = { ...message, reactions };
  await set(key, updated);
  changed(channel, "reaction", id);
  return c.json(await withOneMedia(updated));
});
api.post("/messages/:id/vote", async (c) => {
  const channel = c.req.query("channel") ?? "";
  const id = c.req.param("id");
  if (!validId(id)) return c.json({ error: "Mensagem inválida." }, 400);
  const access = await memberProfile(c, channel);
  if (!access.ok) return access.response;
  const body = await c.req.json().catch(() => ({}));
  const optionId = typeof body.optionId === "string" ? body.optionId : "";
  const key = `message:${channel}:${id}`;
  const message = await get(key);
  if (!message?.poll) return c.json({ error: "Enquete não encontrada." }, 404);
  if (!message.poll.options.some((option) => option.id === optionId)) return c.json({ error: "Opção inválida." }, 400);
  const already = message.poll.options.find((option) => option.id === optionId)?.votes.includes(access.user.id);
  const options = message.poll.options.map((option) => ({
    ...option,
    votes: option.votes.filter((voter) => voter !== access.user.id).concat(option.id === optionId && !already ? [access.user.id] : [])
  }));
  const updated = { ...message, poll: { ...message.poll, options } };
  await set(key, updated);
  changed(channel, "vote", id);
  return c.json(await withOneMedia(updated));
});
api.post("/messages/:id/ack", async (c) => {
  const channel = c.req.query("channel") ?? "";
  const id = c.req.param("id");
  if (!validId(id)) return c.json({ error: "Mensagem inválida." }, 400);
  const access = await memberProfile(c, channel);
  if (!access.ok) return access.response;
  const key = `message:${channel}:${id}`;
  const message = await get(key);
  if (!message?.requiresAck) return c.json({ error: "Este aviso não pede confirmação." }, 404);
  const acks = new Set(message.acks ?? []);
  acks.add(access.user.id);
  const updated = { ...message, acks: [...acks] };
  await set(key, updated);
  changed(channel, "ack", id);
  return c.json(await withOneMedia(updated));
});
api.get("/push/key", async (c) => {
  try {
    return c.json({ publicKey: (await vapidKeys()).publicKey });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Notificações indisponíveis no momento." }, 500);
  }
});
var pushKey = async (userId, endpoint) => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", text(endpoint)));
  return `push-sub:${userId}:${[...digest.slice(0, 12)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
};
api.post("/push/subscribe", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Entre para ativar as notificações." }, 401);
  const body = await c.req.json().catch(() => ({}));
  const subscription = body.subscription ?? {};
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;
  if (!validPushEndpoint(endpoint) || typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) {
    return c.json({ error: "Este navegador enviou uma inscrição inválida." }, 400);
  }
  const prefs = body.prefs ?? {};
  const record = {
    key: await pushKey(user.id, endpoint),
    userId: user.id,
    endpoint,
    keys: { p256dh, auth },
    prefs: { messages: prefs.messages !== false, dms: prefs.dms !== false, agenda: prefs.agenda !== false },
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const existing = await getByPrefix(`push-sub:${user.id}:`);
  if (existing.length >= 10 && !existing.some((item) => item.key === record.key)) {
    await del(existing.sort((first, second) => first.createdAt.localeCompare(second.createdAt))[0].key);
  }
  await set(record.key, record);
  return c.json({ ok: true, prefs: record.prefs });
});
api.post("/push/unsubscribe", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.endpoint === "string") await del(await pushKey(user.id, body.endpoint));
  return c.json({ ok: true });
});
api.post("/push/test", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  if (!withinRateLimit(`push-test:${user.id}`, 3, 60 * 1e3)) return c.json({ error: "Aguarde um pouco para testar de novo." }, 429);
  const subscriptions = await getByPrefix(`push-sub:${user.id}:`);
  if (!subscriptions.length) return c.json({ error: "Nenhum aparelho com notificações ativadas." }, 404);
  const results = await Promise.allSettled(subscriptions.map((item) => sendPush(item, { title: "Conecta", body: "Pronto! As notificações estão funcionando neste aparelho.", url: "#/inicio", tag: "teste" })));
  return c.json({ sent: results.filter((result) => result.status === "fulfilled").length });
});
var validConversation = (item) => item && typeof item.id === "string" && item.id.length <= 80 && typeof item.title === "string" && typeof item.updatedAt === "string" && Array.isArray(item.messages) && Array.isArray(item.history);
api.get("/ai-conversations", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  const stored = await get(`ai-conversations:${user.id}`);
  return c.json(stored ?? { conversations: [], updatedAt: null });
});
api.put("/ai-conversations", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Sessão inválida." }, 401);
  const body = await c.req.json().catch(() => ({}));
  const list = Array.isArray(body.conversations) ? body.conversations.filter(validConversation) : null;
  if (!list) return c.json({ error: "Conversas inválidas." }, 400);
  const trimmed = list.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)).slice(0, 30).map((item) => ({
    id: item.id,
    title: item.title.slice(0, 80),
    updatedAt: item.updatedAt,
    messages: item.messages.slice(-60).map((message) => ({
      id: String(message.id ?? "").slice(0, 80),
      author: String(message.author ?? "").slice(0, 80),
      avatar: String(message.avatar ?? "").slice(0, 8),
      text: String(message.text ?? "").slice(0, 8e3),
      time: String(message.time ?? "").slice(0, 10),
      ...message.isAI ? { isAI: true } : {},
      ...Array.isArray(message.images) ? { images: message.images.filter((image) => typeof image === "string" && image.length <= 6e4 && /^data:image\/(jpeg|png|webp);base64,/.test(image)).slice(0, 3) } : {}
    })),
    history: item.history.slice(-24).map((entry) => ({ role: entry.role === "assistant" ? "assistant" : "user", content: String(entry.content ?? "").slice(0, 8e3) }))
  }));
  let payload = { conversations: trimmed, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  while (JSON.stringify(payload).length > 45e4 && payload.conversations.length > 1) {
    payload = { ...payload, conversations: payload.conversations.slice(0, -1) };
  }
  await set(`ai-conversations:${user.id}`, payload);
  return c.json({ ok: true, updatedAt: payload.updatedAt, count: payload.conversations.length });
});
registerStudy(api);
registerSchool(api);
registerGames(api);
registerFamily(api);
var app = new Hono();
app.route("/conecta-api", api);
app.route("/make-server-b92ddf44", api);
Deno.serve(app.fetch);
