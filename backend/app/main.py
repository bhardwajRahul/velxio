import logging
import sys
import asyncio
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s: %(message)s')

# On Windows, asyncio defaults to SelectorEventLoop which does NOT support
# create_subprocess_exec (raises NotImplementedError). Force ProactorEventLoop.
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import compile, compile_chip, libraries
from app.core.config import settings
from app.core.hooks import (
    register_get_current_user_id,
    register_lifespan_startup,
    register_record_compile,
    run_lifespan_startup,
)

logger = logging.getLogger(__name__)


# ── DB / auth registration ──────────────────────────────────────────────────
# Routes that stay in OSS (compile, libraries, simulation, iot_gateway) talk
# to the hook layer in app.core.hooks. The wiring below registers concrete
# implementations backed by the upstream auth/DB stack so velxio.dev keeps
# tracking compiles + resolving users. The whole block is gated on the
# auth/DB modules being importable — in Phase 2 of the OSS split they move
# to the private overlay, and this block's ImportError silently no-ops so
# the OSS image runs the routes stateless.
try:
    from sqlalchemy import text

    from app.core.dependencies import get_current_user as _resolve_current_user
    from app.database.session import AsyncSessionLocal, Base, async_engine, get_db

    # Import models so SQLAlchemy registers them on Base.metadata before create_all.
    import app.models.password_reset_token  # noqa: F401
    import app.models.project  # noqa: F401
    import app.models.usage_event  # noqa: F401
    import app.models.user  # noqa: F401
    from app.models.user import User
    from app.services.metrics import record_compile as _record_compile_db

    _LEGACY_MIGRATIONS = [
        "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0",
        # Phase: usage metrics
        "ALTER TABLE users ADD COLUMN total_compiles INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN total_compile_errors INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN total_runs INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN last_active_at DATETIME",
        "ALTER TABLE projects ADD COLUMN compile_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE projects ADD COLUMN compile_error_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE projects ADD COLUMN run_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE projects ADD COLUMN update_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE projects ADD COLUMN last_compiled_at DATETIME",
        "ALTER TABLE projects ADD COLUMN last_run_at DATETIME",
        # Country tracking (CF-IPCountry)
        "ALTER TABLE users ADD COLUMN signup_country VARCHAR(2)",
        "ALTER TABLE users ADD COLUMN last_country VARCHAR(2)",
        "ALTER TABLE usage_events ADD COLUMN country VARCHAR(2)",
        # Multi-board persistence (replaces single board_type as the source of truth)
        "ALTER TABLE projects ADD COLUMN boards_json TEXT NOT NULL DEFAULT '[]'",
        # Subscription state — populated by overlay billing integrations.
        "ALTER TABLE users ADD COLUMN is_paid_subscriber BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN subscription_status VARCHAR(20)",
        "ALTER TABLE users ADD COLUMN subscription_period_end DATETIME",
        "ALTER TABLE users ADD COLUMN odoo_partner_id INTEGER",
        # Agent quota tier — defaults to 'free'; admins + paid subs get bumped
        # to 'pro' / 'pro_max' via the velxio_subscription Odoo webhook.
        "ALTER TABLE users ADD COLUMN plan_id VARCHAR(20) NOT NULL DEFAULT 'free'",
    ]

    async def _db_setup() -> None:
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            for stmt in _LEGACY_MIGRATIONS:
                try:
                    await conn.execute(text(stmt))
                except Exception:
                    pass  # column already exists

    register_lifespan_startup(_db_setup)

    async def _record_compile_adapter(
        *,
        user_id,
        project_id,
        board_fqbn,
        success,
        duration_ms,
        error_kind,
        extra,
        request,
    ) -> None:
        async with AsyncSessionLocal() as session:
            user = await session.get(User, user_id) if user_id is not None else None
            await _record_compile_db(
                session,
                user=user,
                project_id=project_id,
                board_fqbn=board_fqbn,
                success=success,
                duration_ms=duration_ms,
                error_kind=error_kind,
                extra=extra,
                request=request,
            )

    register_record_compile(_record_compile_adapter)

    async def _resolve_user_id(request: Request):
        async for session in get_db():
            user = await _resolve_current_user(request, session)
            return user.id if user else None
        return None

    register_get_current_user_id(_resolve_user_id)

    # Auth / project / admin routers — also overlay-owned conceptually, but
    # while the source still lives in OSS we wire them in here. Phase 2 moves
    # this block into the private overlay's register_pro(app).
    from app.api.routes.admin import router as admin_router
    from app.api.routes.auth import router as auth_router
    from app.api.routes.metrics import router as metrics_router
    from app.api.routes.projects import router as projects_router

    _AUTH_ROUTERS: list[tuple[object, str, str]] = [
        (auth_router, "/api/auth", "auth"),
        (projects_router, "/api", "projects"),
        (metrics_router, "/api/metrics", "metrics"),
        (admin_router, "/api/admin", "admin"),
    ]
