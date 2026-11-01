"""Phone camera image preprocessing, EXIF orientation correction,
egg ROI segmentation, and lighting normalization.
"""

from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageOps


@dataclass
class EggROI:
    """Represents the segmented egg Region of Interest."""
    original_rgb: np.ndarray          # Original image in RGB
    preprocessed_rgb: np.ndarray      # Lighting-normalized full image (RGB)
    cropped_egg_rgb: np.ndarray       # Cropped bounding box of egg (RGB)
    mask: np.ndarray                  # Binary mask of the egg (0 or 255)
    bbox: tuple[int, int, int, int]   # (x, y, w, h) in original coordinate space
    confidence: float                 # Confidence that an egg was detected (0.0 - 1.0)
    aspect_ratio: float               # Height / Width ratio of the egg contour
    solidity: float                   # Contour area / Convex hull area
    row: int = 0                      # 0-indexed row position in tray matrix
    col: int = 0                      # 0-indexed column position in tray matrix


def fix_exif_orientation(pil_image: Image.Image) -> Image.Image:
    """Corrects phone image orientation based on EXIF metadata."""
    try:
        return ImageOps.exif_transpose(pil_image)
    except Exception:
        return pil_image


def normalize_lighting(rgb_image: np.ndarray, clip_limit: float = 2.0, tile_grid_size: tuple[int, int] = (8, 8)) -> np.ndarray:
    """Applies CLAHE (Contrast Limited Adaptive Histogram Equalization)

    to the Luminance channel in LAB color space to balance shadows and phone flash reflections.
    """
    lab = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    l_eq = clahe.apply(l_channel)
    
    merged_lab = cv2.merge((l_eq, a_channel, b_channel))
    return cv2.cvtColor(merged_lab, cv2.COLOR_LAB2RGB)


def isolate_egg_roi(rgb_image: np.ndarray, target_size: int = 512) -> EggROI:
    """Detects and isolates the egg contour from phone camera background clutter.

    Returns an EggROI with cropped egg, binary mask, and normalized lighting.
    """
    height, width, _ = rgb_image.shape
    preprocessed = normalize_lighting(rgb_image)
    
    # Convert to grayscale for contour analysis
    gray = cv2.cvtColor(preprocessed, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    
    # Multi-strategy segmentation: Otsu thresholding + Adaptive thresholding
    _, otsu_thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Invert if the background was lighter than foreground
    # Eggs are typically central and oval
    h_margin, w_margin = height // 10, width // 10
    corner_pixels = [
        otsu_thresh[0:h_margin, 0:w_margin],
        otsu_thresh[0:h_margin, -w_margin:],
        otsu_thresh[-h_margin:, 0:w_margin],
        otsu_thresh[-h_margin:, -w_margin:]
    ]
    mean_corners = np.mean([np.mean(c) for c in corner_pixels])
    if mean_corners > 127:
        # Background is white/bright, invert so egg is white
        binary = cv2.bitwise_not(otsu_thresh)
    else:
        binary = otsu_thresh

    # Morphological close to bridge internal shell shadows
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
    closed = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel, iterations=1)

    # Find contours
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    img_area = float(height * width)
    best_cnt = None
    best_score = -1.0
    best_bbox = (0, 0, width, height)
    best_solidity = 0.0
    best_ar = 1.0

    for cnt in contours:
        area = cv2.contourArea(cnt)
        # Egg should occupy a reasonable portion of the phone frame (e.g., 5% to 90%)
        if area < (0.03 * img_area) or area > (0.95 * img_area):
            continue
            
        x, y, w, h = cv2.boundingRect(cnt)
        aspect_ratio = max(w, h) / max(min(w, h), 1)
        
        hull = cv2.convexHull(cnt)
        hull_area = cv2.contourArea(hull)
        solidity = float(area) / max(hull_area, 1.0)
        
        # Eggs have high solidity (> 0.85) and an oval aspect ratio (1.05 to 1.75)
        # Score based on typical egg shape characteristics
        shape_fitness = 1.0
        if 1.05 <= aspect_ratio <= 1.8:
            shape_fitness += 1.0
        if solidity >= 0.88:
            shape_fitness += 1.0
            
        score = (area / img_area) * shape_fitness * solidity
        
        if score > best_score:
            best_score = score
            best_cnt = cnt
            best_bbox = (x, y, w, h)
            best_solidity = solidity
            best_ar = aspect_ratio

    # Generate mask
    mask = np.zeros((height, width), dtype=np.uint8)
    if best_cnt is not None:
        cv2.drawContours(mask, [best_cnt], -1, 255, -1)
        x, y, w, h = best_bbox
        # Add 5% padding around ROI
        pad_x = int(w * 0.05)
        pad_y = int(h * 0.05)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(width, x + w + pad_x)
        y2 = min(height, y + h + pad_y)
        
        cropped = preprocessed[y1:y2, x1:x2]
        confidence = min(0.99, max(0.60, best_solidity * 0.9))
        actual_bbox = (x1, y1, x2 - x1, y2 - y1)
    else:
        # Fallback: assume the egg occupies the central region
        mask[int(height * 0.1):int(height * 0.9), int(width * 0.1):int(width * 0.9)] = 255
        cropped = preprocessed
        actual_bbox = (0, 0, width, height)
        confidence = 0.50
        best_ar = float(height) / float(width)
        best_solidity = 0.80

    # Resize cropped ROI to standardized target size for model consistency
    if cropped.size > 0:
        resized_crop = cv2.resize(cropped, (target_size, target_size), interpolation=cv2.INTER_AREA)
    else:
        resized_crop = cv2.resize(preprocessed, (target_size, target_size))

    return EggROI(
        original_rgb=rgb_image,
        preprocessed_rgb=preprocessed,
        cropped_egg_rgb=resized_crop,
        mask=mask,
        bbox=actual_bbox,
        confidence=float(confidence),
        aspect_ratio=float(best_ar),
        solidity=float(best_solidity)
    )


