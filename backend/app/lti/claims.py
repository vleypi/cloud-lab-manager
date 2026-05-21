CL_MESSAGE_TYPE = "https://purl.imsglobal.org/spec/lti/claim/message_type"
CL_VERSION = "https://purl.imsglobal.org/spec/lti/claim/version"
CL_DEPLOYMENT_ID = "https://purl.imsglobal.org/spec/lti/claim/deployment_id"
CL_TARGET_LINK_URI = "https://purl.imsglobal.org/spec/lti/claim/target_link_uri"
CL_RESOURCE_LINK = "https://purl.imsglobal.org/spec/lti/claim/resource_link"
CL_ROLES = "https://purl.imsglobal.org/spec/lti/claim/roles"
CL_CONTEXT = "https://purl.imsglobal.org/spec/lti/claim/context"
CL_CUSTOM = "https://purl.imsglobal.org/spec/lti/claim/custom"
CL_TOOL_PLATFORM = "https://purl.imsglobal.org/spec/lti/claim/tool_platform"
CL_PRESENTATION = "https://purl.imsglobal.org/spec/lti/claim/launch_presentation"
CL_LIS = "https://purl.imsglobal.org/spec/lti/claim/lis"

LTI_VERSION = "1.3.0"
MESSAGE_TYPE_RESOURCE_LINK = "LtiResourceLinkRequest"
MESSAGE_TYPE_DEEP_LINKING = "LtiDeepLinkingRequest"

TEACHER_ROLE_KEYWORDS = (
    "Instructor",
    "Administrator",
    "TeachingAssistant",
    "ContentDeveloper",
)

def is_teacher(roles: list[str]) -> bool:
    return any(any(k in r for k in TEACHER_ROLE_KEYWORDS) for r in roles)
