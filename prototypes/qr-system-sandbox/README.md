# QR System Sandbox

A standalone prototype of the **QR code system** described in section 4.6 of the
Lost & Found Portal SRS (FR-QR-1 to FR-QR-6).

This folder is intentionally **self-contained**:

- it lives outside `backend/` and `frontend/`,
- it does not import Django or any portal code,
- it uses only the Python standard library (an optional QR library is supported),
- it is not referenced by CI, Docker or any requirements file.

Nothing here changes how the portal builds, runs or is tested.

## What it prototypes

| SRS requirement | Prototype area |
|---|---|
| FR-QR-1 register items and generate a unique QR | `registry`, `tokens` |
| FR-QR-2 QR encodes a URL with a random UUID, no personal data | `tokens`, `urls` |
| FR-QR-3 printable QR sheet | `svg`, `sheet` |
| FR-QR-4 scan page shows item + limited owner details | `privacy`, `scan_page` |
| FR-QR-5 "Message owner" action, no phone or email | `privacy`, `scan_page` |
| FR-QR-6 mark item lost / deactivate QR | `registry`, `scan_page` |
