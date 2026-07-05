import relationshipDictionary from './relationshipDictionary.json';

/**
 * Standardizes date parsing to support YYYY-MM-DD, DD-MM-YYYY, and month abbreviations.
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s) return null;

  // 1. ISO format: YYYY-MM-DD (e.g. 1952-08-21)
  const isoMatch = s.match(/^(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})$/);
  if (isoMatch) {
    const [_, y, m, d] = isoMatch.map(Number);
    return new Date(y, m - 1, d);
  }

  // 2. dd-mm-yyyy or similar (e.g. 10-05-1981)
  const parts = s.split(/[-/\.\s]+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1];
    let year = parseInt(parts[2], 10);

    // Resolve Month
    let month = parseInt(monthStr, 10);
    if (!isNaN(month) && month >= 1 && month <= 12) {
      month = month - 1; // 0-indexed
    } else {
      // Try string abbreviation
      const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
      month = months[monthStr.toUpperCase().substring(0, 3)];
    }

    if (month !== undefined && !isNaN(day) && !isNaN(year)) {
      if (year < 100) {
        const currentYear = new Date().getFullYear() % 100;
        const pivot = currentYear + 10;
        year = year > pivot ? 1900 + year : 2000 + year;
      }
      return new Date(year, month, day);
    }
  }

  // 3. Year only (e.g. 1945)
  if (/^\d{4}$/.test(s)) {
    return new Date(parseInt(s, 10), 0, 1);
  }

  return null;
}

/**
 * Compares two profiles' birthdates to determine who is older.
 * Returns 'older', 'younger', 'same', or null.
 */
export function compareAge(p1, p2) {
  if (!p1 || !p2 || !p1.dob || !p2.dob) return null;
  const d1 = parseDate(p1.dob);
  const d2 = parseDate(p2.dob);
  if (d1 && d2 && !isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
    if (d1 < d2) return 'older';
    if (d1 > d2) return 'younger';
    return 'same';
  }
  return null;
}

// --- Helper Accessors ---
export function getPerson(profiles, pid) {
  return profiles.find(p => p.pid === pid) || null;
}

export function getChildrenIds(profiles, pid) {
  return profiles.filter(p => p.fatherId === pid || p.motherId === pid).map(p => p.pid);
}

export function getGender(profiles, pid) {
  const p = getPerson(profiles, pid);
  return p ? p.gender : 'Unknown';
}

export function getSiblings(profiles, pid) {
  const person = getPerson(profiles, pid);
  if (!person) return [];
  const siblings = new Set();

  if (person.fatherId) {
    profiles.filter(p => p.fatherId === person.fatherId).forEach(c => siblings.add(c.pid));
  }
  if (person.motherId) {
    profiles.filter(p => p.motherId === person.motherId).forEach(c => siblings.add(c.pid));
  }

  siblings.delete(pid);
  return Array.from(siblings);
}

export function getParents(profiles, pid) {
  const p = getPerson(profiles, pid);
  if (!p) return [];
  const parents = [];
  if (p.fatherId) parents.push({ id: p.fatherId, role: 'Father' });
  if (p.motherId) parents.push({ id: p.motherId, role: 'Mother' });
  return parents;
}

export function getGrandParents(profiles, pid) {
  const p = getPerson(profiles, pid);
  if (!p) return [];
  const gps = [];

  if (p.fatherId) {
    const father = getPerson(profiles, p.fatherId);
    if (father) {
      if (father.fatherId) gps.push({ id: father.fatherId, role: 'Paternal Grandfather' });
      if (father.motherId) gps.push({ id: father.motherId, role: 'Paternal Grandmother' });
    }
  }
  if (p.motherId) {
    const mother = getPerson(profiles, p.motherId);
    if (mother) {
      if (mother.fatherId) gps.push({ id: mother.fatherId, role: 'Maternal Grandfather' });
      if (mother.motherId) gps.push({ id: mother.motherId, role: 'Maternal Grandmother' });
    }
  }
  return gps;
}

/**
 * Calculates the shortest relationship path between two people in the graph.
 * Returns code and array pathway.
 */
export function getRelationshipCode(profiles, homeId, targetId) {
  if (!homeId || !targetId) return null;
  if (homeId === targetId) return { code: "SELF", path: [homeId] };

  // BFS Queue: { id, code, path }
  let queue = [{ id: homeId, code: "", path: [homeId] }];
  let visited = new Set([homeId]);
  const MAX_DEPTH = 50;

  while (queue.length > 0) {
    let curr = queue.shift();

    if (curr.id === targetId) {
      return {
        code: normalizeCode(curr.code),
        path: curr.path
      };
    }

    if (curr.path.length > MAX_DEPTH) continue;

    const p = getPerson(profiles, curr.id);
    if (!p) continue;

    const add = (nextId, relChar) => {
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push({
          id: nextId,
          code: curr.code + relChar,
          path: [...curr.path, nextId]
        });
      }
    };

    // 1. Parents (F/M)
    if (p.fatherId) add(p.fatherId, 'F');
    if (p.motherId) add(p.motherId, 'M');

    // 2. Children (S/D)
    const children = getChildrenIds(profiles, curr.id);
    children.forEach(childId => {
      const g = getGender(profiles, childId);
      add(childId, g === 'Male' ? 'S' : (g === 'Female' ? 'D' : 'C'));
    });

    // 3. Spouses (H/W)
    if (p.spouseIds) {
      p.spouseIds.forEach(pid => {
        const g = getGender(profiles, pid);
        add(pid, g === 'Male' ? 'H' : (g === 'Female' ? 'W' : 'P'));
      });
    }

    // 4. Siblings (B/Z)
    const sibs = getSiblings(profiles, curr.id);
    sibs.forEach(sibId => {
      const g = getGender(profiles, sibId);
      add(sibId, g === 'Male' ? 'B' : (g === 'Female' ? 'Z' : 'Sib'));
    });
  }

  return null;
}

