from __future__ import annotations

import http.server
import socket
import socketserver
import threading
import time
import webbrowser
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
HOST = "127.0.0.1"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_DIR), **kwargs)

    def log_message(self, format, *args):
        return


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((HOST, 0))
        sock.listen(1)
        return sock.getsockname()[1]


def main() -> None:
    port = find_free_port()
    server = socketserver.TCPServer((HOST, port), QuietHandler)
    server.allow_reuse_address = True

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    url = f"http://{HOST}:{port}/index.html"
    print("Radiance Lab 已启动")
    print(f"访问地址: {url}")
    print("关闭此窗口将停止本地服务")

    webbrowser.open(url)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
      pass
    finally:
      server.shutdown()
      server.server_close()


if __name__ == "__main__":
    main()
