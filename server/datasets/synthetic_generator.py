"""Synthetic Egg Image Generator for Benchmarking, Testing, and Demos.
Simulates phone camera captures of clean eggs and various defect conditions
(cracks, dirt/stains, blood spots, and irregular shapes) on realistic kitchen/table backgrounds.
"""

import random

import cv2
import numpy as np


def generate_table_background(width: int = 640, height: int = 640) -> np.ndarray:
    """Generates a realistic wood grain or countertop background texture."""
    bg = np.zeros((height, width, 3), dtype=np.uint8)
    
    # Base wood tone
    base_color = np.array([random.randint(180, 220), random.randint(150, 190), random.randint(120, 160)], dtype=np.float32)
    bg[:, :] = base_color
    
    # Add horizontal/angled wood grain streaks
    noise = np.random.normal(0, 12, (height, width)).astype(np.float32)
    noise_blur = cv2.GaussianBlur(noise, (51, 3), 0)
    
    bg_result = np.clip(bg + cv2.cvtColor(noise_blur.astype(np.uint8), cv2.COLOR_GRAY2RGB) - 128, 0, 255).astype(np.uint8)
    return bg_result


def generate_egg_image(
    defect_type: str = "clean",
    width: int = 640,
    height: int = 640,
    shell_color: str = "brown"
) -> tuple[np.ndarray, dict]:
    """Generates a synthetic egg image with simulated phone camera characteristics.

    Args:
        defect_type: 'clean', 'crack', 'dirt_stain', 'blood_spot', 'deformed'
        shell_color: 'brown' or 'white'

    Returns:
        (image_rgb, metadata_dict)
    """
    img = generate_table_background(width, height)
    
    cx, cy = width // 2 + random.randint(-15, 15), height // 2 + random.randint(-15, 15)
    
    # Proportions
    if defect_type == "deformed":
        rx = int(width * random.uniform(0.18, 0.22))
        ry = int(height * random.uniform(0.35, 0.42))  # Exaggerated aspect ratio
    else:
        rx = int(width * random.uniform(0.20, 0.24))
        ry = int(height * random.uniform(0.27, 0.32))

    # Base shell color in RGB
    if shell_color == "brown":
        base_shell = [random.randint(220, 240), random.randint(185, 205), random.randint(150, 175)]
    else:  # White shell
        base_shell = [random.randint(240, 250), random.randint(238, 248), random.randint(230, 240)]

    # 1. Cast shadow of egg onto table
    shadow_mask = np.zeros((height, width), dtype=np.uint8)
    cv2.ellipse(shadow_mask, (cx + 15, cy + 25), (rx + 20, ry + 15), 15, 0, 360, 255, -1)
    shadow_mask = cv2.GaussianBlur(shadow_mask, (45, 45), 0)
    
    shadow_mult = 1.0 - (shadow_mask.astype(np.float32) / 255.0) * 0.45
    for c in range(3):
        img[:, :, c] = (img[:, :, c].astype(np.float32) * shadow_mult).astype(np.uint8)

    # 2. Render Egg Body with 3D Spherical Shading & Highlight
    egg_layer = np.zeros((height, width, 3), dtype=np.uint8)
    egg_mask = np.zeros((height, width), dtype=np.uint8)
    
    angle = random.randint(-15, 15)
    cv2.ellipse(egg_mask, (cx, cy), (rx, ry), angle, 0, 360, 255, -1)
    
    # 3D gradient (light source coming from top-left)
    y_coords, x_coords = np.indices((height, width))
    dx = (x_coords - (cx - rx * 0.3)) / float(rx)
    dy = (y_coords - (cy - ry * 0.3)) / float(ry)
    dist_from_highlight = np.sqrt(dx**2 + dy**2)
    shading = np.clip(1.15 - dist_from_highlight * 0.35, 0.65, 1.25)
    
    for c in range(3):
        egg_layer[:, :, c] = np.clip(base_shell[c] * shading, 0, 255).astype(np.uint8)

    # Natural egg shell micro-texture
    shell_noise = np.random.normal(0, 3, (height, width)).astype(np.float32)
    for c in range(3):
        egg_layer[:, :, c] = np.clip(egg_layer[:, :, c].astype(np.float32) + shell_noise, 0, 255).astype(np.uint8)

    # 3. Add Simulated Defects
    defect_metadata = {"defect_type": defect_type, "shell_color": shell_color}

    if defect_type == "crack":
        # Draw a jagged, branching fracture line
        start_x = cx + random.randint(-rx // 3, rx // 3)
        start_y = cy - ry // 2 + random.randint(0, ry // 4)
        
        curr_x, curr_y = start_x, start_y
        crack_points = [(curr_x, curr_y)]
        
        for _ in range(random.randint(18, 30)):
            curr_x += random.randint(-4, 4)
            curr_y += random.randint(3, 7)
            crack_points.append((curr_x, curr_y))
            # Branching
            if random.random() < 0.25:
                bx, by = curr_x, curr_y
                for _ in range(random.randint(4, 9)):
                    bx += random.randint(2, 6)
                    by += random.randint(1, 4)
                    crack_points.append((bx, by))

        for i in range(len(crack_points) - 1):
            p1, p2 = crack_points[i], crack_points[i + 1]
            cv2.line(egg_layer, p1, p2, (30, 20, 15), random.randint(1, 2), cv2.LINE_AA)
            # Subtle white highlight alongside fracture
            cv2.line(egg_layer, (p1[0] + 1, p1[1]), (p2[0] + 1, p2[1]), (255, 255, 255), 1, cv2.LINE_AA)

    elif defect_type == "dirt_stain":
        # Draw irregular brown/black organic stain patch
        stain_x = cx + random.randint(-rx // 2, rx // 2)
        stain_y = cy + random.randint(-ry // 3, ry // 3)
        stain_r = random.randint(15, 30)
        
        stain_mask = np.zeros((height, width), dtype=np.uint8)
        for _ in range(5):
            ox = stain_x + random.randint(-stain_r // 2, stain_r // 2)
            oy = stain_y + random.randint(-stain_r // 2, stain_r // 2)
            rad = random.randint(stain_r // 2, stain_r)
            cv2.circle(stain_mask, (ox, oy), rad, 255, -1)
            
        stain_mask = cv2.bitwise_and(stain_mask, egg_mask)
        stain_mask = cv2.GaussianBlur(stain_mask, (15, 15), 0)
        
        dirt_color = np.array([65, 45, 25], dtype=np.float32)
        alpha = (stain_mask.astype(np.float32) / 255.0) * 0.85
        
        for c in range(3):
            egg_layer[:, :, c] = (egg_layer[:, :, c] * (1 - alpha) + dirt_color[c] * alpha).astype(np.uint8)

    elif defect_type == "blood_spot":
        # Draw reddish crimson droplet/spot
        spot_x = cx + random.randint(-rx // 3, rx // 3)
        spot_y = cy + random.randint(-ry // 3, ry // 3)
        spot_r = random.randint(8, 14)
        
        spot_mask = np.zeros((height, width), dtype=np.uint8)
        cv2.circle(spot_mask, (spot_x, spot_y), spot_r, 255, -1)
        spot_mask = cv2.bitwise_and(spot_mask, egg_mask)
        spot_mask = cv2.GaussianBlur(spot_mask, (7, 7), 0)
        
        blood_color = np.array([160, 20, 20], dtype=np.float32)
        alpha = (spot_mask.astype(np.float32) / 255.0) * 0.90
        
        for c in range(3):
            egg_layer[:, :, c] = (egg_layer[:, :, c] * (1 - alpha) + blood_color[c] * alpha).astype(np.uint8)

    # 4. Composite Egg onto Background with smooth anti-aliased edge
    edge_blur = cv2.GaussianBlur(egg_mask, (7, 7), 0).astype(np.float32) / 255.0
    for c in range(3):
        img[:, :, c] = (egg_layer[:, :, c] * edge_blur + img[:, :, c] * (1.0 - edge_blur)).astype(np.uint8)

    return img, defect_metadata


def generate_tray_image(
    rows: int = 2,
    cols: int = 3,
    defect_distribution: list[str] | None = None,
    width: int = 800,
    height: int = 600
) -> tuple[np.ndarray, list[dict]]:
    """Generates a synthetic egg carton or tray with multiple eggs for testing and demos."""
    img = generate_table_background(width, height)
    
    pad_w = int(width * 0.08)
    pad_h = int(height * 0.08)
    carton_x1, carton_y1 = pad_w, pad_h
    carton_x2, carton_y2 = width - pad_w, height - pad_h
    carton_color = (75, 80, 90)  # Industrial molded pulp / plastic flat color
    cv2.rectangle(img, (carton_x1, carton_y1), (carton_x2, carton_y2), carton_color, -1)
    cv2.rectangle(img, (carton_x1, carton_y1), (carton_x2, carton_y2), (55, 60, 68), 3)

    if defect_distribution is None:
        defect_distribution = ["clean", "crack", "clean", "dirt_stain", "clean", "blood_spot"]

    cell_w = (carton_x2 - carton_x1) // cols
    cell_h = (carton_y2 - carton_y1) // rows
    egg_rx = int(cell_w * 0.32)
    egg_ry = int(cell_h * 0.38)

    egg_metas = []
    idx = 0
    for r in range(rows):
        for c in range(cols):
            cx = carton_x1 + c * cell_w + cell_w // 2
            cy = carton_y1 + r * cell_h + cell_h // 2
            
            # Recessed egg cup
            cv2.ellipse(img, (cx, cy + 4), (egg_rx + 4, egg_ry + 4), 0, 0, 360, (55, 60, 70), -1)

            defect = defect_distribution[idx % len(defect_distribution)]
            shell_color = (235, 195, 160)
            egg_mask = np.zeros((height, width), dtype=np.uint8)
            cv2.ellipse(egg_mask, (cx, cy), (egg_rx, egg_ry), 0, 0, 360, 255, -1)
            
            egg_layer = np.zeros_like(img)
            egg_layer[:] = shell_color

            if defect == "crack":
                pts = [(cx - 15, cy - 10), (cx - 5, cy + 5), (cx + 10, cy + 18)]
                cv2.polylines(egg_layer, [np.array(pts)], False, (35, 25, 20), 2)
            elif defect == "dirt_stain":
                cv2.circle(egg_layer, (cx + 5, cy + 5), 10, (70, 50, 30), -1)
            elif defect == "blood_spot":
                cv2.circle(egg_layer, (cx - 4, cy - 2), 6, (180, 20, 20), -1)

            mask_float = cv2.GaussianBlur(egg_mask, (5, 5), 0).astype(np.float32) / 255.0
            for ch in range(3):
                img[:, :, ch] = (egg_layer[:, :, ch] * mask_float + img[:, :, ch] * (1.0 - mask_float)).astype(np.uint8)

            egg_metas.append({
                "egg_id": idx + 1,
                "center": (cx, cy),
                "defect": defect
            })
            idx += 1

    return img, egg_metas

