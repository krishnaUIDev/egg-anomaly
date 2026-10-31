"""Entrypoint to launch the Egg Anomaly Detection web service and API."""

import socket

import uvicorn


def get_local_ip():
    """Retrieves local LAN IP address so user can connect directly from their smartphone."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


def main():
    host = "0.0.0.0"
    port = 8000
    local_ip = get_local_ip()

    print("=" * 65)
    print("🥚  EggScan AI - Anomaly Detection & Quality Grading System  🥚")
    print("=" * 65)
    print(f" • Local Desktop Access : http://localhost:{port}")
    print(f" • Phone Camera Access  : http://{local_ip}:{port}")
    print(f" • Interactive API Docs : http://localhost:{port}/docs")
    print("=" * 65)

    uvicorn.run("app.main:app", host=host, port=port, reload=True)


if __name__ == "__main__":
    main()
