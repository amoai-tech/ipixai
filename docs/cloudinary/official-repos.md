# Official Cloudinary repositories — reuse before custom code

Use these sources to verify Cloudinary behavior before creating iPix-specific media infrastructure.

| Priority | Official / maintained source | iPix use |
|---:|---|---|
| 1 | https://github.com/cloudinary/cloudinary_npm | Node SDK: signing, upload, webhook verification, delivery URLs |
| 2 | https://github.com/cloudinary-community/next-cloudinary | Next.js UI/integration patterns such as `CldUploadWidget` |
| 3 | https://github.com/cloudinary-community/cloudinary-examples | Runnable examples; adapt the smallest relevant pattern |
| 4 | https://github.com/cloudinary/cloudinary-cli | Inspect/configure Cloudinary without custom scripts when supported |
| 5 | https://github.com/cloudinary/mcp-servers | Cloudinary MCP capabilities and current integration references |
| 6 | https://github.com/cloudinary/asset-management-js | Administrative asset operations where appropriate; not iPix business truth |
| 7 | https://github.com/cloudinary/api-schemas | API contracts/schema reference |

## iPix adaptation rules

- Prefer installed package source/types over copied snippets.
- Reuse the official signing and verification functions rather than hand-rolling cryptography.
- Use Next.js Route Handlers for iPix server authorization boundaries.
- Keep tenant ownership, shoot relationships, approvals, and workflow state in Supabase.
- Treat examples as implementation patterns, not security policy.
- Do not add another uploader, CDN, or media database unless the current stack demonstrably cannot satisfy the requirement.

## Example search order

For upload work:

```text
cloudinary_npm
→ next-cloudinary
→ cloudinary-examples signed upload examples
→ existing iPix sign route
→ smallest missing adapter
```

For delivery work:

```text
cloudinary_npm delivery/signing APIs
→ current iPix authorization + Supabase asset ownership
→ named transforms/current delivery policy
→ smallest missing helper
```

For webhook work:

```text
cloudinary_npm verification APIs
→ current iPix webhook route
→ durable Supabase write semantics
→ targeted tests
```

## Related iPix docs

- [Cloudinary media requirements](./prd.md)
- [Master product requirements](../prd.md)
- [Documentation inventory](../index-docs.md)

Live task status and ownership remain in [Linear](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues).
