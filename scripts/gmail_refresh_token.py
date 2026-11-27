"""
Get a Gmail API refresh token for the backend's GmailAPIBackend (send-only access).

Run once on your own computer, not on the server:
    python scripts/gmail_refresh_token.py path/to/client_secret.json

client_secret.json is the file you download for an OAuth client of type "Desktop app"
(Google Cloud Console → APIs & Services → Credentials). A browser opens; sign in with the
Gmail account the portal should send from and allow "Send email on your behalf".
The script prints GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN to paste into Render.

Only the Python standard library is used, so no virtualenv is needed.
"""

import base64
import hashlib
import http.server
import json
import secrets
import sys
import urllib.parse
import urllib.request
import webbrowser

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/gmail.send"


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding="utf-8") as fh:
        data = json.load(fh)
    client = data.get("installed")
    if not client:
        sys.exit('This is not a "Desktop app" OAuth client file (no "installed" key). Create one of that type.')
    client_id, client_secret = client["client_id"], client["client_secret"]

    state = secrets.token_urlsafe(16)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    result = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if "code" not in query and "error" not in query:
                self.send_response(404)
                self.end_headers()
                return
            result.update({key: values[0] for key, values in query.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Done. You can close this tab and go back to the terminal.")

        def log_message(self, *args):
            pass

    # Port 0: the OS picks a free port; Google allows any loopback port for desktop clients
    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    redirect_uri = f"http://127.0.0.1:{server.server_port}"
    url = AUTH_URL + "?" + urllib.parse.urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": SCOPE,
            "access_type": "offline",  # ask for a refresh token
            "prompt": "consent",  # always return one, even if this account approved before
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )
    print("Opening the browser. If it doesn't open, visit:\n" + url + "\n")
    webbrowser.open(url)
    while not result:
        server.handle_request()
    server.server_close()

    if "error" in result:
        sys.exit(f"Google returned an error: {result['error']}")
    if result.get("state") != state:
        sys.exit("State mismatch; try again.")

    body = urllib.parse.urlencode(
        {
            "code": result["code"],
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": verifier,
        }
    ).encode()
    with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=body, method="POST"), timeout=30) as resp:
        tokens = json.loads(resp.read().decode())
    if "refresh_token" not in tokens:
        sys.exit("No refresh token came back. Remove the app's access at myaccount.google.com/permissions and rerun.")

    print("Set these on the Render backend service (Environment tab):\n")
    print(f"GMAIL_CLIENT_ID={client_id}")
    print(f"GMAIL_CLIENT_SECRET={client_secret}")
    print(f"GMAIL_REFRESH_TOKEN={tokens['refresh_token']}")


if __name__ == "__main__":
    main()
