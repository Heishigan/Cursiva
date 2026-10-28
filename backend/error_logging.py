"""Structured logging in Cloud Logging's JSON format, with no user text.

Every log line is one JSON object on stderr with a "severity" field, so Cloud
Logging can alert on severity>=ERROR (unhandled 500s, "REFUND FAILED").

Privacy rule: CV, job-ad and cover-letter text must never reach the logs.
Exception messages are where such text leaks (a parser error quoting its
input, a database error listing its parameters), so this module never writes
an exception message anywhere:
  * a stack trace keeps the exception type and the code locations (file,
    line, function, the line of source code) and drops the message;
  * an exception passed as a log argument (logger.warning("x: %s", e)) is
    written as its type name only.
Log messages themselves are written by our own code and must not include
user text; that is checked by review, not here.
"""
import json
import logging
import sys
import traceback

from starlette.responses import JSONResponse


def _safe_arg(value):
    return type(value).__name__ if isinstance(value, BaseException) else value


def _message(record: logging.LogRecord) -> str:
    args = record.args
    if isinstance(args, tuple):
        args = tuple(_safe_arg(a) for a in args)
    elif isinstance(args, dict):
        args = {k: _safe_arg(v) for k, v in args.items()}
    msg = str(_safe_arg(record.msg))
    try:
        return msg % args if args else msg
    except (TypeError, ValueError, KeyError):
        return msg


def safe_stack_trace(exc: BaseException) -> str:
    """The traceback of exc (and of any exception it was raised from or
    during), with code locations and exception types but no messages."""
    chain = []
    while exc is not None and len(chain) < 10 and exc not in chain:
        chain.append(exc)
        exc = exc.__cause__ or (None if exc.__suppress_context__ else exc.__context__)
    parts = []
    for i, e in enumerate(reversed(chain)):
        if i:
            parts.append("\nRaised while handling the exception above:\n\n")
        parts.append("Traceback (most recent call last):\n")
        parts.extend(traceback.extract_tb(e.__traceback__).format())
        parts.append(f"{type(e).__qualname__}\n")
    return "".join(parts)


class CloudLoggingJsonFormatter(logging.Formatter):
    """One JSON object per record: severity, message, logger, and for records
    carrying an exception, its type and a message-free stack trace."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "severity": record.levelname if record.levelname != "WARN" else "WARNING",
            "message": _message(record),
            "logger": record.name,
        }
        exc = record.exc_info[1] if record.exc_info else None
        if exc is not None:
            entry["exception_type"] = type(exc).__name__
            entry["stack_trace"] = safe_stack_trace(exc)
        return json.dumps(entry, ensure_ascii=False, default=str)


def setup_error_logging() -> None:
    """Route the app's logs (root logger) and uvicorn's own logs through the
    JSON formatter. Uvicorn configures its loggers before importing the app,
    so their handlers already exist when this runs at import time."""
    formatter = CloudLoggingJsonFormatter()
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    stream_handlers = [h for h in root.handlers if type(h) is logging.StreamHandler]
    if not stream_handlers:
        handler = logging.StreamHandler(sys.stderr)
        root.addHandler(handler)
        stream_handlers = [handler]
    for h in stream_handlers:
        h.setFormatter(formatter)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        for h in logging.getLogger(name).handlers:
            h.setFormatter(formatter)


_logger = logging.getLogger("cursiva.errors")


class UnhandledErrorMiddleware:
    """Turn any unhandled exception into a 500 and one structured ERROR log.

    It sits inside Starlette's ServerErrorMiddleware and does not re-raise,
    so uvicorn does not also print its own plain-text traceback (which would
    include the exception message). If the response had already started
    (a stream), the connection is simply closed after logging."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = False

        async def send_wrapper(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:
            _logger.error("Unhandled server error: %s %s", scope.get("method"), scope.get("path"), exc_info=exc)
            if not started:
                response = JSONResponse({"detail": "Internal Server Error"}, status_code=500)
                await response(scope, receive, send)
