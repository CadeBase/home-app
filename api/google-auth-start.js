// Redirects the user to Google's own consent screen.
// No secrets are exposed here — this just builds a URL.
module.exports = async function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    res.status(500).send("Google Calendar isn't configured yet (missing environment variables).");
    return;
  }

  const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar.events");
  const url =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&scope=${scope}`;

  res.writeHead(302, { Location: url });
  res.end();
};
