export const categoryColors: Record<string, string> = {
  light: 'rgba(201, 203, 207, 1)',
  small: 'rgba(54, 162, 235, 1)',
  large: 'rgba(255, 159, 64, 1)',
  heavy: 'rgba(75, 192, 192, 1)',
  other: 'rgba(153, 102, 255, 1)',
  regional: 'rgba(54, 162, 235, 1)',
  narrowbody: 'rgba(255, 159, 64, 1)',
  widebody: 'rgba(75, 192, 192, 1)',
};

export const quadrantColors: Record<string, string> = {
  NE: 'rgba(59, 130, 246, 1)',
  NW: 'rgba(168, 85, 247, 1)',
  SE: 'rgba(34, 197, 94, 1)',
  SW: 'rgba(249, 115, 22, 1)',
  unknown: 'rgba(148, 163, 184, 1)',
};

export const quadrantLabels: Record<string, string> = {
  NE: 'Northeast',
  NW: 'Northwest',
  SE: 'Southeast',
  SW: 'Southwest',
  unknown: 'Unknown',
};

export function getAircraftCategoryFromType(aircraftType: string | undefined | null): string {
  if (!aircraftType) return 'other';
  
  const smallTypes = ['C208', 'C25A', 'C25B', 'C310', 'C525', 'C550', 'C560', 'C56X', 'C680', 'C68A', 'C700', 'C750', 'BE20', 'BE40', 'BE9L', 'PC12', 'SF50', 'LJ31', 'LJ35', 'LJ45', 'LJ60', 'CL30', 'CL35', 'CL60', 'E545', 'E550', 'E55P', 'FA20', 'FA50', 'FA7X', 'FA8X', 'F2TH', 'F900', 'G280', 'GA5C', 'GA6C', 'GALX', 'GL5T', 'GL7T', 'GLEX', 'GLF4', 'GLF5', 'GLF6', 'H25B', 'HA4T', 'HDJT', 'B350'];
  const regionalTypes = ['CRJ2', 'CRJ7', 'CRJ9', 'E135', 'E145', 'E170', 'E190', 'E35L', 'E45X', 'E75L', 'E75S', 'BCS1', 'BCS3'];
  const narrowbodyTypes = ['A20N', 'A21N', 'A319', 'A320', 'A321', 'B712', 'B734', 'B737', 'B738', 'B739', 'B38M', 'B39M', 'B752', 'B753'];
  const widebodyTypes = ['A306', 'A332', 'A333', 'A339', 'A343', 'A346', 'A359', 'A35K', 'B762', 'B763', 'B772', 'B77L', 'B77W', 'B788', 'B789', 'B78X', 'B744', 'B748', 'MD11'];
  
  if (smallTypes.includes(aircraftType)) return 'small';
  if (regionalTypes.includes(aircraftType)) return 'regional';
  if (narrowbodyTypes.includes(aircraftType)) return 'narrowbody';
  if (widebodyTypes.includes(aircraftType)) return 'widebody';
  return 'other';
}

export function getAircraftColor(category: string): string {
  return categoryColors[category] || categoryColors.other;
}

export function rgbaToHex(rgba: string): string {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#999999';
  
  const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
  const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
  const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
  
  return `#${r}${g}${b}`;
}

export function brightenColor(hex: string, percent: number = 30): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * percent / 100));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * percent / 100));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

