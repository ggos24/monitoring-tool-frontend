import type { CountryConfidence } from "./types";

// Full ISO 3166-1 alpha-2 list (249 codes). Sourced from the ISO 3166
// Maintenance Agency. Intl has no API to enumerate region codes
// (Intl.supportedValuesOf only accepts calendar/collation/currency/
// numberingSystem/timeZone/unit), so we keep an explicit array.
// eslint-disable-next-line prettier/prettier
export const ALL_ISO2: readonly string[] = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ",
  "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS",
  "BT","BV","BW","BY","BZ","CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN",
  "CO","CR","CU","CV","CW","CX","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE",
  "EG","EH","ER","ES","ET","FI","FJ","FK","FM","FO","FR","GA","GB","GD","GE","GF",
  "GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY","HK","HM",
  "HN","HR","HT","HU","ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT","JE","JM",
  "JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ","LA","LB","LC",
  "LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MF","MG","MH","MK",
  "ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ","NA",
  "NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ","OM","PA","PE","PF","PG",
  "PH","PK","PL","PM","PN","PR","PS","PT","PW","PY","QA","RE","RO","RS","RU","RW",
  "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS",
  "ST","SV","SX","SY","SZ","TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO",
  "TR","TT","TV","TW","TZ","UA","UG","UM","US","UY","UZ","VA","VC","VE","VG","VI",
  "VN","VU","WF","WS","XK","YE","YT","ZA","ZM","ZW",
];

const REGIONAL_INDICATOR_A = 0x1f1e6;
const ASCII_A = "A".charCodeAt(0);
const ASCII_Z = "Z".charCodeAt(0);

export function iso2ToFlagEmoji(iso2: string | null | undefined): string {
  if (!iso2 || iso2.length !== 2) return "";
  const upper = iso2.toUpperCase();
  const cps: number[] = [];
  for (const ch of upper) {
    const code = ch.charCodeAt(0);
    if (code < ASCII_A || code > ASCII_Z) return "";
    cps.push(REGIONAL_INDICATOR_A + (code - ASCII_A));
  }
  return String.fromCodePoint(...cps);
}

let displayNames: Intl.DisplayNames | null = null;
function getDisplayNames(): Intl.DisplayNames | null {
  if (displayNames) return displayNames;
  try {
    displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return displayNames;
  } catch {
    return null;
  }
}

export function countryName(iso2: string | null | undefined): string {
  if (!iso2) return "Unknown";
  const upper = iso2.toUpperCase();
  const dn = getDisplayNames();
  if (!dn) return upper;
  try {
    return dn.of(upper) ?? upper;
  } catch {
    return upper;
  }
}

export function formatConfidence(c: CountryConfidence | string | null | undefined): string {
  if (!c) return "no attribution";
  return c;
}
