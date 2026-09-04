const FEMALE_NAMES = new Set([
  'sarah', 'abena', 'akua', 'yaa', 'afia', 'ama', 'adwoa', 'esi', 'efua',
  'mary', 'elizabeth', 'grace', 'patience', 'joyce', 'mercy', 'hannah',
  'rebecca', 'florence', 'evelyn', 'grace', 'rose', 'priscilla', 'gifty',
  'esther', 'victoria', 'gladys', 'jennifer', 'rita', 'beatrice',
  'sandra', 'theresa', 'bernice', 'eunice', 'cynthia', 'comfort', 'agatha',
  'martha', 'dorothy', 'helen', 'alice', 'patricia', 'angela', 'regina'
]);

export function inferDefaultPrefix(name?: string): 'Mr.' | 'Ms.' {
  if (!name) return 'Mr.';
  const firstName = name.trim().split(/\s+/)[0]?.toLowerCase() || '';
  if (FEMALE_NAMES.has(firstName)) {
    return 'Ms.';
  }
  if (firstName.endsWith('a') || firstName.endsWith('ia') || firstName.endsWith('esi')) {
    return 'Ms.';
  }
  return 'Mr.';
}

export function formatConsultantName(name: string | undefined, prefix: string | undefined, cadre?: string): string {
  if (!name) return 'Consultant';
  let cleanName = name.trim();
  let cleanPrefix = prefix?.trim();

  // Strip prefix if already in cleanName to avoid duplicate prefixes like "Dr. Dr. John"
  const knownPrefixes = ['dr.', 'dr', 'pharm.', 'pharm', 'pa', 'pharm. tech.', 'pharm tech', 'mr.', 'mr', 'ms.', 'ms', 'mrs.', 'mrs', 'prof.', 'prof'];
  const firstWord = cleanName.split(/\s+/)[0]?.toLowerCase() || '';
  
  if (knownPrefixes.includes(firstWord)) {
    // The user already typed a prefix into their name field. Just return the name.
    return cleanName;
  }

  // Only use explicitly provided prefixes, never infer gendered prefixes.
  if (cleanPrefix && cleanPrefix !== 'None' && cleanPrefix !== '') {
    return `${cleanPrefix} ${cleanName}`;
  }

  return cleanName;
}

export function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return 'GHS 0.00';
  return `GHS ${amount.toFixed(2)}`;
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

export function formatTime(dateStr: string | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
}
