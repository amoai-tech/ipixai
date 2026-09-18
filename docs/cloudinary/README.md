# Cloudinary media

Cloudinary owns image/video bytes, transformations, and delivery. Supabase owns media business truth: organization, brand, shoot, approval, asset state, and audit history.

## Current state

The application uses `cloudinary` and `next-cloudinary` and has signing and webhook Route Handlers under `src/app/api/cloudinary/`.

| Need | Current source |
|---|---|
| Media requirements | [prd.md](./prd.md) |
| Locked upload/delivery contract | [CONTRACT-1110-1112.lock.md](./CONTRACT-1110-1112.lock.md) |
| Official repositories/examples | [official-repos.md](./official-repos.md) |
| Master product requirements | [../prd.md](../prd.md) |
| Live task status | [Linear v2-ipix](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues) |
| Historical media plans/audits | [archive/cloudinary/](../archive/cloudinary/) |

## Rules

- Prefer the official Cloudinary SDK, Next Cloudinary, CLI, MCP, and maintained examples before custom media code.
- Browser uploads are signed server-side; secrets never go to the client.
- Webhooks verify provider authenticity before writing business state.
- Private/operator media must respect organization ownership and approval state.
- Cloudinary Search is not the iPix application database.
- Supabase remains the source of truth for asset ownership and workflow state.
- Current task sequencing belongs in Linear; archived phase roadmaps are evidence only.
