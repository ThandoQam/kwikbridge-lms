// KwikBridge LMS — Status Enums

export const APPLICATION_STATUSES = {
  PRE_APPROVAL: "Pre-Approval", DRAFT: "Draft", SUBMITTED: "Submitted",
  UNDERWRITING: "Underwriting", APPROVED: "Approved", DECLINED: "Declined",
  BOOKED: "Booked", WITHDRAWN: "Withdrawn", EXPIRED: "Expired",
};

export const LOAN_STATUSES = {
  BOOKED: "Booked", ACTIVE: "Active", SETTLED: "Settled", WRITTEN_OFF: "Written Off",
};

export const FICA_STATUSES = {
  PENDING: "Pending", VERIFIED: "Verified", FAILED: "Failed", EXPIRED: "Expired",
};

export const BEE_STATUSES = {
  PENDING_REVIEW: "Pending Review", VERIFIED: "Verified", NON_COMPLIANT: "Non-Compliant",
};

export const DOCUMENT_STATUSES = {
  PENDING_REVIEW: "Pending Review", UNDER_REVIEW: "Under Review",
  VERIFIED: "Verified", REJECTED: "Rejected",
};

export const COLLECTION_STAGES = { EARLY: "Early", MID: "Mid", LATE: "Late" };

export const STATUTORY_STATUSES = {
  NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress", SUBMITTED: "Submitted",
};
