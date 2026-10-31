import { SampleEgg } from "./types";

export const SAMPLE_EGGS: SampleEgg[] = [
  {
    id: "clean_brown.jpg",
    label: "Clean Brown",
    expected: "Grade A",
    badgeClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20",
  },
  {
    id: "clean_white.jpg",
    label: "Clean White",
    expected: "Grade A",
    badgeClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20",
  },
  {
    id: "dirt_stain.jpg",
    label: "Dirt Stain",
    expected: "Grade B",
    badgeClass: "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20",
  },
  {
    id: "deformed_egg.jpg",
    label: "Deformed Shell",
    expected: "Grade B",
    badgeClass: "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20",
  },
  {
    id: "crack_fissure.jpg",
    label: "Crack Fissure",
    expected: "Reject",
    badgeClass: "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20",
  },
  {
    id: "blood_spot.jpg",
    label: "Blood Spot",
    expected: "Reject",
    badgeClass: "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20",
  },
];

export const USDA_DIRECTIVES = [
  {
    grade: "Grade A/AA",
    color: "bg-emerald-500",
    desc: "Shell unbroken, clean, practically normal shape. Suitable for retail table market.",
  },
  {
    grade: "Grade B",
    color: "bg-amber-500",
    desc: "Unbroken, slight stains (<3% surface), slight deformities. For commercial baking/processing.",
  },
  {
    grade: "Reject",
    color: "bg-rose-500",
    desc: "Cracks, leaks, blood spots, or heavy contamination. Unfit for human consumption.",
  },
];

