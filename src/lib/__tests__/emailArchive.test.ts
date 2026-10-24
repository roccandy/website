import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  records: [] as Record<string, unknown>[],
  files: new Map<string, Buffer>(),
  states: [] as string[],
  failUpload: false,
  failInsert: false,
  failFinal: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient: {
    from: () => ({
      select: () => ({
        in: async () => ({
          data: [{ id: "11111111-1111-4111-8111-111111111111" }],
          error: null,
        }),
      }),
      insert: async (record: Record<string, unknown>) => {
        mocks.records.push(record);
        return { error: mocks.failInsert ? {} : null };
      },
      update: (record: { status: string }) => ({
        eq: async () => {
          mocks.states.push(record.status);
          return {
            error: mocks.failFinal && record.status !== "sending" ? {} : null,
          };
        },
      }),
    }),
    storage: {
      from: () => ({
        upload: async (path: string, bytes: Buffer) => {
          mocks.files.set(path, bytes);
          return { error: mocks.failUpload ? {} : null };
        },
        download: async (path: string) => ({
          data: { arrayBuffer: async () => mocks.files.get(path) },
          error: null,
        }),
      }),
    },
  },
}));
import {
  prepareArchivedEmail,
  readArchivedFile,
  sendArchivedEmail,
  smtpArchiveOutcome,
} from "../emailArchive";
const options = {
  from: "Roc Candy <sender@example.test>",
  to: ["customer@example.test"],
  bcc: ["orders@example.test"],
  subject: "Invoice test",
  text: "Original email text",
  html: '<p>Original <img src="cid:logo"/></p>',
  attachments: [
    {
      filename: "invoice.pdf",
      content: Buffer.from("%PDF-original"),
      contentType: "application/pdf",
    },
    {
      filename: "logo.png",
      content: Buffer.from("png-test"),
      contentType: "image/png",
      cid: "logo",
      contentDisposition: "inline" as const,
    },
  ],
};
const context = {
  kind: "invoice-pdf" as const,
  orderNumbers: ["100-a", "100-b"],
};
beforeEach(() => {
  mocks.records = [];
  mocks.states = [];
  mocks.files.clear();
  mocks.failUpload = false;
  mocks.failInsert = false;
  mocks.failFinal = false;
});
describe("Permanent email originals", () => {
  it("saves the exact MIME bytes submitted, original PDF/image bytes and all linked order numbers", async () => {
    const submit = vi.fn(async (message: { raw: Buffer }) => {
      expect(mocks.records).toHaveLength(1);
      const raw = mocks.files.get(String(mocks.records[0].raw_path));
      expect(message.raw.equals(raw!)).toBe(true);
      return { accepted: options.to };
    });
    await sendArchivedEmail(options, context, submit);
    const record = mocks.records[0];
    expect(record.order_numbers).toEqual(["100-a", "100-b"]);
    expect(record.html_body).toBe(options.html);
    expect(record.text_body).toBe(options.text);
    expect(mocks.states).toEqual(["sending", "accepted"]);
    expect(
      [...mocks.files.values()].some((bytes) =>
        bytes.equals(options.attachments[0].content),
      ),
    ).toBe(true);
    const raw = submit.mock.calls[0][0].raw.toString();
    expect(raw).not.toContain("Bcc:");
    expect(raw).toContain("Message-ID:");
  });
  it.each(["upload", "record"])(
    "does not submit an email if its %s cannot be archived",
    async (stage) => {
      mocks.failUpload = stage === "upload";
      mocks.failInsert = stage === "record";
      const submit = vi.fn();
      await expect(sendArchivedEmail(options, context, submit)).rejects.toThrow(
        "Email was not submitted",
      );
      expect(submit).not.toHaveBeenCalled();
    },
  );
  it("records uncertain SMTP errors without claiming delivery", async () => {
    await expect(
      sendArchivedEmail(options, context, async () => {
        throw new Error("Connection timed out");
      }),
    ).rejects.toThrow("Connection timed out");
    expect(mocks.states).toEqual(["sending", "unconfirmed"]);
  });
  it("does not turn an accepted submission into a duplicate-prone retry when the final DB write fails", async () => {
    mocks.failFinal = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      sendArchivedEmail(options, context, async () => ({
        accepted: options.to,
      })),
    ).resolves.toEqual({ success: true });
    log.mockRestore();
  });
  it("detects rejection of the customer even when the operational BCC was accepted", async () => {
    await expect(
      sendArchivedEmail(options, context, async () => ({
        accepted: options.bcc,
        rejected: options.to,
      })),
    ).rejects.toThrow("customer recipient was rejected");
    expect(mocks.states.at(-1)).toBe("partial");
  });
  it("rejects remote/file attachments instead of introducing server-side fetches", async () => {
    await expect(
      prepareArchivedEmail(
        { ...options, attachments: [{ path: "http://127.0.0.1/private" }] },
        context,
      ),
    ).rejects.toThrow("prepared bytes");
    expect(mocks.files.size).toBe(0);
  });
  it("verifies original-file checksums on download", async () => {
    const prepared = await prepareArchivedEmail(options, context);
    const record = mocks.records[0];
    expect(
      await readArchivedFile(
        String(record.raw_path),
        String(record.raw_sha256),
      ),
    ).toEqual(prepared.raw);
    mocks.files.set(String(record.raw_path), Buffer.from("tampered"));
    await expect(
      readArchivedFile(String(record.raw_path), String(record.raw_sha256)),
    ).rejects.toThrow("integrity");
  });
  it("does not confuse absent acceptance evidence with success", () => {
    expect(smtpArchiveOutcome({}).status).toBe("unconfirmed");
    expect(smtpArchiveOutcome({ rejected: ["a@example.test"] }).status).toBe(
      "rejected",
    );
  });
});
