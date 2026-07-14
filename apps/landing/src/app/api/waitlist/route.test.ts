import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const validEntry = {
  email: " LEARNER@example.com ",
  platform: "Mac Apple Silicon",
  workflow: "Eu salvo frases de vídeos no Anki.",
};

function request(body: unknown) {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  delete process.env.PHRASELOOP_WAITLIST_WEBHOOK_URL;
  vi.restoreAllMocks();
});

describe("POST /api/waitlist", () => {
  it.each([
    [{ ...validEntry, email: "invalid" }],
    [{ ...validEntry, platform: "Android" }],
    [{ ...validEntry, workflow: "curto" }],
    [{ email: validEntry.email }],
  ])("rejects an incomplete or invalid qualified entry", async (body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Preencha o email, o computador e como você pratica inglês hoje.",
    });
  });

  it("forwards all qualification fields to the configured webhook", async () => {
    process.env.PHRASELOOP_WAITLIST_WEBHOOK_URL = "https://example.test/waitlist";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const response = await POST(request(validEntry));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.test/waitlist");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      email: "learner@example.com",
      platform: "Mac Apple Silicon",
      workflow: validEntry.workflow,
      source: "landing",
    });
  });

  it("returns a recoverable error when the webhook rejects the entry", async () => {
    process.env.PHRASELOOP_WAITLIST_WEBHOOK_URL = "https://example.test/waitlist";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 503 }),
    );

    const response = await POST(request(validEntry));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível salvar sua inscrição agora.",
    });
  });
});
