

export interface ICourseMapping {
  id: string;
  lti_context_id: string;
  resource_link_id: string | null;
  course_code: string;
  ki_domain_name: string;
  lab_code: string;
  image_id: string;
  flavor_id: string;
  inspector_template: string | null;
  title: string | null;
  description: string | null;
  default_ttl_seconds: number | null;
}

export interface ICourseMappingPayload {
  lti_context_id: string;
  resource_link_id?: string;
  course_code: string;
  ki_domain_name: string;
  lab_code: string;
  image_id: string;
  flavor_id: string;
  inspector_template?: string;
  title?: string;
  description?: string;
  default_ttl_seconds?: number;
}

export interface ILabLaunchPayload {
  owner_external_id: string;
  owner_display_name?: string;
  attach_floating_ip?: boolean;
}
