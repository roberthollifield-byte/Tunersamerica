import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.RESEND_FROM || "TunersAmerica <hello@tunersamerica.com>";
const publicUrl = (process.env.PUBLIC_URL || "https://tunersamerica.com").replace(/\/+$/, "");

const resend = apiKey ? new Resend(apiKey) : null;

export const emailEnabled = !!resend;

export async function sendMagicLinkEmail(opts: {
  to: string;
  name?: string | null;
  token: string;
  role?: string | null;
}) {
  // Hash route — the SPA reads the token client-side and redirects to the right dashboard.
  const link = `${publicUrl}/#/auth/callback?token=${encodeURIComponent(opts.token)}`;

  if (!resend) {
    // Dev / unconfigured fallback — log it so local sign-in still works.
    // eslint-disable-next-line no-console
    console.log(`[magic-link] (no RESEND_API_KEY) ${opts.to}: ${link}`);
    return { sent: false, link };
  }

  const greeting = opts.name ? `Hi ${opts.name},` : "Hi,";
  const text = [
    greeting,
    "",
    "Click the link below to sign in to TunersAmerica:",
    link,
    "",
    "This link expires in 30 minutes. If you didn't request it, you can safely ignore this email.",
    "",
    "— The TunersAmerica team",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0b0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e6edf1;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f12;padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#11171c;border:1px solid #1c252c;border-radius:14px;padding:36px 32px;">
            <tr><td>
              <div style="font-weight:800;font-size:20px;letter-spacing:-0.01em;color:#2fd0c5;">TunersAmerica</div>
              <div style="font-size:13px;color:#8a98a3;margin-top:2px;">Find the right tuner for your build</div>
              <hr style="border:0;border-top:1px solid #1c252c;margin:24px 0;" />
              <p style="margin:0 0 12px 0;font-size:15px;line-height:1.55;">${greeting}</p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;">Click the button below to sign in. The link expires in 30 minutes.</p>
              <p style="margin:0 0 28px 0;">
                <a href="${link}" style="display:inline-block;background:#2fd0c5;color:#0b0f12;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:9px;font-size:15px;">Sign in to TunersAmerica</a>
              </p>
              <p style="margin:0 0 6px 0;font-size:12px;color:#8a98a3;">Or paste this URL into your browser:</p>
              <p style="margin:0 0 24px 0;font-size:12px;color:#8a98a3;word-break:break-all;">${link}</p>
              <hr style="border:0;border-top:1px solid #1c252c;margin:24px 0;" />
              <p style="margin:0;font-size:12px;color:#8a98a3;">If you didn't request this email, you can safely ignore it.</p>
            </td></tr>
          </table>
          <div style="font-size:11px;color:#5a6b75;margin-top:18px;">© ${new Date().getFullYear()} TunersAmerica</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: opts.to,
      subject: "Sign in to TunersAmerica",
      text,
      html,
    });
    if ((result as any)?.error) {
      // eslint-disable-next-line no-console
      console.error("[resend] send failed:", (result as any).error);
      return { sent: false, link, error: (result as any).error?.message || "resend_error" };
    }
    return { sent: true, link, id: (result as any)?.data?.id };
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[resend] send threw:", err?.message || err);
    return { sent: false, link, error: err?.message || "resend_exception" };
  }
}
