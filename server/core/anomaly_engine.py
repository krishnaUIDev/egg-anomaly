"""Computer Vision & Anomaly Detection Engine for Egg Shell Inspection.
Detects cracks, dirt/blood stains, and shape deformities from phone camera captures.
"""

import base64

import cv2
import numpy as np

from core.grading import DefectDetection, DefectType
from core.preprocessing import EggROI


class EggAnomalyEngine:
    """End-to-end anomaly detection and quality inspection engine."""

    def __init__(self, crack_sensitivity: float = 0.5, stain_sensitivity: float = 0.5):
        self.crack_sensitivity = crack_sensitivity
        self.stain_sensitivity = stain_sensitivity

    def analyze(self, roi: EggROI) -> tuple[list[DefectDetection], np.ndarray, np.ndarray]:
        """Runs the complete inspection pipeline on an isolated EggROI.

        Returns:
            - List of detected defects
            - Anomaly heatmap (2D float 0.0 - 1.0)
            - Annotated visualization image (RGB uint8)
        """
        img = roi.cropped_egg_rgb
        h, w, _ = img.shape
        
        # Binary mask for internal egg surface (avoiding outer border/table edge artifacts)
        inner_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.ellipse(inner_mask, (w // 2, h // 2), (int(w * 0.38), int(h * 0.40)), 0, 0, 360, 255, -1)
        egg_area = float(cv2.countNonZero(inner_mask))

        defects: list[DefectDetection] = []
        combined_anomaly_map = np.zeros((h, w), dtype=np.float32)

        # 1. Inspect for Cracks / Micro-fissures
        crack_defects, crack_map = self._detect_cracks(img, inner_mask, egg_area)
        defects.extend(crack_defects)
        combined_anomaly_map = np.maximum(combined_anomaly_map, crack_map)

        # 2. Inspect for Dirt, Blood Spots, and Stains
        stain_defects, stain_map = self._detect_stains(img, inner_mask, egg_area)
        defects.extend(stain_defects)
        combined_anomaly_map = np.maximum(combined_anomaly_map, stain_map)

        # 3. Inspect for Shape Deformity / Shell Irregularity
        shape_defect = self._detect_shape_deformity(roi)
        if shape_defect:
            defects.append(shape_defect)

        # 4. Generate Annotated Visual Overlay
        annotated = self._render_annotations(img, defects, combined_anomaly_map, inner_mask)

        return defects, combined_anomaly_map, annotated

    def _detect_cracks(self, img_rgb: np.ndarray, mask: np.ndarray, egg_area: float) -> tuple[list[DefectDetection], np.ndarray]:
        """Detects high-frequency thin line fissures and cracks using multi-directional gradient filters."""
        h, w, _ = img_rgb.shape
        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
        
        # Median filter to eliminate shell grain while preserving thin crack lines
        smooth = cv2.medianBlur(gray, 3)
        
        # High-pass / Black Hat transform (isolates dark thin lines against lighter shell background)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
        blackhat = cv2.morphologyEx(smooth, cv2.MORPH_BLACKHAT, kernel)
        
        # Apply mask so shell boundaries are not treated as cracks
        blackhat = cv2.bitwise_and(blackhat, blackhat, mask=mask)
        
        # Robust threshold for thin structural cracks (avoids natural shell texture / camera sensor noise)
        thresh_val = int(32 * (1.2 - self.crack_sensitivity * 0.4))
        _, crack_binary = cv2.threshold(blackhat, thresh_val, 255, cv2.THRESH_BINARY)
        
        # Skeleton filter to detect elongated paths
        contours, _ = cv2.findContours(crack_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        crack_defects = []
        crack_heatmap = np.zeros((h, w), dtype=np.float32)

        min_crack_len = max(20.0, w * 0.065)
        min_crack_area = max(10.0, (w * h) * 0.0002)

        for cnt in contours:
            length = cv2.arcLength(cnt, False)
            cnt_area = cv2.contourArea(cnt)
            # A crack must have substantial line length and elongation
            if length > min_crack_len and cnt_area > min_crack_area:
                x, y, bw, bh = cv2.boundingRect(cnt)
                aspect = max(bw, bh) / max(min(bw, bh), 1)
                
                # Check linearity/narrowness (thickness = area / length)
                thickness = cnt_area / max(length, 1.0)
                if aspect > 1.3 and thickness < 8.5:
                    confidence = min(0.98, 0.70 + (length / (w * 0.25)) * 0.25)
                    severity = "critical" if length > (w * 0.12) else "medium"
                    
                    crack_defects.append(DefectDetection(
                        defect_type=DefectType.CRACK,
                        confidence=round(confidence, 2),
                        severity=severity,
                        bbox=[x, y, bw, bh],
                        area_ratio=cnt_area / max(egg_area, 1.0),
                        description=f"Linear shell fracture / crack (length: {int(length)}px)"
                    ))
                    
                    cv2.drawContours(crack_heatmap, [cnt], -1, float(confidence), -1)

        # Smooth crack heatmap
        if np.max(crack_heatmap) > 0:
            crack_heatmap = cv2.GaussianBlur(crack_heatmap, (15, 15), 0)
            crack_heatmap = np.clip(crack_heatmap / np.max(crack_heatmap), 0.0, 1.0)

        return crack_defects, crack_heatmap

    def _detect_stains(self, img_rgb: np.ndarray, mask: np.ndarray, egg_area: float) -> tuple[list[DefectDetection], np.ndarray]:
        """Detects organic stains, blood spots, and dirt by localized chromatic and luminance deviation from surrounding shell surface."""
        h, w, _ = img_rgb.shape
        lab = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2LAB)
        
        # Calculate median shell color inside mask
        masked_pixels = lab[mask > 0]
        if len(masked_pixels) == 0:
            return [], np.zeros((h, w), dtype=np.float32)
            
        median_l = np.median(masked_pixels[:, 0])
        median_a = np.median(masked_pixels[:, 1])
        median_b = np.median(masked_pixels[:, 2])

        l_channel = lab[:, :, 0].astype(np.float32)
        # Adapt blur kernel to image resolution to model natural smooth 3D spherical shading
        blur_k = max(31, (w // 7) | 1)
        smooth_shading = cv2.GaussianBlur(l_channel, (blur_k, blur_k), 0)
        # Localized dark spots deviate sharply from their local neighborhood
        local_luminance_drop = np.maximum(0, smooth_shading - l_channel)

        # Chromaticity deviation from shell baseline
        diff_a = (lab[:, :, 1].astype(np.float32) - median_a)
        diff_b = (lab[:, :, 2].astype(np.float32) - median_b)
        chroma_dist = np.sqrt(diff_a**2 + diff_b**2)
        
        # Dirt/stains are both locally darker and chromatically distinct
        stain_signal = (local_luminance_drop * 1.5) + (chroma_dist * 1.1)
        stain_signal = cv2.bitwise_and(stain_signal, stain_signal, mask=mask)
        
        # Threshold adjusted by sensitivity (avoids smooth lighting gradients)
        thresh_val = 32.0 * (1.2 - self.stain_sensitivity * 0.4)
        _, stain_binary = cv2.threshold(stain_signal.astype(np.uint8), int(thresh_val), 255, cv2.THRESH_BINARY)
        
        # Remove small speckles / single pixel noise
        clean_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        stain_binary = cv2.morphologyEx(stain_binary, cv2.MORPH_OPEN, clean_kernel)
        
        contours, _ = cv2.findContours(stain_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        stain_defects = []
        stain_heatmap = np.zeros((h, w), dtype=np.float32)

        min_area_thresh = max(40.0, (w * h) * 0.0006)

        for cnt in contours:
            cnt_area = cv2.contourArea(cnt)
            if cnt_area > min_area_thresh:
                x, y, bw, bh = cv2.boundingRect(cnt)
                area_ratio = cnt_area / max(egg_area, 1.0)
                
                # Check if it has a reddish/blood signature
                patch_a = lab[y:y+bh, x:x+bw, 1]
                mean_a = np.mean(patch_a)
                is_blood = mean_a > (median_a + 14)
                
                defect_type = DefectType.BLOOD_SPOT if is_blood else DefectType.DIRT_STAIN
                severity = "critical" if area_ratio > 0.05 or is_blood else "low"
                confidence = min(0.95, 0.65 + min(0.30, area_ratio * 12.0))

                stain_defects.append(DefectDetection(
                    defect_type=defect_type,
                    confidence=round(confidence, 2),
                    severity=severity,
                    bbox=[x, y, bw, bh],
                    area_ratio=round(area_ratio, 4),
                    description="Red blood spot on shell" if is_blood else f"Surface stain/dirt covering {area_ratio:.1%} of egg"
                ))
                
                cv2.drawContours(stain_heatmap, [cnt], -1, float(confidence), -1)

        if np.max(stain_heatmap) > 0:
            stain_heatmap = cv2.GaussianBlur(stain_heatmap, (21, 21), 0)
            stain_heatmap = np.clip(stain_heatmap / np.max(stain_heatmap), 0.0, 1.0)

        return stain_defects, stain_heatmap

    def _detect_shape_deformity(self, roi: EggROI) -> DefectDetection | None:
        """Detects whether the egg geometry deviates significantly from standard prolate ellipsoid proportions."""
        # Standard eggs have aspect ratio ~ 1.25 to 1.55, and high convexity/solidity (> 0.92)
        ar = roi.aspect_ratio
        solidity = roi.solidity
        
        is_abnormal_ar = (ar < 1.08) or (ar > 1.78)
        is_low_solidity = solidity < 0.86
        
        if is_abnormal_ar or is_low_solidity:
            severity = "critical" if (ar > 1.9 or ar < 1.04 or solidity < 0.80) else "medium"
            conf = min(0.95, 0.65 + abs(ar - 1.4) * 0.3)
            return DefectDetection(
                defect_type=DefectType.SHAPE_DEFORMITY,
                confidence=round(conf, 2),
                severity=severity,
                bbox=list(roi.bbox),
                area_ratio=1.0 - solidity,
                description=f"Abnormal shell shape (Aspect Ratio: {ar:.2f}, Solidity: {solidity:.2f})"
            )
        return None

    def _render_annotations(self, img_rgb: np.ndarray, defects: list[DefectDetection], heatmap: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """Renders defect bounding boxes, labels, and translucent heatmap on the inspection image."""
        canvas = img_rgb.copy()
        
        # Blend heatmap if anomalies detected
        if np.max(heatmap) > 0.05:
            colored_map = cv2.applyColorMap((heatmap * 255).astype(np.uint8), cv2.COLORMAP_JET)
            colored_map_rgb = cv2.cvtColor(colored_map, cv2.COLOR_BGR2RGB)
            
            # Blend only where mask is active and heatmap is non-zero
            blend_mask = (heatmap > 0.1) & (mask > 0)
            alpha = 0.45
            canvas[blend_mask] = (alpha * colored_map_rgb[blend_mask] + (1 - alpha) * canvas[blend_mask]).astype(np.uint8)

        # Draw bounding boxes
        for defect in defects:
            x, y, w, h = defect.bbox
            
            # Color coding: Red for Crack/Critical, Orange for Stains, Purple for Shape
            if defect.defect_type == DefectType.CRACK:
                color = (235, 35, 35)       # Red
            elif defect.defect_type == DefectType.BLOOD_SPOT:
                color = (180, 0, 40)        # Dark Crimson
            elif defect.defect_type == DefectType.DIRT_STAIN:
                color = (245, 155, 10)      # Amber / Orange
            else:
                color = (160, 32, 240)      # Purple

            cv2.rectangle(canvas, (x, y), (x + w, y + h), color, 2)
            
            label = f"{defect.defect_type.value.upper()} {defect.confidence:.0%}"
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(canvas, (x, max(0, y - lh - 6)), (x + lw + 4, max(lh + 6, y)), color, -1)
            cv2.putText(canvas, label, (x + 2, max(lh + 2, y - 3)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        return canvas


def encode_image_base64(img_rgb: np.ndarray, format: str = "JPEG") -> str:
    """Converts a numpy RGB image array into a base64 encoded data URI."""
    success, buffer = cv2.imencode(f".{format.lower()}", cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR))
    if not success:
        return ""
    b64 = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/{format.lower()};base64,{b64}"
