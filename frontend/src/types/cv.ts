// Shapes of the JSON the backend sends and stores (see backend/core/models.py,
// where these fields are required).

export interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface CvSectionItem {
  title: string;
  subtitle: string;
  date: string;
  url: string;
  context: string;
  bullets: string[];
}

export interface CvSectionData {
  title: string;
  type: string; // skills | education | projects | work_experience | custom
  items: CvSectionItem[];
}

export interface CvData {
  personal_info: PersonalInfo;
  professional_summary: string;
  sections: CvSectionData[];
  template?: string; // the design the server compiled with, kept with saved applications
}

export interface CoverLetterData {
  salutation: string;
  hook: string;
  match: string;
  curiosity: string;
  fit: string;
  sign_off: string;
  company_location?: string;
}

// What the pipeline hands to the Drafts step.
export interface WorkbenchData {
  cv: CvData;
  cl: CoverLetterData;
  company: string;
  role: string;
}

export interface JobMetadata {
  company_name?: string;
  role_name?: string;
  job_summary?: string;
  key_requirements?: string[];
  eligibility_passed?: boolean;
  eligibility_reason?: string;
  company_location?: string;
  is_valid_job_description?: boolean;
}

export interface StrategyResult {
  fit_assessment?: string;
  strategy_plan?: string;
  role_philosophy?: string;
  sharpest_project_insight?: string;
  strategic_options?: string[];
}

// /api/jobs/matches (the backend always stores the three strings)
export interface SavedJobMatch {
  id: string;
  company_name: string;
  role_name: string;
  job_description: string;
  url: string | null;
  match_score: number;
  created_at: string;
}

// /api/applications (list; company and role are required when saving)
export interface ApplicationSummary {
  id: string;
  company_name: string;
  role_name: string;
  status: string;
  created_at: string;
}

// /api/applications/{id}: the CV and letter are stored as JSON strings.
export interface ApplicationDetail extends ApplicationSummary {
  job_description: string;
  cv_data_json: string;
  cl_data_json: string;
}
