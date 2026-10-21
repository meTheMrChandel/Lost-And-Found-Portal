# SRS traceability - section 4.6 (QR Code System)

| ID | Requirement (short) | Priority | Prototype module | Status |
|---|---|---|---|---|
| FR-QR-1 | Register items, one unique QR each | H | `registry`, `tokens` | planned |
| FR-QR-2 | QR encodes URL with random UUID only | H | `tokens`, `urls` | planned |
| FR-QR-3 | Printable QR sheet | H | `svg`, `sheet` | planned |
| FR-QR-4 | Scan page: item + name and registration number | H | `privacy`, `scan_page` | planned |
| FR-QR-5 | "Message owner", never phone/email | H | `privacy`, `scan_page` | planned |
| FR-QR-6 | Mark lost / deactivate QR | M | `registry`, `scan_page` | planned |

Related: FR-MSG-1 (search a user by name or registration number) is covered by
the `directory` module, and NFR-3 (rate limiting) by `ratelimit`.
