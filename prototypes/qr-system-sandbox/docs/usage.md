# Usage

All commands run from `prototypes/qr-system-sandbox/`.

```bash
# run the unit tests (standard library only)
python3 -m unittest discover -s tests -t .

# show what a scan page contains for a demo item
python3 -m qr_sandbox demo

# write a printable sheet (layout preview, placeholder pattern, NOT scannable)
python3 -m qr_sandbox sheet --out sheet.html

# scannable codes: install the optional library first
pip install qrcode
python3 -m qr_sandbox sheet --out sheet.html --real-qr
```

## Design notes

- A QR encodes only `https://<host>/qr/<uuid4>` - no names, emails or phone numbers.
- The public scan payload contains the item, the owner's name and registration
  number, and a "Message owner" action that requires login.
- A deactivated QR returns `QRInactiveError`; an item marked lost is highlighted.
- Scan endpoints should be wrapped with `ScanRateLimiter` keyed by client IP.
