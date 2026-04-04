// KwikBridge LMS — Field Verification Module (ENH-02)
// Mobile-first site visit capture with GPS, photos, and structured checklist.
// Matches FinnOne Neo's geo-tagged mobile sourcing capability.

// ═══ Types ═══

export interface SiteVisitChecklist {
  id: string;
  appId: string;
  custId: string;
  officerId: string;
  officerName: string;
  startedAt: number;
  completedAt: number | null;
  location: GeoLocation | null;
  addressMatch: "match" | "mismatch" | "unknown";
  distanceMetres: number | null;
  categories: ChecklistCategory[];
  overallScore: number;         // calculated 1.0-5.0
  photos: SiteVisitPhoto[];
  notes: string;
  synced: boolean;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;             // metres
  timestamp: number;
}

export interface ChecklistCategory {
  key: string;
  label: string;
  items: ChecklistItem[];
  categoryScore: number;        // average of item ratings
}

export interface ChecklistItem {
  key: string;
  label: string;
  rating: 0 | 1 | 2 | 3 | 4 | 5;  // 0 = not assessed
  observation: string;
  photoIds: string[];
}

export interface SiteVisitPhoto {
  id: string;
  checklistItem: string;        // key of the item this photo belongs to
  dataUrl: string;              // compressed base64
  capturedAt: number;
  location: GeoLocation | null;
  caption: string;
}

// ═══ Default Checklist Template (from SOP Appendix A) ═══

export const CHECKLIST_TEMPLATE: Omit<ChecklistCategory, "categoryScore">[] = [
  {
    key: "premises",
    label: "Premises & Location",
    items: [
      { key: "premises_condition", label: "General condition of premises", rating: 0, observation: "", photoIds: [] },
      { key: "premises_signage", label: "Business signage visible and professional", rating: 0, observation: "", photoIds: [] },
      { key: "premises_access", label: "Accessibility for customers and deliveries", rating: 0, observation: "", photoIds: [] },
      { key: "premises_security", label: "Security measures (fencing, alarms, guards)", rating: 0, observation: "", photoIds: [] },
      { key: "premises_ownership", label: "Premises ownership/lease arrangement", rating: 0, observation: "", photoIds: [] },
    ],
  },
  {
    key: "operations",
    label: "Operations & Production",
    items: [
      { key: "ops_activity", label: "Evidence of active business operations", rating: 0, observation: "", photoIds: [] },
      { key: "ops_stock", label: "Stock/inventory levels appropriate", rating: 0, observation: "", photoIds: [] },
      { key: "ops_equipment", label: "Equipment condition and adequacy", rating: 0, observation: "", photoIds: [] },
      { key: "ops_workflow", label: "Workflow organisation and efficiency", rating: 0, observation: "", photoIds: [] },
    ],
  },
  {
    key: "staff",
    label: "Staff & Management",
    items: [
      { key: "staff_presence", label: "Staff present and productively engaged", rating: 0, observation: "", photoIds: [] },
      { key: "staff_management", label: "Management competence and availability", rating: 0, observation: "", photoIds: [] },
      { key: "staff_training", label: "Evidence of staff training/development", rating: 0, observation: "", photoIds: [] },
    ],
  },
  {
    key: "equipment",
    label: "Equipment & Assets",
    items: [
      { key: "equip_condition", label: "Condition of key equipment/machinery", rating: 0, observation: "", photoIds: [] },
      { key: "equip_maintenance", label: "Maintenance records/practices", rating: 0, observation: "", photoIds: [] },
      { key: "equip_utilisation", label: "Utilisation rate of equipment", rating: 0, observation: "", photoIds: [] },
    ],
  },
  {
    key: "general",
    label: "General Assessment",
    items: [
      { key: "gen_compliance", label: "Regulatory compliance (licences, permits visible)", rating: 0, observation: "", photoIds: [] },
      { key: "gen_records", label: "Record-keeping practices observed", rating: 0, observation: "", photoIds: [] },
      { key: "gen_impression", label: "Overall business viability impression", rating: 0, observation: "", photoIds: [] },
    ],
  },
];

// ═══ GPS Capture ═══

export async function captureLocation(): Promise<GeoLocation | null> {
  if (!navigator?.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: Date.now(),
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

/**
 * Calculate distance between two GPS coordinates (Haversine formula).
 * Returns distance in metres.
 */
export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in metres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if captured GPS matches the registered business address.
 * Requires geocoded address coordinates (from customer record or lookup).
 */
export function checkAddressMatch(
  captured: GeoLocation,
  registeredLat: number,
  registeredLon: number,
  thresholdMetres = 500
): { match: "match" | "mismatch"; distance: number } {
  const distance = Math.round(calculateDistance(
    captured.latitude, captured.longitude,
    registeredLat, registeredLon
  ));
  return {
    match: distance <= thresholdMetres ? "match" : "mismatch",
    distance,
  };
}

// ═══ Photo Capture & Compression ═══

/**
 * Compress an image to max 2MB using canvas resize.
 * Input: File from camera input or file picker.
 * Output: compressed base64 data URL.
 */
export async function compressPhoto(file: File, maxSizeKB = 2048, maxDimension = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }

        ctx.drawImage(img, 0, 0, width, height);

        // Compress with decreasing quality until under maxSizeKB
        let quality = 0.85;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);

        while (dataUrl.length > maxSizeKB * 1370 && quality > 0.3) { // ~1.37 bytes per base64 char
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ═══ Checklist Scoring ═══

/**
 * Calculate scores for a completed checklist.
 * Returns categories with scores and overall score.
 */
export function calculateScores(categories: ChecklistCategory[]): {
  categories: ChecklistCategory[];
  overallScore: number;
} {
  const scored = categories.map(cat => {
    const ratedItems = cat.items.filter(item => item.rating > 0);
    const categoryScore = ratedItems.length > 0
      ? Math.round((ratedItems.reduce((s, i) => s + i.rating, 0) / ratedItems.length) * 100) / 100
      : 0;
    return { ...cat, categoryScore };
  });

  const scoredCats = scored.filter(c => c.categoryScore > 0);
  const overallScore = scoredCats.length > 0
    ? Math.round((scoredCats.reduce((s, c) => s + c.categoryScore, 0) / scoredCats.length) * 100) / 100
    : 0;

  return { categories: scored, overallScore };
}

// ═══ Create New Site Visit ═══

export function createSiteVisit(
  appId: string,
  custId: string,
  officerId: string,
  officerName: string
): SiteVisitChecklist {
  return {
    id: `SV-${Date.now()}`,
    appId,
    custId,
    officerId,
    officerName,
    startedAt: Date.now(),
    completedAt: null,
    location: null,
    addressMatch: "unknown",
    distanceMetres: null,
    categories: CHECKLIST_TEMPLATE.map(cat => ({ ...cat, categoryScore: 0 })),
    overallScore: 0,
    photos: [],
    notes: "",
    synced: false,
  };
}

// ═══ Offline Storage ═══

const OFFLINE_KEY = "kwikbridge_pending_site_visits";

export function saveSiteVisitOffline(visit: SiteVisitChecklist) {
  try {
    const existing = JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
    const updated = existing.filter((v: any) => v.id !== visit.id);
    updated.push(visit);
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(updated));
  } catch { /* storage full or unavailable */ }
}

export function getPendingSiteVisits(): SiteVisitChecklist[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
  } catch { return []; }
}

export function removeSyncedVisit(visitId: string) {
  try {
    const existing = JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(existing.filter((v: any) => v.id !== visitId)));
  } catch { /* ignore */ }
}
