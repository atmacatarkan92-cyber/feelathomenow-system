/**
 * Shared German labels for audit-history field names (admin entity detail pages).
 * Entity pages spread this and add overrides for entity-specific fields.
 */
export const COMMON_AUDIT_FIELD_LABELS = {
  name: "Name",
  email: "E-Mail",
  phone: "Telefonnummer",
  status: "Status",
  address_line1: "Adresse",
  postal_code: "PLZ",
  city: "Ort",
  canton: "Kanton",
  notes: "Notizen",
};

/** Per-entity field labels for audit diff display (falls back to COMMON_AUDIT_FIELD_LABELS via getAuditFieldLabel). */
export const ENTITY_AUDIT_LABELS = {
  unit: {
    landlord_id: "Verwaltung",
    property_manager_id: "Bewirtschafter",
    owner_id: "Eigentümer",
    property_id: "Liegenschaft",
    title: "Titel",
    address: "Adresse",
    city: "Ort",
    postal_code: "PLZ",
    rooms: "Zimmeranzahl",
    type: "Typ",
    tenant_price_monthly_chf: "Mieterpreis",
    landlord_rent_monthly_chf: "Mietkosten Vermieter",
    utilities_monthly_chf: "Nebenkosten",
    cleaning_cost_monthly_chf: "Reinigung",
    occupancy_status: "Belegungsstatus",
    occupied_rooms: "belegte Zimmer",
    landlord_lease_start_date: "Mietstart Vermieter",
    available_from: "Verfügbar ab",
    landlord_deposit_type: "Kautionsart Vermieter",
    landlord_deposit_amount: "Kaution Vermieter",
    landlord_deposit_annual_premium: "Kautionsprämie",
  },
  inventory_item: {
    name: "Name",
    category: "Kategorie",
    brand: "Marke",
    total_quantity: "Gesamtmenge",
    condition: "Zustand",
    status: "Status",
    purchase_price_chf: "Anschaffung CHF",
    purchase_date: "Kaufdatum",
    purchased_from: "Gekauft bei",
    supplier_article_number: "Lieferanten-Artikelnr.",
    product_url: "Produkt-URL",
    notes: "Notizen",
  },
  landlord: {
    ...COMMON_AUDIT_FIELD_LABELS,
    user_id: "Portal-Benutzer",
    company_name: "Firmenname",
    contact_name: "Kontaktperson",
    website: "Website",
    deleted_at: "Archivierung",
  },
  property_manager: {
    ...COMMON_AUDIT_FIELD_LABELS,
    landlord_id: "Verwaltung",
  },
  owner: {
    ...COMMON_AUDIT_FIELD_LABELS,
  },
  tenant: {
    ...COMMON_AUDIT_FIELD_LABELS,
  },
};

/**
 * @param {string} entityType - e.g. unit, landlord, inventory_item
 * @param {string} fieldKey
 * @returns {string}
 */
export function getAuditFieldLabel(entityType, fieldKey) {
  const entityMap = ENTITY_AUDIT_LABELS[entityType];
  if (entityMap && entityMap[fieldKey]) return entityMap[fieldKey];
  if (COMMON_AUDIT_FIELD_LABELS[fieldKey]) return COMMON_AUDIT_FIELD_LABELS[fieldKey];
  return fieldKey;
}
