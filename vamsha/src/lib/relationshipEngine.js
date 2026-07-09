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
/**
 * Resolves a relationship code to its local language display term (Internal Raw).
 */
function resolveRelationNameRaw(profiles, result, homePerson, targetPerson, lang = 'en') {
  if (!result) return "Unknown";
  const { code, path } = result;

  const entry = relationshipDictionary[code];
  if (!entry) return getDynamicRelationText(code, lang);

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
 * Translates hybrid regional terms in the English dictionary values to clean English standard terms.
 */
export function translateToCleanEnglish(term) {
  if (!term) return "";
  
  const engMap = {
    "Nanna/Appa": "Father",
    "Amma": "Mother",
    "Anna/Tammudu/Tamma": "Brother",
    "Anna": "Brother (Elder)",
    "Tammudu/Tamma": "Brother (Younger)",
    "Akka/Chelli/Tangi": "Sister",
    "Akka": "Sister (Elder)",
    "Chelli/Tangi": "Sister (Younger)",
    "Koduku/Maga": "Son",
    "Kuthuru/Magalu": "Daughter",
    "Bharta/Ganda": "Husband",
    "Bharya/Hendati": "Wife",
    "Tatayya/Ajja": "Grandfather",
    "Nanamma/Ajji": "Grandmother",
    "Ammamma/Ajji": "Grandmother",
    "Muttata/Muttajja": "Great-Grandfather",
    "Muttavva/Muttajji": "Great-Grandmother",
    "Pedananna/Doddappa": "Uncle (Elder Paternal)",
    "Chinnanna/Chikkappa": "Uncle (Younger Paternal)",
    "Atta/Atte": "Aunt",
    "Pinni/Chikkamma": "Aunt",
    "Mavayya/Mava": "Uncle",
    "Mama/Mava": "Uncle",
    "Bava": "Brother-in-law (Elder)",
    "Bavamaridi/Maiduna": "Brother-in-law (Younger)",
    "Bava/Bavamaridi/Maiduna": "Brother-in-law",
    "Vadina/Attige": "Sister-in-law (Elder)",
    "Maradalu/Nadini": "Sister-in-law (Younger)",
    "Vadina/Maradalu/Attige/Nadini": "Sister-in-law",
    "Vadina/Maradalu/Attige/Nadini Magalu": "Niece",
    "Vadina/Maradalu/Attige/Nadini Maga": "Nephew",
    "Menalludu/Sodaraliya": "Nephew",
    "Menakodalu/Sodarasose": "Niece",
    "Anna Koduku/Annana Maga": "Nephew",
    "Tammudu Koduku/Tammana Maga": "Nephew",
    "Anna Kuthuru/Annana Magalu": "Niece",
    "Tammudu Kuthuru/Tammana Magalu": "Niece",
    "Mamayya/Mava": "Father-in-law",
    "Attayya/Atte": "Mother-in-law",
    "Manumadu/Mommaga": "Grandson",
    "Manumaralu/Mommagalu": "Granddaughter",
    "Kodalu/Sose": "Daughter-in-law",
    "Alludu/Aliya": "Son-in-law",
    "Aadapaduchu Kumarudu/Nadiniya Maga": "Nephew",
    "Aadapaduchu Kumarte/Nadiniya Magalu": "Niece",
    "Tata/Ajja": "Grandfather",
    "Avva/Ajji": "Grandmother",
    "Pedamamagaru/Doddamava": "Uncle (Elder Paternal)",
    "Chinamamagaru/Chikkamava": "Uncle (Younger Paternal)",
    "Pedda Atta/Doddatte": "Aunt (Elder)",
    "Chinna Atta/Chikkatte": "Aunt (Younger)",
    "Peddamma/Chinnamma Kumarudu/Doddamma/Chikkammana Maga": "Cousin (Male)",
    "Peddamma/Chinnamma Kumarte/Doddamma/Chikkammana Magalu": "Cousin (Female)"
  };

  // Direct match lookup
  if (engMap[term]) return engMap[term];

  // Key replacement mapping
  let cleaned = term;
  Object.keys(engMap).forEach(key => {
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(escapedKey, 'g'), engMap[key]);
  });

  return cleaned;
}

/**
 * Resolves a relationship code to its local language display term.
 */