export function normalizeCode(raw) {
  if (!raw) return "";
  let code = raw;
  let prev;

  do {
    prev = code;
    code = code.replace(/FS/g, 'B');
    code = code.replace(/FD/g, 'Z');
    code = code.replace(/MS/g, 'B');
    code = code.replace(/MD/g, 'Z');

    code = code.replace(/FBS/g, 'B');
    code = code.replace(/FBD/g, 'Z');
    code = code.replace(/MZS/g, 'B');
    code = code.replace(/MZD/g, 'Z');

    code = code.replace(/FFB/g, 'FF');
    code = code.replace(/MMZ/g, 'MM');
    code = code.replace(/MFB/g, 'MF');
    code = code.replace(/FMZ/g, 'FM');
  } while (code !== prev);

  return code;
}

export function getTerm(entryValue, lang = 'en') {
  if (!entryValue) return "";
  if (typeof entryValue === 'string') return entryValue;
  return entryValue[lang] || entryValue['en'] || entryValue['te'] || entryValue['kn'] || "";
}

/**
 * Resolves a relationship code to its local language display term.
 */
export function resolveRelationName(profiles, result, homePerson, targetPerson, lang = 'en') {
  if (!result) return "Unknown";
  const { code, path } = result;

  const entry = relationshipDictionary[code];
  if (!entry) return code;

  // 1. Direct Name
  if (entry.name) return getTerm(entry.name, lang);

  // 2. Gender-based Name
  if (entry.male || entry.female) {
    const g = getGender(profiles, targetPerson.pid);
    if (g === 'Male' && entry.male) return getTerm(entry.male, lang);
    if (g === 'Female' && entry.female) return getTerm(entry.female, lang);
  }

  // 3. Age-based Rules
  if (entry.ageRule) {
    if (entry.ageRule === 'pedda_chinna') {
      let comparisonNodeId = null;

      if (['FB', 'MB', 'FZ', 'MZ'].includes(code) && path.length >= 2) {
        comparisonNodeId = path[1];
      }
      else if (['HFB', 'HFZ', 'HMB', 'HMZ', 'WFB', 'WFZ', 'WMB', 'WMZ'].includes(code) && path.length >= 3) {
        comparisonNodeId = path[2];
      }
      else if (path.length >= 3) {
        comparisonNodeId = path[path.length - 2];
      }

      if (comparisonNodeId) {
        const parent = getPerson(profiles, comparisonNodeId);
        const comparison = compareAge(targetPerson, parent);

        if (comparison === 'older') return getTerm(entry.pedda || entry.elder, lang);
        if (comparison === 'younger') return getTerm(entry.chinna || entry.younger, lang);

        return getTerm(entry.pedda || entry.elder, lang) + "/" + getTerm(entry.chinna || entry.younger, lang);
      }
    }

    if (entry.ageRule === 'sibling_child' && path.length >= 3) {
      const siblingId = path[path.length - 2];
      const sibling = getPerson(profiles, siblingId);
      const comparison = compareAge(sibling, homePerson);

      if (comparison === 'older') return getTerm(entry.elder, lang);
      if (comparison === 'younger') return getTerm(entry.younger, lang);
      return getTerm(entry.elder, lang) + "/" + getTerm(entry.younger, lang);
    }

    if (entry.ageRule === 'vadina_maradalu' && path.length >= 3) {
      const siblingId = path[path.length - 2];
      const sibling = getPerson(profiles, siblingId);
      const comparison = compareAge(sibling, homePerson);

      if (comparison === 'older') return getTerm(entry.elder, lang);
      if (comparison === 'younger') return getTerm(entry.younger, lang);
      return getTerm(entry.elder, lang) + "/" + getTerm(entry.younger, lang);
    }

    if (entry.ageRule === 'direct_age') {
      const comparison = compareAge(targetPerson, homePerson);
      if (comparison === 'older') return getTerm(entry.elder, lang);
      if (comparison === 'younger') return getTerm(entry.younger, lang);
      return getTerm(entry.default, lang) || (getTerm(entry.elder, lang) + "/" + getTerm(entry.younger, lang));
    }

    if (entry.ageRule === 'parent_age_compare' && path.length >= 2) {
      const parentId = path[path.length - 2];
      const parent = getPerson(profiles, parentId);
      const comparison = compareAge(parent, homePerson);
      if (comparison === 'older') return getTerm(entry.elder, lang);
      if (comparison === 'younger') return getTerm(entry.younger, lang);
      return getTerm(entry.default, lang) || (getTerm(entry.elder, lang) + "/" + getTerm(entry.younger, lang));
    }
  }

  return code;
}

/**
 * Main external API to resolve relationship names directly.
 */
export function findRelationship(profiles, id1, id2, lang = 'en') {
  const p1 = getPerson(profiles, id1);
  const p2 = getPerson(profiles, id2);
  if (!p1 || !p2) return "Unknown";

  if (id1 === id2) return lang === 'te' ? 'నేను' : (lang === 'kn' ? 'ನಾನು' : 'Self');

  const result = getRelationshipCode(profiles, id1, id2);
  if (!result) return lang === 'te' ? 'సంబంధం లేదు' : (lang === 'kn' ? 'ಸಂಬಂಧವಿಲ್ಲ' : 'No relation');
  return resolveRelationName(profiles, result, p1, p2, lang);
}
