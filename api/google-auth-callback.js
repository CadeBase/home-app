// Google redirects here after the person approves access.
// Exchanges the one-time code for tokens, then stores only the
// refresh token — server-side, in a table the browser can't read.
module.exports = async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    res.status(400).send("Missing authorization code from Google.");
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenData.refresh_token) {
    res
      .status(400)
      .send(
        "Google didn't return a long-term connection. This can happen if you've connected before — go to myaccount.google.com/permissions, remove this app's access, then try connecting again."
      );
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  await fetch(`${supabaseUrl}/rest/v1/google_tokens?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify([{ id: "household", refresh_token: tokenData.refresh_token }]),
  });

  res.writeHead(302, { Location: "/?google_connected=1" });
  res.end();
};
