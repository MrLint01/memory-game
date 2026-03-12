from __future__ import annotations

from collections import deque
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SLOTHS_DIR = ROOT / "imgs" / "Sloths"
OUTPUT_DIR = SLOTHS_DIR / "transparent"

# The new sloth packs that do not already have transparent PNG outputs.
ASSETS = [
    (
        "cute-angel-sloth-flying-cartoon-vector-icon-illustration-animal-holiday-icon-concept-isolated-flat.zip",
        "turbo_angel.png",
    ),
    (
        "cute-sloth-catching-branch-wood-tree-cartoon-vector-icon-illustration-animal-food-icon-isolated.zip",
        "turbo_catching_branch.png",
    ),
    (
        "cute-sloth-holding-branch-wood-tree-cartoon-vector-icon-illustration-animal-nature-icon-isolated.zip",
        "turbo_holding_branch.png",
    ),
    (
        "cute-sloth-painting-branch-tree-cartoon-vector-icon-illustration-animal-art-icon-isolated-flat.zip",
        "turbo_painting.png",
    ),
    (
        "cute-sloth-yoga-cartoon-icon-illustration.zip",
        "turbo_yoga.png",
    ),
]

MAX_SIZE = 2400
CORNER_PATCH = 24
SEED_TOLERANCE = 42.0
GLOBAL_TOLERANCE = 88.0
LOCAL_TOLERANCE = 20.0
SOFT_TOLERANCE = 108.0


def load_jpg_from_zip(zip_path: Path) -> Image.Image:
    with ZipFile(zip_path) as archive:
        jpg_name = next(name for name in archive.namelist() if name.lower().endswith(".jpg"))
        data = archive.read(jpg_name)
    image = Image.open(BytesIO(data)).convert("RGBA")
    image.thumbnail((MAX_SIZE, MAX_SIZE), Image.Resampling.LANCZOS)
    return image


def corner_patches(rgb: np.ndarray) -> list[np.ndarray]:
    patch = max(8, min(CORNER_PATCH, rgb.shape[0] // 16, rgb.shape[1] // 16))
    return [
        rgb[:patch, :patch],
        rgb[:patch, -patch:],
        rgb[-patch:, :patch],
        rgb[-patch:, -patch:],
    ]


def background_means(rgb: np.ndarray) -> np.ndarray:
    patches = corner_patches(rgb)
    means = [patch.reshape(-1, 3).mean(axis=0) for patch in patches]
    return np.array(means, dtype=np.float32)


def min_distance_to_means(pixel: np.ndarray, means: np.ndarray) -> float:
    return float(np.sqrt(((means - pixel) ** 2).sum(axis=1)).min())


def seed_background_mask(rgb: np.ndarray, means: np.ndarray) -> np.ndarray:
    height, width, _ = rgb.shape
    mask = np.zeros((height, width), dtype=bool)
    visited = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def maybe_enqueue(y: int, x: int) -> None:
        if visited[y, x]:
            return
        visited[y, x] = True
        pixel = rgb[y, x].astype(np.float32)
        if min_distance_to_means(pixel, means) <= SEED_TOLERANCE:
            mask[y, x] = True
            queue.append((y, x))

    for x in range(width):
        maybe_enqueue(0, x)
        maybe_enqueue(height - 1, x)
    for y in range(height):
        maybe_enqueue(y, 0)
        maybe_enqueue(y, width - 1)

    while queue:
        y, x = queue.popleft()
        current = rgb[y, x].astype(np.float32)
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if ny < 0 or ny >= height or nx < 0 or nx >= width or visited[ny, nx]:
                continue
            visited[ny, nx] = True
            neighbor = rgb[ny, nx].astype(np.float32)
            mean_distance = min_distance_to_means(neighbor, means)
            step_distance = float(np.sqrt(((neighbor - current) ** 2).sum()))
            if mean_distance <= GLOBAL_TOLERANCE or (
                mean_distance <= SOFT_TOLERANCE and step_distance <= LOCAL_TOLERANCE
            ):
                mask[ny, nx] = True
                queue.append((ny, nx))

    return mask


def alpha_from_mask(mask: np.ndarray) -> Image.Image:
    alpha = np.where(mask, 0, 255).astype(np.uint8)
    alpha_image = Image.fromarray(alpha, mode="L").filter(ImageFilter.GaussianBlur(radius=1.2))
    alpha_array = np.array(alpha_image, dtype=np.uint8)
    alpha_array[alpha_array < 16] = 0
    alpha_array[alpha_array > 239] = 255
    return Image.fromarray(alpha_array, mode="L")


def convert_asset(zip_name: str, output_name: str) -> Path:
    source = load_jpg_from_zip(SLOTHS_DIR / zip_name)
    rgb = np.array(source.convert("RGB"), dtype=np.uint8)
    means = background_means(rgb)
    bg_mask = seed_background_mask(rgb, means)

    output = source.copy()
    output.putalpha(alpha_from_mask(bg_mask))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / output_name
    output.save(output_path, format="PNG", optimize=True)
    return output_path


def main() -> None:
    for zip_name, output_name in ASSETS:
        output_path = convert_asset(zip_name, output_name)
        print(output_path.relative_to(ROOT))


if __name__ == "__main__":
    main()
