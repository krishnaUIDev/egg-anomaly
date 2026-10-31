"""Synthetic Egg Image Generator for Benchmarking, Testing, and Demos.
Simulates phone camera captures of clean eggs and various defect conditions
(cracks, dirt/stains, blood spots, and irregular shapes) on realistic kitchen/table backgrounds.
"""

import math
import random
from typing import Tuple
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
) -> Tuple[np.ndarray, dict]:
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

