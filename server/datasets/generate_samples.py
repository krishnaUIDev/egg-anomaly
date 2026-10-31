"""Generates sample test images for each defect class into datasets/samples."""

import os
import cv2
from datasets.synthetic_generator import generate_egg_image


def generate_all_samples():
    output_dir = os.path.join(os.path.dirname(__file__), "samples")
    os.makedirs(output_dir, exist_ok=True)

    conditions = [
        ("clean_brown", "clean", "brown"),
        ("clean_white", "clean", "white"),
        ("crack_fissure", "crack", "brown"),
        ("dirt_stain", "dirt_stain", "brown"),
        ("blood_spot", "blood_spot", "white"),
        ("deformed_egg", "deformed", "brown"),
    ]

    generated_paths = []
    for name, defect, color in conditions:
        img_rgb, meta = generate_egg_image(defect_type=defect, shell_color=color)
        filepath = os.path.join(output_dir, f"{name}.jpg")
        cv2.imwrite(filepath, cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR))
        generated_paths.append(filepath)
        print(f"Generated sample: {filepath}")

    return generated_paths


if __name__ == "__main__":
    generate_all_samples()

