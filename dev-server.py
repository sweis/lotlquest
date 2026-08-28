#!/usr/bin/env python3
"""Static dev server with caching disabled — browsers otherwise pin stale ES
modules after edits (fresh main.js importing a cached old terrain.js)."""
import functools
import http.server
import os
import sys

PORT = int(os.environ.get('PORT', sys.argv[1] if len(sys.argv) > 1 else 8341))
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


handler = functools.partial(NoCacheHandler, directory=ROOT)
print(f'serving {ROOT} on http://localhost:{PORT} (no-store)', flush=True)
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler).serve_forever()
