# Security policy

## Reporting a vulnerability

Email the iPix maintainers or open a **private** GitHub security advisory on [amoai-tech/ipixai](https://github.com/amoai-tech/ipixai/security). Do not file a public issue for secrets, auth bypasses, or data leaks.

## Secrets

Do not commit:

- `.env` or any real API keys
- OpenAI, Supabase, GitHub, or CopilotKit tokens
- service-role / postgres credentials

Use `.env.example` as the key-name template only.

GitHub secret scanning and push protection are expected to stay enabled on this repository.
