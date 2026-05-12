"""One-time password-reset tokens.

Each `/api/auth/forgot-password` call generates a fresh random token,
hashes it with SHA-256, and persists ONLY the hash. The plaintext goes
out via the reset URL emailed by Odoo.

Lookup by hash is constant-time-ish (SHA-256 is short enough that a
B-tree hit is dominated by I/O). Tokens are single-use: `used_at` is
stamped the moment a successful `/api/auth/reset-password` consumes
them, and any subsequent attempt to reuse the same token returns 400.

Expired tokens stay in the table — a small periodic cleanup job will
prune them eventually, but they're harmless on their own (the consume
path always rechecks `expires_at > now`).
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    # SHA-256 hex digest of the token (64 hex chars). Plaintext NEVER stored.
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    # NULL until the token is consumed; set to the consume timestamp on
    # successful reset. Re-checked on every consume to guarantee single use.
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
