# Signed uploads

Use this when the user needs secure browser uploads through `CldUploadWidget` with a server-side signature endpoint.


## Signed uploads (App Router) — canonical pattern

When the user wants signed/secure uploads, do this end-to-end:

**1. Pass `signatureEndpoint` to the widget instead of `uploadPreset`-only:**

```tsx
'use client';
import { CldUploadWidget } from 'next-cloudinary';

<CldUploadWidget
  signatureEndpoint="/api/sign-cloudinary-params"
  uploadPreset="<signed-preset>"
  // Do not send tenant folder/context/public ID from the browser.
  options={{ sources: ['local'] }}
  onSuccess={(result) => console.log(result.info)}
>
  {({ open }) => <button onClick={() => open()}>Upload</button>}
</CldUploadWidget>;
```

**2. Create the route handler at `app/api/sign-cloudinary-params/route.ts`:**

```ts
// Reuse the production iPix contract instead of signing request fields directly.
// See: src/app/api/cloudinary/sign/route.ts
// Required sequence:
// authenticate caller → resolve trusted org → validate brand/shoot ownership
// → reject unauthorized paramsToSign keys → apply server-owned preset/folder/context
// → sign exact params with CLOUDINARY_API_SECRET.
export { POST, runtime } from '@/app/api/cloudinary/sign/route';
```

**Rules**:
- ✅ Authenticate and authorize before signing; never sign arbitrary browser-provided fields.
- ✅ Tenant namespace, preset, context, ownership IDs, and overwrite policy are server-owned.
- ✅ Return shape **must include** `{ signature }`. Do **not** wrap it (`{ data: { signature } }` will not work).
- ✅ Use the **Node SDK v2** (`import { v2 as cloudinary } from 'cloudinary'`). Do not use v1.
- ✅ The route runs on the Node.js runtime by default — fine. If you set `export const runtime = 'edge'`, **switch back** to Node: the Node SDK depends on Node-only APIs.
- ❌ **Never** read `process.env.CLOUDINARY_API_SECRET` in a Client Component or anywhere it could be bundled to the browser.
- ❌ **Don't** add the secret as `NEXT_PUBLIC_CLOUDINARY_API_SECRET` — that exposes it.
- ❌ **Don't** invent a custom signature shape — the widget calls the endpoint and expects `{ signature }`. If you also want timestamp/api_key, return them too, but the field name `signature` is required.

**Pages Router equivalent**: `pages/api/sign-cloudinary-params.js` exporting a default handler that does `res.status(200).json({ signature })` with the same `cloudinary.utils.api_sign_request` call.
