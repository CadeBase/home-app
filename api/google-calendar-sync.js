// Two-way sync: pulls upcoming Google Calendar events into the app,
// and pushes any app-only events out to Google.
module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  async function sb(path, opts = {}) {
    const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Supabase error (${r.status}): ${text}`);
    }
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  try {
    const tokenRows = await sb("google_tokens?id=eq.household&select=refresh_token");
    if (!tokenRows || tokenRows.length === 0) {
      res.status(400).json({ error: "Google Calendar isn't connected yet." });
      return;
    }
    const refreshToken = tokenRows[0].refresh_token;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const { access_token } = await tokenRes.json();
    if (!access_token) {
      res.status(400).json({ error: "Could not refresh Google access. Try reconnecting in Settings." });
      return;
    }

    const now = new Date();
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    // 1. Pull events from Google into our events table
    const listRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${in60Days.toISOString()}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const googleData = await listRes.json();
    const googleEvents = googleData.items || [];

    for (const ev of googleEvents) {
      if (ev.status === "cancelled") continue;
      const startsAt = ev.start?.dateTime || ev.start?.date;
      if (!startsAt) continue;
      const allDay = !ev.start?.dateTime;
      await sb("events?on_conflict=google_event_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify([
          {
            google_event_id: ev.id,
            title: ev.summary || "(untitled)",
            starts_at: new Date(startsAt).toISOString(),
            all_day: allDay,
            source: "google",
          },
        ]),
      });
    }

    // 2. Push app-only events (added locally, never sent to Google yet) out
    const localOnly = await sb(`events?source=eq.local&google_event_id=is.null&select=*`);
    let pushed = 0;
    for (const ev of localOnly || []) {
      const body = ev.all_day
        ? { summary: ev.title, start: { date: ev.starts_at.slice(0, 10) }, end: { date: ev.starts_at.slice(0, 10) } }
        : { summary: ev.title, start: { dateTime: ev.starts_at }, end: { dateTime: ev.ends_at || ev.starts_at } };

      const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const created = await createRes.json();
      if (created.id) {
        await sb(`events?id=eq.${ev.id}`, {
          method: "PATCH",
          body: JSON.stringify({ google_event_id: created.id, source: "google" }),
        });
        pushed++;
      }
    }

    res.status(200).json({ pulled: googleEvents.length, pushed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
