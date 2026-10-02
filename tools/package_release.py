"""Build a clean Chrome Web Store ZIP using only the Python standard library.

Usage: python tools/package_release.py /absolute/path/to/release.zip
The local config.json is intentionally never read or copied.
"""

import hashlib
import json
from pathlib import Path
import sys
import zipfile


ROOT = Path(__file__).resolve().parent.parent
RUNTIME_FILES = (
    "manifest.json", "background.js", "content.js", "tooltip.css",
    "popup.html", "popup.js", "welcome.html", "welcome.js", "LICENSE", "NOTICE",
)


def build_release(output):
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    if manifest["version"] != package["version"]:
        raise ValueError("Manifest and package versions differ")
    paths = {ROOT / name for name in RUNTIME_FILES}
    paths.update((ROOT / "_locales").glob("*/messages.json"))
    # 선언된 아이콘만 포함해 개발용 이미지나 임시 파일의 유입을 막는다.
    for icon in [*manifest["icons"].values(), *manifest["action"]["default_icon"].values()]:
        paths.add(ROOT / icon)
    payloads = {path.relative_to(ROOT).as_posix(): path.read_bytes() for path in paths}
    # 배포 ZIP에 개인 API 키가 들어가지 않도록 빈 설정을 직접 생성한다.
    payloads["config.json"] = b"{}\n"
    output = Path(output).resolve()
    if output.suffix.lower() != ".zip":
        raise ValueError("Release output must use the .zip extension")
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(payloads.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, data)
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        assert json.loads(archive.read("config.json")) == {}
        assert json.loads(archive.read("manifest.json"))["version"] == manifest["version"]
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    print(f"Version: {manifest['version']} | Files: {len(payloads)} | Bytes: {output.stat().st_size}")
    print(f"SHA256: {digest}")
    print(f"ZIP: {output}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python tools/package_release.py OUTPUT.zip")
    build_release(sys.argv[1])