export function resolveRelationName(profiles, result, homePerson, targetPerson, lang = 'en') {
  const rawTerm = resolveRelationNameRaw(profiles, result, homePerson, targetPerson, lang);
  if (lang === 'en') {
    return translateToCleanEnglish(rawTerm);
  }
  return rawTerm;
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

export function getDynamicRelationText(code, lang = 'en') {
  if (!code) return "";
  const chars = code.split("");
  
  const translations = {
    en: {
      F: { mid: "Father's ", last: "Father" },
      M: { mid: "Mother's ", last: "Mother" },
      B: { mid: "Brother's ", last: "Brother" },
      Z: { mid: "Sister's ", last: "Sister" },
      S: { mid: "Son's ", last: "Son" },
      D: { mid: "Daughter's ", last: "Daughter" },
      H: { mid: "Husband's ", last: "Husband" },
      W: { mid: "Wife's ", last: "Wife" }
    },
    te: {
      F: { mid: "తండ్రి గారి ", last: "తండ్రి" },
      M: { mid: "తల్లి గారి ", last: "తల్లి" },
      B: { mid: "సోదరుడి ", last: "సోదరుడు" },
      Z: { mid: "సోదరి ", last: "సోదరి" },
      S: { mid: "కుమారుడి ", last: "కుమారుడు" },
      D: { mid: "కుమార్తె ", last: "కుమార్తె" },
      H: { mid: "భర్త గారి ", last: "భర్త" },
      W: { mid: "భార్య ", last: "భార్య" }
    },
    kn: {
      F: { mid: "ತಂದೆಯ ", last: "ತಂದೆ" },
      M: { mid: "ತಾಯಿಯ ", last: "ತಾಯಿ" },
      B: { mid: "ಸಹೋದರನ ", last: "ಸಹೋದರ" },
      Z: { mid: "ಸಹೋದರಿಯ ", last: "ಸಹೋದರಿ" },
      S: { mid: "ಮಗನ ", last: "ಮಗ" },
      D: { mid: "ಮಗಳ ", last: "ಮಗಳು" },
      H: { mid: "ಗಂಡನ ", last: "ಗಂಡ" },
      W: { mid: "ಹೆಂಡತಿಯ ", last: "ಹೆಂಡತಿ" }
    }
  };

  let resultParts = [];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const isLast = i === chars.length - 1;
    const dict = translations[lang] || translations['en'];
    const item = dict[char];
    if (item) {
      resultParts.push(isLast ? item.last : item.mid);
    } else {
      resultParts.push(char);
    }
  }

  return resultParts.join("").trim();
}

/**
 * Traverses the family tree graph starting from startPid (BFS traversal).
 * Returns only the profiles reachable through parents, children, spouses, or siblings.
 * If startPid is falsy, returns all profiles (fallback).
 * @param {Array} profiles
 * @param {string} startPid
 * @returns {Array}
 */
export function getReachableProfiles(profiles, startPid) {
  if (!startPid) return profiles;
  
  const startPerson = getPerson(profiles, startPid);
  if (!startPerson) return [];

  const visited = new Set([startPid]);
  const queue = [startPid];

  while (queue.length > 0) {
    const currPid = queue.shift();
    const p = getPerson(profiles, currPid);
    if (!p) continue;

    const add = (nextId) => {
      if (nextId && !visited.has(nextId)) {
        visited.add(nextId);
        queue.push(nextId);
      }
    };

    // 1. Parents
    if (p.fatherId) add(p.fatherId);
    if (p.motherId) add(p.motherId);

    // 2. Children
    const children = getChildrenIds(profiles, currPid);
    children.forEach(childId => add(childId));

    // 3. Spouses
    if (p.spouseIds && Array.isArray(p.spouseIds)) {
      p.spouseIds.forEach(spouseId => add(spouseId));
    }
    // Bidirectional spouse checking
    profiles.forEach(other => {
      if (other.spouseIds && Array.isArray(other.spouseIds) && other.spouseIds.includes(currPid)) {
        add(other.pid);
      }
    });

    // 4. Siblings
    const sibs = getSiblings(profiles, currPid);
    sibs.forEach(sibId => add(sibId));
  }

  return profiles.filter(p => visited.has(p.pid));
}

