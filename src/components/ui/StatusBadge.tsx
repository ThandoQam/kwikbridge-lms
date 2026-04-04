// KwikBridge LMS — Status Badge Utility
import { Badge } from "./Badge";

export function statusBadge(s) {
  const m = { Approved:"green", Active:"green", Disbursed:"green", Verified:"green", Compliant:"green", Cleared:"green", Submitted:"blue", Underwriting:"cyan", Pending:"amber", "Pending Review":"amber", Due:"amber", Overdue:"red", Early:"amber", Mid:"amber", Late:"red", Declined:"red", Breach:"red", Received:"blue", "Under Review":"cyan" };
  return <Badge color={m[s] || "slate"}>{s}</Badge>;
}
