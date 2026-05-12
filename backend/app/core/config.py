from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    DATABASE_URL: str = "sqlite+aiosqlite:///./velxio.db"
    DATA_DIR: str = "."
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8001/api/auth/google/callback"
    FRONTEND_URL: str = "http://localhost:5173"
    # Set to true in production (HTTPS). Controls the Secure flag on the JWT cookie.
    COOKIE_SECURE: bool = False
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # ── Odoo transactional-mail relay ──────────────────────────────────────
    # The Velxio backend POSTs to `<ODOO_URL>/velxio/api/send-welcome` and
    # `<ODOO_URL>/velxio/api/send-password-reset` on register / forgot-
    # password. Calls are fire-and-forget — registration succeeds even when
    # ODOO_URL is empty (no mail will be sent), so dev / CI doesn't need a
    # working Odoo instance.
    #
    # ODOO_API_KEY must match the company-level X-Velxio-API-Key stored in
    # `res.company.velxio_api_key` on the Odoo side (see
    # odoo-addons/velxio_subscription/controllers/api.py).
    ODOO_URL: str = ""
    ODOO_API_KEY: str = ""
    # How long to wait for Odoo before giving up the fire-and-forget call.
    # Kept short so a stalled Odoo never holds an asyncio.create_task open
    # for minutes.
    ODOO_MAIL_TIMEOUT_S: float = 10.0

    # Password-reset tuning. Tokens are random 32-byte URL-safe strings;
    # only the SHA-256 hash is persisted so a database leak doesn't reveal
    # usable reset codes.
    PASSWORD_RESET_TOKEN_TTL_MINUTES: int = 60
    PASSWORD_RESET_RATE_LIMIT_PER_HOUR: int = 3

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