def isolate_all_egg_rois(
    rgb_image: np.ndarray,
    target_size: int = 256,
    max_eggs: int = 36
) -> list[EggROI]:
    """Detects and isolates all individual eggs in a carton or tray photo (e.g. 6, 12, 18, 30 eggs).

    Returns a list of EggROI sorted in reading order (top-to-bottom, left-to-right).
    """
    height, width, _ = rgb_image.shape
    preprocessed = normalize_lighting(rgb_image)
    gray = cv2.cvtColor(preprocessed, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)

    # Multi-strategy segmentation
    _, otsu_thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Check background polarity
    h_margin, w_margin = max(height // 12, 10), max(width // 12, 10)
    corner_pixels = [
        otsu_thresh[0:h_margin, 0:w_margin],
        otsu_thresh[0:h_margin, -w_margin:],
        otsu_thresh[-h_margin:, 0:w_margin],
        otsu_thresh[-h_margin:, -w_margin:]
    ]
    mean_corners = np.mean([np.mean(c) for c in corner_pixels])
    if mean_corners > 127:
        binary = cv2.bitwise_not(otsu_thresh)
    else:
        binary = otsu_thresh

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Use distance transform to separate touching eggs in tray
    dist = cv2.distanceTransform(closed, cv2.DIST_L2, 5)
    _, sure_fg = cv2.threshold(dist, 0.30 * dist.max(), 255, 0)
    sure_fg = np.uint8(sure_fg)

    contours, _ = cv2.findContours(sure_fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    img_area = float(height * width)

    candidates = []
    # In a 30-egg tray, an egg is ~0.005 to 0.04 of total area; in a 6-egg carton ~0.03 to 0.18
    min_area = 0.003 * img_area
    max_area = 0.40 * img_area

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        
        x, y, w, h = cv2.boundingRect(cnt)
        aspect_ratio = max(w, h) / max(min(w, h), 1)
        if aspect_ratio > 2.2:
            continue
            
        hull = cv2.convexHull(cnt)
        solidity = float(area) / max(cv2.contourArea(hull), 1.0)
        if solidity < 0.70:
            continue

        # Expand bounding box slightly for the full egg shell
        pad_x = int(w * 0.25)
        pad_y = int(h * 0.25)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(width, x + w + pad_x)
        y2 = min(height, y + h + pad_y)

        candidates.append({
            "cnt": cnt,
            "center": (x + w // 2, y + h // 2),
            "bbox": (x1, y1, x2 - x1, y2 - y1),
            "solidity": solidity,
            "aspect_ratio": aspect_ratio,
            "area": area
        })

    # Fallback to direct closed contours if distance transform found none
    if len(candidates) == 0:
        raw_contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in raw_contours:
            area = cv2.contourArea(cnt)
            if min_area <= area <= max_area:
                x, y, w, h = cv2.boundingRect(cnt)
                aspect_ratio = max(w, h) / max(min(w, h), 1)
                hull = cv2.convexHull(cnt)
                solidity = float(area) / max(cv2.contourArea(hull), 1.0)
                if aspect_ratio <= 2.2 and solidity >= 0.70:
                    candidates.append({
                        "cnt": cnt,
                        "center": (x + w // 2, y + h // 2),
                        "bbox": (x, y, w, h),
                        "solidity": solidity,
                        "aspect_ratio": aspect_ratio,
                        "area": area
                    })

    # Sort in 2D reading order: cluster into rows based on y-coordinate
    if candidates:
        avg_h = np.mean([c["bbox"][3] for c in candidates])
        row_threshold = max(avg_h * 0.6, 20.0)
        
        candidates.sort(key=lambda c: c["center"][1])
        
        rows = []
        current_row = [candidates[0]]
        for cand in candidates[1:]:
            if abs(cand["center"][1] - current_row[0]["center"][1]) < row_threshold:
                current_row.append(cand)
            else:
                rows.append(current_row)
                current_row = [cand]
        if current_row:
            rows.append(current_row)
            
        sorted_candidates = []
        for r_idx, r in enumerate(rows):
            r.sort(key=lambda c: c["center"][0])
            for c_idx, cand in enumerate(r):
                cand["row"] = r_idx
                cand["col"] = c_idx
                sorted_candidates.append(cand)
        candidates = sorted_candidates[:max_eggs]

    # Convert candidates to EggROI objects
    egg_rois = []
    for cand in candidates:
        x, y, w, h = cand["bbox"]
        cropped = preprocessed[y:y+h, x:x+w]
        if cropped.size == 0:
            continue
        resized_crop = cv2.resize(cropped, (target_size, target_size), interpolation=cv2.INTER_AREA)
        
        egg_mask = np.zeros((height, width), dtype=np.uint8)
        cv2.drawContours(egg_mask, [cand["cnt"]], -1, 255, -1)
        cropped_mask = egg_mask[y:y+h, x:x+w]
        resized_mask = cv2.resize(cropped_mask, (target_size, target_size), interpolation=cv2.INTER_NEAREST)
        if np.count_nonzero(resized_mask) == 0:
            cv2.ellipse(
                resized_mask,
                (target_size // 2, target_size // 2),
                (int(target_size * 0.38), int(target_size * 0.42)),
                0, 0, 360, 255, -1
            )
            
        egg_rois.append(EggROI(
            original_rgb=rgb_image,
            preprocessed_rgb=preprocessed,
            cropped_egg_rgb=resized_crop,
            mask=resized_mask,
            bbox=(x, y, w, h),
            confidence=min(0.98, max(0.65, cand["solidity"] * 0.95)),
            aspect_ratio=cand["aspect_ratio"],
            solidity=cand["solidity"],
            row=cand.get("row", 0),
            col=cand.get("col", 0)
        ))

    return egg_rois