except ImportError:
    logger.info("[main] auth/DB modules not available — running stateless")
    _AUTH_ROUTERS = []


def _asyncio_exception_handler(loop: asyncio.AbstractEventLoop, context: dict) -> None:
    """Prevent unhandled asyncio task exceptions from killing the uvicorn process.

    Normally uvicorn re-raises unhandled task exceptions at the event-loop level,
    which can crash the whole process. The main culprit is a race condition in
    websockets <12.0 (legacy/protocol.py AssertionError during keepalive ping).
    Upgrading websockets>=12.0 is the primary fix; this handler is a safety net.
    """
    exc = context.get("exception")
    msg = context.get("message", "")
    if exc is not None:
        logger.error("Unhandled asyncio task exception (swallowed): %s — %r", msg, exc)
    else:
        # No exception object — let default handler deal with it
        loop.default_exception_handler(context)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    asyncio.get_event_loop().set_exception_handler(_asyncio_exception_handler)
    # Each module that needs async startup (DB schema creation, legacy column
    # migrations, cache warmers, …) registers a hook with
    # register_lifespan_startup() at import time. The OSS auth/DB stack
    # registers the create_all + ALTER TABLE migration block above; the
    # private overlay's register_pro() can add more. Running zero hooks is
    # the expected behavior of a stateless OSS image.
    await run_lifespan_startup()
    yield


app = FastAPI(
    title="Arduino Emulator API",
    description="Compilation and project management API",
    version="1.0.0",
    lifespan=lifespan,
    # Moved from /docs to /api/docs so the frontend /docs/* documentation
    # routes are served by the React SPA without any nginx conflict.
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        settings.FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(compile.router, prefix="/api/compile", tags=["compilation"])
app.include_router(compile_chip.router, prefix="/api/compile-chip", tags=["custom-chips"])
app.include_router(libraries.router, prefix="/api/libraries", tags=["libraries"])

# Auth / projects / admin routers are registered ONLY when the upstream
# auth/DB stack imported successfully. In Phase 2 the source moves to
# the private overlay and the entry in _AUTH_ROUTERS is empty here.
for _router, _prefix, _tag in _AUTH_ROUTERS:
    app.include_router(_router, prefix=_prefix, tags=[_tag])  # type: ignore[arg-type]

# WebSockets
from app.api.routes import simulation
app.include_router(simulation.router, prefix="/api/simulation", tags=["simulation"])

# IoT Gateway — HTTP proxy for ESP32 web servers
from app.api.routes import iot_gateway
app.include_router(iot_gateway.router, prefix="/api/gateway", tags=["iot-gateway"])

# Optional pro extension. The `app.pro` package only exists in private builds
# (overlaid at Docker build time by an external repo) — its absence in the
# open-source image is expected and silently ignored. Anyone with private
# extensions can drop a package at `backend/app/pro/` exposing
# `register_pro(app)` and have it auto-loaded here without further edits.
try:
    from app.pro import register_pro  # type: ignore[import-not-found]
    register_pro(app)
except ImportError:
    pass

@app.get("/")
def root():
    return {
        "message": "Arduino Emulator API",
        "version": "1.0.0",
        "docs": "/api/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}

