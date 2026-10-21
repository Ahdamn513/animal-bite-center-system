import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This code runs on the server only. The keys below are never sent to the browser.
const SYSTEM_PROMPT = `You are the FAQ assistant of an animal bite center in the Philippines.
Give general information only. Never diagnose, never state vaccine doses, and never say that treatment is unnecessary.
For any medical decision, tell the user to talk to the center's staff.
Keep answers under 90 words. Reply in the language the user writes in (English or Filipino).`;

type Topic = { match: RegExp; en: string; fil: string };

const EMERGENCY: Topic = {
  match:
    /\b(face|head|eye|neck|mukha|ulo|mata|leeg)\b|bleeding a lot|heavy bleeding|malakas.*dugo|sobrang dugo|sick animal|rabid|may rabies|nagwawala|foaming|bumubula/i,
  en: "A bite to the face, head or neck, heavy bleeding, or a bite from a sick animal needs prompt attention. Go to the animal bite center or the nearest emergency room now.",
  fil: "Ang kagat sa mukha, ulo o leeg, matinding pagdurugo, o kagat ng may-sakit na hayop ay kailangang agad matingnan. Pumunta na po ngayon sa Animal Bite Center o sa pinakamalapit na emergency room.",
};

const TOPICS: Topic[] = [
  {
    match: /schedule|visit|dose|several|how many|follow|iskedyul|ilang beses|balik|bakuna/i,
    en: "Treatment usually needs several visits. The standard schedule is Day 0, 3, 7 and 28, with fewer visits possible if the biting animal stays healthy. Staff set your exact dates, and you can see them under My doses once your course starts.",
    fil: "Karaniwang kailangan ng ilang balik sa center. Ang karaniwang iskedyul ay Day 0, 3, 7 at 28, at maaaring mas kaunti kung nananatiling malusog ang nakakagat na hayop. Ang staff ang magtatakda ng eksaktong petsa, at makikita ninyo ito sa My doses.",
  },
  {
    match: /bring|requirement|document|\bid\b|dala|kailangan dalhin/i,
    en: "Requirements differ by center. Bring a valid ID and any earlier vaccine records, and ask the front desk if you are unsure.",
    fil: "Magkakaiba ang requirements sa bawat center. Magdala po ng valid ID at anumang dating record ng bakuna, at magtanong sa front desk kung hindi sigurado.",
  },
  {
    match: /book|slot|appointment|queue|walk|reserve|pila|oras|mag-book/i,
    en: "Open Book a slot, pick a day and time, and arrive at your slot. At the front desk, staff check you in and give you a queue number. Then watch the Queue page to see how close you are. Walk-ins are still accepted.",
    fil: "Pumunta sa Book a slot, pumili ng araw at oras, at dumating sa oras na iyon. Sa front desk, ichecheck-in kayo ng staff at bibigyan ng queue number. Pagkatapos, tingnan ang Queue page para makita kung gaano na kayo kalapit. Tinatanggap pa rin ang walk-in.",
  },
  {
    match: /cost|price|fee|free|magkano|libre|bayad/i,
    en: "I do not know this center's fees. Please ask the front desk or your local health office.",
    fil: "Hindi ko po alam ang bayarin ng center na ito. Magtanong po sa front desk o sa inyong local health office.",
  },
  {
    match: /\bbit(e|ten)?\b|scratch|nakagat|kagat|gasgas|first aid|wound|sugat|wash|hugas|what (do|should) i do/i,
    en: "First, wash the wound thoroughly with soap and running water. Then go to the nearest animal bite center so a health worker can assess whether you need vaccine. I can only give general information; the center's staff make every treatment decision.",
    fil: "Hugasan agad ang sugat nang maigi gamit ang sabon at umaagos na tubig. Pagkatapos, pumunta po sa pinakamalapit na Animal Bite Center para masuri ng health worker kung kailangan ng bakuna. Pangkalahatang impormasyon lang po ang maibibigay ko; ang staff ng center ang magdedesisyon sa gamot.",
  },
];

const FALLBACK = {
  en: "I can help with first aid after a bite, what to bring, the visit schedule and how booking works. For anything about your own treatment, please talk to the center's staff.",
  fil: "Matutulungan ko po kayo sa first aid pagkatapos ng kagat, kung ano ang dadalhin, iskedyul ng pagbalik, at kung paano mag-book. Para sa sarili ninyong gamutan, makipag-usap po sa staff ng center.",
};

function isFilipino(text: string): boolean {
  return /\b(ako|ka|po|ano|saan|paano|bakit|magkano|ilang|nakagat|kagat|mga|ang|ng|sa)\b/i.test(
    text
  );
}

function faqReply(message: string): string {
  const lang = isFilipino(message) ? "fil" : "en";
  if (EMERGENCY.match.test(message)) return EMERGENCY[lang];
  const topic = TOPICS.find((t) => t.match.test(message));
  return (topic ?? FALLBACK)[lang];
}

async function aiReply(message: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL ?? "claude-haiku-5-5",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: message }],
      }),
    });
    if (!res.ok) return null;
    const data: { content?: { type: string; text?: string }[] } = await res.json();
    const text = data.content?.find((b) => b.type === "text")?.text;
    return text?.trim() || null;
  } catch {
    return null;
  }
}

async function logChat(question: string, answer: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return; // Logging is optional.
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  await admin.from("chat_logs").insert({ question, answer });
}

export async function POST(request: Request) {
  let message = "";
  try {
    const body = await request.json();
    message = String(body.message ?? "").trim().slice(0, 500);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Type a question first." }, { status: 400 });
  }

  // Safety rule: emergencies always get the fixed reply, never the AI.
  const emergency = EMERGENCY.match.test(message);
  const apiKey = process.env.AI_API_KEY;

  let reply: string | null = null;
  let mode: "ai" | "faq" = "faq";
  if (apiKey && !emergency) {
    reply = await aiReply(message, apiKey);
    if (reply) mode = "ai";
  }
  if (!reply) reply = faqReply(message);

  await logChat(message, reply).catch(() => {});
  return NextResponse.json({ reply, mode });
}
