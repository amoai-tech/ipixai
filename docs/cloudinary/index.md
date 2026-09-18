# Cloudinary media

Cloudinary owns image/video bytes, transformations, and delivery. Supabase owns media business truth: organization, brand, shoot, approval, asset state, and audit history.

## Current state

The current application has `cloudinary` and `next-cloudinary` installed and has Cloudinary signing and webhook Route Handlers under `src/app/api/cloudinary/`.

| Need | Current source |
|---|---|
| Media requirements | [prd.md](./prd.md) |
| Official repositories/examples | [official-repos.md](./official-repos.md) |
| Master product requirements | [../prd.md](../prd.md) |
| Documentation audit | [../DOCS-INDEX.md](../DOCS-INDEX.md) |
| Live task status | [Linear v2-ipix](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues) |

## Rules

- Prefer the official Cloudinary SDK, Next Cloudinary, CLI, MCP, and maintained examples before custom media code.
- Browser uploads are signed server-side; secrets never go to the client.
- Webhooks verify provider authenticity before writing business state.
- Private/operator media must respect organization ownership and approval state.
- Cloudinary Search is not the iPix application database.
- Supabase remains the source of truth for asset ownership and workflow state.

Historical Cloudinary audits, phase PRDs, prompts, and drafts remain in Git and are listed in the documentation inventory, but they are not current architecture authority.
