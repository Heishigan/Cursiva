// CV and cover letter designs, chosen once in Settings. Ids must match backend/cv_templates.py.
// Images in /public/templates are renders of the same sample CV in each style.
export type CvTemplateId = "classic" | "modern" | "editorial" | "technical" | "signature";

export interface CvTemplate {
  id: CvTemplateId;
  name: string;
  blurb: string;
  credit?: { label: string; href: string };
}

export const CV_TEMPLATES: CvTemplate[] = [
  { id: "classic", name: "Classic", blurb: "Serif, centred header, ruled sections",
    credit: { label: "Based on Jake's Resume", href: "https://github.com/jakegut/resume" } },
  { id: "modern", name: "Modern", blurb: "Clean sans, teal section titles" },
  { id: "editorial", name: "Editorial", blurb: "Garamond, small caps, burgundy" },
  { id: "technical", name: "Technical", blurb: "Fira Sans, monospace dates, indigo" },
  { id: "signature", name: "Signature", blurb: "Two-weight blue name, arrow bullets" },
];

export const DEFAULT_CV_TEMPLATE: CvTemplateId = "classic";

export const isCvTemplateId = (v: unknown): v is CvTemplateId =>
  typeof v === "string" && CV_TEMPLATES.some((t) => t.id === v);

export const cvTemplateName = (id: unknown): string =>
  (CV_TEMPLATES.find((t) => t.id === id) ?? CV_TEMPLATES[0]).name;
