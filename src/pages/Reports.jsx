import React, { useState, useMemo } from 'react';
import { 
  Users, BarChart2, Calendar, FileText, GitBranch, ArrowRight, Printer, Heart, AlertTriangle, ChevronDown, ChevronRight
} from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { 
  getPerson, getChildrenIds, getGender, getSiblings, getParents, getGrandParents,
  getRelationshipCode, findRelationship, parseDate, resolveRelationName
} from '../lib/relationshipEngine';
import { useLanguage } from '../context/LanguageContext';

const Reports = ({ profiles }) => {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'lineage'
  
  // State for lineage reports
  const [primaryPid, setPrimaryPid] = useState('');
  const [secondaryPid, setSecondaryPid] = useState('');
  const [selectedReport, setSelectedReport] = useState(''); // 'close-family', 'relationship-diagram', 'ancestors', 'descendants', 'full-descendants', 'full-descendants-diagram'
  const [showRelDiagramSecondary, setShowRelDiagramSecondary] = useState(false);

  // Accordion toggle states for dashboard sections
  const [expandedSection, setExpandedSection] = useState(null); // 'gotram', 'surname', 'generation', 'age', 'astro'
  // Individual items expansion inside sections (e.g. which specific Gotram is open)
  const [expandedItems, setExpandedItems] = useState({});

  const handleToggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleToggleItem = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // -------------------------------------------------------------
  // CALCULATIONS: DASHBOARD TAB
  // -------------------------------------------------------------
  
  // 1. Overall Stats
  const totalCount = profiles.length;
  const maleCount = profiles.filter(p => p.gender === 'Male').length;
  const femaleCount = profiles.filter(p => p.gender === 'Female').length;
  const deceasedCount = profiles.filter(p => p.isDeceased).length;
  const livingCount = totalCount - deceasedCount;

  const avgAge = useMemo(() => {
    const today = new Date();
    const livingWithDob = profiles.filter(p => !p.isDeceased && p.dob);
    let totalAge = 0;
    let validCount = 0;
    
    livingWithDob.forEach(p => {
      const bday = parseDate(p.dob);
      if (bday && !isNaN(bday.getTime())) {
        let age = today.getFullYear() - bday.getFullYear();
        const m = today.getMonth() - bday.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < bday.getDate())) {
          age--;
        }
        if (age >= 0 && age <= 130) {
          totalAge += age;
          validCount++;
        }
      }
    });
    return validCount > 0 ? Math.round(totalAge / validCount) : 0;
  }, [profiles]);

  // 2. Gotram Grouping
  const gotramData = useMemo(() => {
    const groups = {};
    profiles.forEach(p => {
      const g = p.gotram ? p.gotram.trim() : 'Not Specified';
      if (!groups[g]) groups[g] = [];
      groups[g].push(p);
    });
    return Object.entries(groups)
      .map(([name, list]) => ({ name, list, count: list.length }))
      .sort((a, b) => b.count - a.count);
  }, [profiles]);

  // 3. Surname Grouping
  const surnameData = useMemo(() => {
    const groups = {};
    profiles.forEach(p => {
      const s = p.surName ? p.surName.trim() : 'Not Specified';
      if (!groups[s]) groups[s] = [];
      groups[s].push(p);
    });
    return Object.entries(groups)
      .map(([name, list]) => ({ name, list, count: list.length }))
      .sort((a, b) => b.count - a.count);
  }, [profiles]);

  // 4. Generation Mapping
  const generationData = useMemo(() => {
    // Determine roots (males or females with no parent in the database)
    const roots = profiles.filter(p => {
      if (!p.fatherId && !p.motherId) return true;
      const fatherExists = profiles.some(f => f.pid === p.fatherId);
      const motherExists = profiles.some(m => m.pid === p.motherId);
      return !fatherExists && !motherExists;
    });

    const genMap = {};
    const queue = [];
    
    roots.forEach(r => {
      genMap[r.pid] = 1;
      queue.push(r.pid);
    });

    const visited = new Set(roots.map(r => r.pid));

    while (queue.length > 0) {
      const currPid = queue.shift();
      const currLevel = genMap[currPid];

      const children = profiles.filter(c => c.fatherId === currPid || c.motherId === currPid);
      children.forEach(child => {
        if (!visited.has(child.pid)) {
          const existingLevel = genMap[child.pid] || 0;
          genMap[child.pid] = Math.max(existingLevel, currLevel + 1);
          visited.add(child.pid);
          queue.push(child.pid);
        }
      });
    }

    // Assign level 1 to any disconnected nodes
    profiles.forEach(p => {
      if (!genMap[p.pid]) {
        genMap[p.pid] = 1;
      }
    });

    // Group by level
    const groups = {};
    profiles.forEach(p => {
      const lvl = genMap[p.pid];
      if (!groups[lvl]) groups[lvl] = [];
      groups[lvl].push(p);
    });

    return Object.entries(groups)
      .map(([level, list]) => ({ level: parseInt(level), list, count: list.length }))
      .sort((a, b) => a.level - b.level);
  }, [profiles]);

  // 5. Age Demographics (Living members)
  const ageData = useMemo(() => {
    const today = new Date();
    const brackets = {
      'Children (0-12 yrs)': [],
      'Youth (13-29 yrs)': [],
      'Adults (30-59 yrs)': [],
      'Seniors (60+ yrs)': [],
      'Unknown DOB / Deceased': []
    };

    profiles.forEach(p => {
      if (p.isDeceased) {
        brackets['Unknown DOB / Deceased'].push(p);
        return;
      }
      
      const dobDate = parseDate(p.dob);
      if (!dobDate || isNaN(dobDate.getTime())) {
        brackets['Unknown DOB / Deceased'].push(p);
        return;
      }

      let age = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }

      if (age <= 12) {
        brackets['Children (0-12 yrs)'].push(p);
      } else if (age <= 29) {
        brackets['Youth (13-29 yrs)'].push(p);
      } else if (age <= 59) {
        brackets['Adults (30-59 yrs)'].push(p);
      } else {
        brackets['Seniors (60+ yrs)'].push(p);
      }
    });

    return Object.entries(brackets).map(([name, list]) => ({ name, list, count: list.length }));
  }, [profiles]);

  // 6. Astrological
  const astroData = useMemo(() => {
    const rashiGroups = {};
    const nakshatraGroups = {};

    profiles.forEach(p => {
      if (p.rashi) {
        const r = p.rashi.split(' (')[0].trim();
        if (!rashiGroups[r]) rashiGroups[r] = [];
        rashiGroups[r].push(p);
      }
      if (p.nakshatra) {
        const n = p.nakshatra.split(' (')[0].trim();
        if (!nakshatraGroups[n]) nakshatraGroups[n] = [];
        nakshatraGroups[n].push(p);
      }
    });

    const rashis = Object.entries(rashiGroups)
      .map(([name, list]) => ({ name, list, count: list.length }))
      .sort((a, b) => b.count - a.count);

    const nakshatras = Object.entries(nakshatraGroups)
      .map(([name, list]) => ({ name, list, count: list.length }))
      .sort((a, b) => b.count - a.count);

    return { rashis, nakshatras };
  }, [profiles]);

  // -------------------------------------------------------------
  // CONTROLS & RENDER OPTIONS: LINEAGE REPORTS TAB
  // -------------------------------------------------------------

  const personOptions = useMemo(() => {
    return [...profiles]
      .sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''))
      .map(p => ({
        value: p.pid,
        label: `${p.firstName} ${p.surName} (${p.pid})`
      }));
  }, [profiles]);

  const handleSelectPerson = (e) => {
    setPrimaryPid(e.target.value);
    // Reset selected report output when primary person changes
    setSelectedReport('');
  };

  const handleSelectSecondary = (e) => {
    setSecondaryPid(e.target.value);
  };

  const triggerReport = (reportType) => {
    if (!primaryPid) {
      alert("Please select a primary person first!");
      return;
    }
    if (reportType === 'relationship-diagram') {
      setShowRelDiagramSecondary(true);
      setSelectedReport('relationship-diagram');
    } else {
      setShowRelDiagramSecondary(false);
      setSelectedReport(reportType);
    }
  };

  const printReport = () => {
    window.print();
  };

  // -------------------------------------------------------------
  // REPORT RENDER IMPLEMENTATIONS
  // -------------------------------------------------------------

  // Report 1: Close Family Report
  const renderCloseFamily = (centerId) => {
    const p = getPerson(profiles, centerId);
    if (!p) return null;

    const parents = getParents(profiles, centerId);
    const gps = getGrandParents(profiles, centerId);
    const siblings = getSiblings(profiles, centerId);
    const children = getChildrenIds(profiles, centerId);

    // Grandchildren
    const grandChildren = [];
    children.forEach(childId => {
      const kids = getChildrenIds(profiles, childId);
      if (kids.length > 0) {
        grandChildren.push({
          parentName: `${getPerson(profiles, childId).firstName} ${getPerson(profiles, childId).surName}`,
          kids: kids.map(k => getPerson(profiles, k)).filter(Boolean)
        });
      }
    });

    // Spouses
    const spouses = (p.spouseIds || []).map(spid => getPerson(profiles, spid)).filter(Boolean);

    const renderPersonRow = (person, type) => {
      const rel = findRelationship(profiles, centerId, person.pid, language);
      return (
        <div key={person.pid} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 1rem', borderBottom: '1px solid #eee', background: '#fff' }}>
          <div>
            <strong style={{ color: 'var(--color-dark)' }}>{person.firstName} {person.surName}</strong>
            <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: '0.5rem' }}>({person.pid})</span>
          </div>
          <div style={{ color: '#E91E63', fontWeight: 600, fontSize: '0.9rem' }}>
            {rel}
          </div>
        </div>
      );
    };

    return (
      <div className="report-print-container" style={{ fontFamily: 'sans-serif', color: '#333' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--color-maroon)' }}>Close Family Report</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>Centered on: <strong>{p.firstName} {p.surName} ({p.pid})</strong></p>
        </div>

        {/* Self */}
        <h4 style={{ background: '#f5f5f5', padding: '0.4rem 0.8rem', borderLeft: '4px solid var(--color-maroon)', margin: '1.5rem 0 0.5rem' }}>SELF</h4>
        {renderPersonRow(p)}

        {/* Parents */}
        {parents.length > 0 && (
          <>
            <h4 style={{ background: '#f5f5f5', padding: '0.4rem 0.8rem', borderLeft: '4px solid var(--color-maroon)', margin: '1.5rem 0 0.5rem' }}>PARENTS</h4>
            {parents.map(parent => renderPersonRow(getPerson(profiles, parent.id)))}
          </>
        )}

        {/* Grandparents */}
        {gps.length > 0 && (
          <>
            <h4 style={{ background: '#f5f5f5', padding: '0.4rem 0.8rem', borderLeft: '4px solid var(--color-maroon)', margin: '1.5rem 0 0.5rem' }}>GRANDPARENTS</h4>
            {gps.map(gp => renderPersonRow(getPerson(profiles, gp.id)))}
          </>
        )}

        {/* Siblings */}
        {siblings.length > 0 && (
          <>
            <h4 style={{ background: '#f5f5f5', padding: '0.4rem 0.8rem', borderLeft: '4px solid var(--color-maroon)', margin: '1.5rem 0 0.5rem' }}>SIBLINGS</h4>
            {siblings.map(sibId => renderPersonRow(getPerson(profiles, sibId)))}
          </>
        )}


        {/* Children */}
        {children.length > 0 && (
          <>
            <h4 style={{ background: '#f5f5f5', padding: '0.4rem 0.8rem', borderLeft: '4px solid var(--color-maroon)', margin: '1.5rem 0 0.5rem' }}>CHILDREN</h4>
            {children.map(childId => renderPersonRow(getPerson(profiles, childId)))}
          </>
        )}

        {/* Grandchildren */}
        {grandChildren.length > 0 && (
          <>
            <h4 style={{ background: '#f5f5f5', padding: '0.4rem 0.8rem', borderLeft: '4px solid var(--color-maroon)', margin: '1.5rem 0 0.5rem' }}>GRANDCHILDREN</h4>
            {grandChildren.map(group => (
              <div key={group.parentName} style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#666', padding: '0.2rem 1rem', fontStyle: 'italic' }}>Children of {group.parentName}:</div>
                {group.kids.map(kid => renderPersonRow(kid))}
              </div>
            ))}
          </>
        )}

        {/* Spouse Side */}
        {spouses.length > 0 && spouses.map(spouse => {
          const spouseParents = getParents(profiles, spouse.pid);
          const spouseGps = getGrandParents(profiles, spouse.pid);
          const spouseSibs = getSiblings(profiles, spouse.pid);
          
          return (
            <div key={spouse.pid} style={{ border: '1px solid #ffccd5', borderRadius: '8px', padding: '1rem', marginTop: '2rem', backgroundColor: '#fffbfb' }}>
              <h4 style={{ margin: '0 0 1rem', color: '#D81B60', borderBottom: '1px solid #ffd1dc', paddingBottom: '0.5rem' }}>
                SPOUSE SIDE: {spouse.firstName} {spouse.surName} ({findRelationship(profiles, centerId, spouse.pid, language)})
              </h4>
              
              {spouseParents.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, color: '#555', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Parents:</div>
                  {spouseParents.map(sp => renderPersonRow(getPerson(profiles, sp.id)))}
                </div>
              )}

              {spouseGps.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, color: '#555', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Grandparents:</div>
                  {spouseGps.map(sp => renderPersonRow(getPerson(profiles, sp.id)))}
                </div>
              )}

              {spouseSibs.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, color: '#555', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Siblings:</div>
                  {spouseSibs.map(sibId => renderPersonRow(getPerson(profiles, sibId)))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Report 2: Relationship Diagram
  const renderRelationshipDiagram = (id1, id2) => {
    if (!id2) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666', border: '1px dashed #ccc', borderRadius: '8px' }}>
          Please select the second person to generate the pathway.
        </div>
      );
    }

    const p1 = getPerson(profiles, id1);
    const p2 = getPerson(profiles, id2);
    if (!p1 || !p2) return <p>Person not found.</p>;

    const result = getRelationshipCode(profiles, id1, id2);
    if (!result || !result.path || result.path.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#c0392b' }}>
          <AlertTriangle size={32} style={{ marginBottom: '0.5rem', display: 'inline-block' }} />
          <h4>No direct relationship path found!</h4>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>They are not linked in the current database via any path.</p>
        </div>
      );
    }

    const path = result.path;

    // Check for sibling bridge
    let siblingIndex = -1;
    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i+1];
      const sibs = getSiblings(profiles, u);
      if (sibs.includes(v)) {
        siblingIndex = i;
        break;
      }
    }

    const getDiagramLabel = (targetId) => {
      const r = getRelationshipCode(profiles, id1, targetId);
      if (!r) return "";
      if (r.code === 'SELF') return "Self";
      return resolveRelationName(profiles, r, p1, getPerson(profiles, targetId), language);
    };

    const renderDiagramNodeCard = (pid, label, isRoot = false) => {
      const p = getPerson(profiles, pid);
      if (!p) return null;
      let displayName = `${p.firstName} ${p.surName}`;
      const parts = displayName.trim().split(/\s+/);
      if (parts.length > 1) {
        displayName = `${parts.slice(0, -1).join(" ")}.${parts[parts.length - 1].charAt(0)}`;
      }

      const avatarUrl = p.photoUrl
        ? p.photoUrl
        : `${import.meta.env.BASE_URL}icons/${p.gender === 'Male' ? 'male_icon.png' : 'female_icon.png'}`;

      return (
        <div className="ca-node-wrapper" key={pid}>
          <div className={`ca-node ${isRoot ? 'root' : ''}`} style={{ border: isRoot ? '2px solid #FF9800' : `2px solid ${p.gender === 'Male' ? '#4A90E2' : '#E91E63'}` }}>
            {label && <div className="ca-node-role">{label}</div>}
            <img src={avatarUrl} alt={p.firstName} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
            <div className="ca-node-name" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{displayName}</div>
            <div className="ca-node-id" style={{ fontSize: '0.7rem', color: '#999' }}>{p.pid}</div>
          </div>
        </div>
      );
    };

    const finalRel = findRelationship(profiles, id1, id2, language);

    return (
      <div style={{ padding: '1rem', overflowX: 'auto' }}>
        <style>{`
          .ca-diagram { display: flex; flex-direction: column; align-items: center; padding: 20px 10px; font-family: sans-serif; }
          .ca-node {
              border-radius: 12px; padding: 10px; text-align: center;
              width: 130px; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.06);
              z-index: 2; position: relative; display: flex; flex-direction: column; align-items: center;
          }
          .ca-node.root { background: #fff8e1; }
          .ca-node img { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; margin-bottom: 5px; border: 1px solid #eee; }
          .ca-node-name { font-weight: bold; color: #333; line-height: 1.2; }
          .ca-node-role { 
              font-size: 9px; color: #E91E63; font-weight: bold; background: #fff0f5; 
              padding: 1px 6px; border-radius: 10px; margin-bottom: 4px; border: 1px solid #f8bbd0;
              text-transform: uppercase; letter-spacing: 0.5px;
          }
          .ca-pivot-wrapper { display: flex; flex-direction: column; align-items: center; position: relative; margin-bottom: 30px; }
          .ca-pivot-wrapper::after {
              content: ''; position: absolute; top: 100%; left: 50%; width: 2px; height: 30px;
              background: #bbb; transform: translateX(-50%);
          }
          .ca-branches { display: flex; justify-content: center; gap: 40px; position: relative; }
          .ca-branch { display: flex; flex-direction: column; align-items: center; position: relative; padding-top: 30px; }
          .ca-branch::before { content: ''; position: absolute; top: 0; height: 2px; background: #bbb; }
          .ca-branch.left::before { right: -20px; width: calc(50% + 20px); }
          .ca-branch.right::before { left: -20px; width: calc(50% + 20px); }
          .ca-branch::after {
              content: ''; position: absolute; top: 0; left: 50%; width: 2px; height: 30px;
              background: #bbb; transform: translateX(-50%);
          }
          .ca-node-wrapper { position: relative; margin-bottom: 30px; }
          .ca-node-wrapper:last-child { margin-bottom: 0; }
          .ca-node-wrapper::after {
              content: ''; position: absolute; top: 100%; left: 50%; width: 2px; height: 30px;
              background: #bbb; transform: translateX(-50%);
          }
          .ca-node-wrapper:last-child::after { display: none; }
          .ca-node-wrapper::before {
              content: ''; position: absolute; top: calc(100% + 25px); left: 50%; 
              border: 5px solid transparent; border-top-color: #bbb; 
              transform: translateX(-50%); z-index: 1;
          }
          .ca-node-wrapper:last-child::before { display: none; }
          .ca-branch.left .ca-node-wrapper::before,
          .ca-single-col.left-stack .ca-node-wrapper::before,
          .ca-sibling-side:first-child .ca-node-wrapper::before {
              border-top-color: transparent; border-bottom-color: #bbb;
              top: calc(100% + 5px);
          }
          .ca-single-col { padding-top: 0; }
          .ca-single-col::before, .ca-single-col::after { display: none; }
          .ca-sibling-container { display: flex; justify-content: center; gap: 60px; position: relative; margin-top: 10px; }
          .ca-sibling-container::before {
              content: ''; position: absolute; top: 45px; left: 50%; transform: translateX(-50%);
              width: 60px; height: 2px; background: #bbb; z-index: 1;
          }
          .ca-sibling-side { display: flex; flex-direction: column; align-items: center; position: relative; }
          .ca-sibling-side .ca-single-col { padding-top: 30px; }
        `}</style>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--color-maroon)' }}>Relationship Diagram</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
            <strong>{p1.firstName} {p1.surName}</strong> &nbsp;➡&nbsp; <strong>{p2.firstName} {p2.surName}</strong>
          </p>
        </div>

        <div className="ca-diagram">
          {siblingIndex !== -1 ? (
            // Sibling bridge layout
            <div className="ca-sibling-container">
              <div className="ca-sibling-side">
                {renderDiagramNodeCard(path[siblingIndex], getDiagramLabel(path[siblingIndex]))}
                {path.slice(0, siblingIndex).length > 0 && (
                  <div className="ca-single-col left-stack">
                    {path.slice(0, siblingIndex).reverse().map(nodeId => renderDiagramNodeCard(nodeId, getDiagramLabel(nodeId)))}
                  </div>
                )}
              </div>
              <div className="ca-sibling-side">
                {renderDiagramNodeCard(path[siblingIndex + 1], getDiagramLabel(path[siblingIndex + 1]))}
                {path.slice(siblingIndex + 2).length > 0 && (
                  <div className="ca-single-col">
                    {path.slice(siblingIndex + 2).map(nodeId => renderDiagramNodeCard(nodeId, getDiagramLabel(nodeId)))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Common ancestor layout
            (() => {
              // Calculate generation steps
              let gens = [0];
              let currGen = 0;
              for (let i = 0; i < path.length - 1; i++) {
                const curr = path[i];
                const next = path[i+1];
                const pNext = getPerson(profiles, next);
                if (pNext.fatherId === curr || pNext.motherId === curr) {
                  currGen--;
                } else if (getPerson(profiles, curr).fatherId === next || getPerson(profiles, curr).motherId === next) {
                  currGen++;
                }
                gens.push(currGen);
              }
              const maxGen = Math.max(...gens);
              const pivotIndex = gens.indexOf(maxGen);
              const pivotId = path[pivotIndex];
              const leftNodes = path.slice(0, pivotIndex).reverse();
              const rightNodes = path.slice(pivotIndex + 1);

              return (
                <>
                  <div className="ca-pivot-wrapper">
                    {renderDiagramNodeCard(pivotId, getDiagramLabel(pivotId), pivotId === id1)}
                  </div>
                  <div className="ca-branches">
                    {leftNodes.length > 0 && (
                      <div className={rightNodes.length === 0 ? "ca-single-col left-stack" : "ca-branch left"}>
                        {leftNodes.map(nodeId => renderDiagramNodeCard(nodeId, getDiagramLabel(nodeId)))}
                      </div>
                    )}
                    {rightNodes.length > 0 && (
                      <div className={leftNodes.length === 0 ? "ca-single-col" : "ca-branch right"}>
                        {rightNodes.map(nodeId => renderDiagramNodeCard(nodeId, getDiagramLabel(nodeId)))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee' }}>
          <div style={{ fontSize: '1.1rem', color: '#333' }}>
            <strong>{p2.firstName} {p2.surName}</strong> is your <strong>{finalRel}</strong>.
          </div>
          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.4rem', fontFamily: 'monospace' }}>
            Path Code: {result.code}
          </div>
        </div>
      </div>
    );
  };

  // Report 3: Ancestors Report
  const renderAncestors = (centerId) => {
    const p = getPerson(profiles, centerId);
    if (!p) return null;

    let currentGenIds = [];
    if (p.fatherId) currentGenIds.push(p.fatherId);
    if (p.motherId) currentGenIds.push(p.motherId);

    const ancestorsByGen = [];
    let genIndex = 1;

    while (currentGenIds.length > 0) {
      let genTitle = "";
      if (genIndex === 1) genTitle = "Parents (Generation 1)";
      else if (genIndex === 2) genTitle = "Grandparents (Generation 2)";
      else if (genIndex === 3) genTitle = "Great-Grandparents (Generation 3)";
      else genTitle = `${"Great-".repeat(genIndex - 2)}Grandparents`;

      const genItems = [];
      let nextGenIds = [];

      currentGenIds.forEach(ancId => {
        const anc = getPerson(profiles, ancId);
        if (anc) {
          const g = getGender(profiles, ancId);
          let role = "";
          if (genIndex === 1) role = (g === 'Male' ? "Father" : "Mother");
          else if (genIndex === 2) role = (g === 'Male' ? "Grandfather" : "Grandmother");
          else {
            role = "Great-".repeat(genIndex - 2) + (g === 'Male' ? "Grandfather" : "Grandmother");
          }

          const relName = findRelationship(profiles, centerId, ancId, language);
          genItems.push({ anc, role, relName });

          if (anc.fatherId) nextGenIds.push(anc.fatherId);
          if (anc.motherId) nextGenIds.push(anc.motherId);
        }
      });

      ancestorsByGen.push({ title: genTitle, items: genItems });
      currentGenIds = nextGenIds;
      genIndex++;
      if (genIndex > 15) break; // safety
    }

    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--color-maroon)' }}>Ancestors Report</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>Ancestors of: <strong>{p.firstName} {p.surName} ({p.pid})</strong></p>
        </div>

        {ancestorsByGen.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', margin: '2rem' }}>No ancestors recorded.</p>
        ) : (
          ancestorsByGen.map((gen, idx) => (
            <div key={idx} style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ background: '#f5f5f5', padding: '0.4rem 0.8rem', borderLeft: '4px solid var(--color-maroon)', margin: '1rem 0 0.5rem' }}>{gen.title}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '1rem' }}>
                {gen.items.map(({ anc, role, relName }) => (
                  <div key={anc.pid} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f1f1f1' }}>
                    <div>
                      <strong>{anc.firstName} {anc.surName}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: '0.5rem' }}>({anc.pid})</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#666' }}>
                      <span style={{ fontStyle: 'italic', marginRight: '0.5rem' }}>{role}</span>
                      <span style={{ color: '#E91E63', fontWeight: 600 }}>— {relName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  // Report 4: Descendants Report
  const renderDescendants = (centerId) => {
    const p = getPerson(profiles, centerId);
    if (!p) return null;

    let currentGenIds = getChildrenIds(profiles, centerId);
    const descendantsByGen = [];
    let genIndex = 1;

    while (currentGenIds.length > 0) {
      let genTitle = "";
      if (genIndex === 1) genTitle = "Children (Generation 1)";
      else if (genIndex === 2) genTitle = "Grandchildren (Generation 2)";
      else if (genIndex === 3) genTitle = "Great-Grandchildren (Generation 3)";
      else genTitle = `Generation ${genIndex} Descendants`;

      const genItems = [];
      let nextGenIds = [];

      currentGenIds.forEach(descId => {
        const desc = getPerson(profiles, descId);
        if (desc) {
          const g = getGender(profiles, descId);
          let role = "";
          if (genIndex === 1) role = (g === 'Male' ? "Son" : "Daughter");
          else if (genIndex === 2) role = (g === 'Male' ? "Grandson" : "Granddaughter");
          else {
            role = "Great-".repeat(genIndex - 2) + (g === 'Male' ? "Grandson" : "Granddaughter");
          }

          const relName = findRelationship(profiles, centerId, descId, language);
          genItems.push({ desc, role, relName });

          const kids = getChildrenIds(profiles, descId);
          nextGenIds.push(...kids);
        }
      });

      descendantsByGen.push({ title: genTitle, items: genItems });
      currentGenIds = nextGenIds;
      genIndex++;
      if (genIndex > 15) break; // safety
    }

    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--color-maroon)' }}>Descendants Report</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>Descendants of: <strong>{p.firstName} {p.surName} ({p.pid})</strong></p>
        </div>

        {descendantsByGen.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', margin: '2rem' }}>No descendants recorded.</p>
        ) : (
          descendantsByGen.map((gen, idx) => (
            <div key={idx} style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ background: '#f5f5f5', padding: '0.4rem 0.8rem', borderLeft: '4px solid var(--color-maroon)', margin: '1rem 0 0.5rem' }}>{gen.title}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '1rem' }}>
                {gen.items.map(({ desc, role, relName }) => (
                  <div key={desc.pid} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f1f1f1' }}>
                    <div>
                      <strong>{desc.firstName} {desc.surName}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: '0.5rem' }}>({desc.pid})</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#666' }}>
                      <span style={{ fontStyle: 'italic', marginRight: '0.5rem' }}>{role}</span>
                      <span style={{ color: '#E91E63', fontWeight: 600 }}>— {relName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  // Report 5: Full Descendants Report (w/ Spouses)
  const renderFullDescendants = (centerId) => {
    const p = getPerson(profiles, centerId);
    if (!p) return null;

    let currentGenIds = getChildrenIds(profiles, centerId);
    const descendantsByGen = [];
    let genIndex = 1;

    while (currentGenIds.length > 0) {
      let genTitle = "";
      if (genIndex === 1) genTitle = "Generation 1 (Children)";
      else if (genIndex === 2) genTitle = "Generation 2 (Grandchildren)";
      else genTitle = `Generation ${genIndex}`;

      const genItems = [];
      let nextGenIds = [];

      currentGenIds.forEach(descId => {
        const desc = getPerson(profiles, descId);
        if (desc) {
          const relName = findRelationship(profiles, centerId, descId, language);
          
          // Get spouses
          const spouses = (desc.spouseIds || []).map(spid => {
            const sp = getPerson(profiles, spid);
            if (sp) {
              return {
                person: sp,
                relName: findRelationship(profiles, centerId, sp.pid, language)
              };
            }
            return null;
          }).filter(Boolean);

          genItems.push({ desc, relName, spouses });

          const kids = getChildrenIds(profiles, descId);
          nextGenIds.push(...kids);
        }
      });

      descendantsByGen.push({ title: genTitle, items: genItems });
      currentGenIds = nextGenIds;
      genIndex++;
      if (genIndex > 15) break; // safety
    }

    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--color-maroon)' }}>Full Descendants List (with Spouses)</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>All descendants (with spouses) of: <strong>{p.firstName} {p.surName} ({p.pid})</strong></p>
        </div>

        {descendantsByGen.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', margin: '2rem' }}>No descendants recorded.</p>
        ) : (
          descendantsByGen.map((gen, idx) => (
            <div key={idx} style={{ marginBottom: '2rem' }}>
              <h4 style={{ background: '#f5f5f5', padding: '0.4rem 0.8rem', borderLeft: '4px solid var(--color-maroon)', margin: '1rem 0 0.8rem' }}>{gen.title}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '1rem' }}>
                {gen.items.map(({ desc, relName, spouses }) => (
                  <div key={desc.pid} style={{ borderBottom: '1px dashed #eee', paddingBottom: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', marginBottom: '0.2rem' }}>
                      <strong>{desc.firstName} {desc.surName} ({desc.pid})</strong>
                      <span style={{ color: '#E91E63', fontWeight: 600 }}>{relName}</span>
                    </div>
                    {spouses.length > 0 ? (
                      <div style={{ paddingLeft: '1.5rem', color: '#666', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.2rem' }}>
                        {spouses.map(spouse => (
                          <div key={spouse.person.pid}>
                            ❤️ Spouse: <strong>{spouse.person.firstName} {spouse.person.surName} ({spouse.person.pid})</strong>
                            <span style={{ color: '#888', fontSize: '0.8rem', marginLeft: '0.5rem' }}>({spouse.relName})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ paddingLeft: '1.5rem', color: '#999', fontSize: '0.8rem', fontStyle: 'italic' }}>no spouse info</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  // Report 6: Full Descendants Diagram (Horizontal Tree Chart)
  const renderFullDescendantsDiagram = (centerId) => {
    const p = getPerson(profiles, centerId);
    if (!p) return null;

    // Recursive horizontal tree structure in React
    const renderNodeInTree = (pid, depth = 0) => {
      const person = getPerson(profiles, pid);
      if (!person) return null;

      const children = profiles
        .filter(c => c.fatherId === pid || c.motherId === pid)
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      const hasChildren = children.length > 0;

      const relLabel = pid === centerId ? "ME" : findRelationship(profiles, centerId, pid, language);
      
      const avatarUrl = person.photoUrl
        ? person.photoUrl
        : `${import.meta.env.BASE_URL}icons/${person.gender === 'Male' ? 'male_icon.png' : 'female_icon.png'}`;

      const spouses = (person.spouseIds || []).map(spid => getPerson(profiles, spid)).filter(Boolean);

      return (
        <li key={pid}>
          <div className="tf-node-content">
            <div className="tf-card-row">
              {/* Member card */}
              <div className={`tf-node ${pid === centerId ? 'root' : ''}`}>
                <div className={`tf-avatar ${person.gender === 'Male' ? 'male' : 'female'}`}>
                  <img src={avatarUrl} alt={person.firstName} />
                </div>
                <div className="tf-name">{person.firstName} {person.surName}</div>
                {relLabel && <div className="tf-rel">{relLabel}</div>}
                <div className="tf-id">{person.pid}</div>
              </div>

              {/* Spouses */}
              {spouses.map(spouse => {
                const spouseRel = findRelationship(profiles, centerId, spouse.pid, language);
                const spouseAvatar = spouse.photoUrl
                  ? spouse.photoUrl
                  : `${import.meta.env.BASE_URL}icons/${spouse.gender === 'Male' ? 'male_icon.png' : 'female_icon.png'}`;
                
                return (
                  <React.Fragment key={spouse.pid}>
                    <div className="tf-connector">❤️</div>
                    <div className="tf-node tf-spouse-node">
                      <div className={`tf-avatar ${spouse.gender === 'Male' ? 'male' : 'female'}`}>
                        <img src={spouseAvatar} alt={spouse.firstName} />
                      </div>
                      <div className="tf-name">{spouse.firstName} {spouse.surName}</div>
                      {spouseRel && <div className="tf-rel">{spouseRel}</div>}
                      <div className="tf-id">{spouse.pid}</div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          {hasChildren && (
            <ul>
              {children.map(child => renderNodeInTree(child.pid, depth + 1))}
            </ul>
          )}
        </li>
      );
    };

    return (
      <div style={{ padding: '1rem', overflowX: 'auto', textAlign: 'center' }}>
        <style>{`
          .tf-tree { display: inline-block; min-width: 100%; text-align: center; }
          .tf-tree ul {
              padding-top: 20px; position: relative;
              display: flex; justify-content: center;
          }
          .tf-tree li {
              text-align: center; list-style-type: none; position: relative; padding: 20px 5px 0 5px;
          }
          .tf-tree li::before, .tf-tree li::after {
              content: ''; position: absolute; top: 0; right: 50%;
              border-top: 2px solid #ccc; width: 50%; height: 20px;
          }
          .tf-tree li::after { right: auto; left: 50%; border-left: 2px solid #ccc; }
          .tf-tree li:only-child::after, .tf-tree li:only-child::before { display: none; }
          .tf-tree li:only-child { padding-top: 0; }
          .tf-tree li:first-child::before, .tf-tree li:last-child::after { border: 0 none; }
          .tf-tree li:last-child::before { border-right: 2px solid #ccc; border-radius: 0 5px 0 0; }
          .tf-tree li:first-child::after { border-radius: 5px 0 0 0; }
          .tf-tree ul ul::before {
              content: ''; position: absolute; top: 0; left: 50%;
              border-left: 2px solid #ccc; width: 0; height: 20px; transform: translateX(-50%);
          }
          
          .tf-node-content { display: inline-block; position: relative; z-index: 10; background: #fff; }
          .tf-card-row { display: flex; gap: 8px; justify-content: center; align-items: center; border: 1px solid #ddd; padding: 6px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); background: #ffffff; }
          
          .tf-node { display: flex; flex-direction: column; align-items: center; text-align: center; width: 110px; position: relative; }
          .tf-node.root { background: #fffde7; border-radius: 8px; padding: 2px; border: 1px solid #fbc02d; }
          
          .tf-avatar { width: 50px; height: 50px; border-radius: 50%; border: 2px solid #ccc; background: #fff; overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
          .tf-avatar img { width: 100%; height: 100%; object-fit: cover; }
          .tf-avatar.male { border-color: #7BAFF8; }
          .tf-avatar.female { border-color: #F5A3B1; }
          
          .tf-name { font-weight: bold; font-size: 11px; color: #333; line-height: 1.2; margin-bottom: 1px; word-wrap: break-word; width: 100%; }
          .tf-rel { font-size: 9px; color: #E91E63; font-weight: 500; }
          .tf-id { font-size: 8px; color: #aaa; }
          .tf-connector { font-size: 14px; color: #E91E63; }
          .tf-spouse-node .tf-avatar { border-style: dashed; }
        `}</style>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--color-maroon)' }}>Descendants Tree Diagram</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>Descendants tree of: <strong>{p.firstName} {p.surName} ({p.pid})</strong></p>
        </div>

        <div className="tf-tree">
          <ul>
            {renderNodeInTree(centerId)}
          </ul>
        </div>
      </div>
    );
  };

  // Switch to render chosen report
  const renderSelectedReportContent = () => {
    switch (selectedReport) {
      case 'close-family':
        return renderCloseFamily(primaryPid);
      case 'relationship-diagram':
        return renderRelationshipDiagram(primaryPid, secondaryPid);
      case 'ancestors':
        return renderAncestors(primaryPid);
      case 'descendants':
        return renderDescendants(primaryPid);
      case 'full-descendants':
        return renderFullDescendants(primaryPid);
      case 'full-descendants-diagram':
        return renderFullDescendantsDiagram(primaryPid);
      default:
        return (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
            <FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem', display: 'inline-block' }} />
            <p>Please select one of the reports above and click generate.</p>
          </div>
        );
    }
  };

  return (
    <div style={{ paddingBottom: '3rem' }}>
      
      {/* Dynamic styles to inject specific page colors and styles */}
      <style>{`
        .reports-tab-container {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .reports-tab-btn {
          padding: 0.75rem 1.5rem;
          border-radius: 30px;
          border: 1.5px solid var(--color-sandalwood, #EADDCA);
          background: #ffffff;
          color: var(--color-dark);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .reports-tab-btn:hover {
          background-color: var(--color-light, #F4EFE6);
        }
        .reports-tab-btn.active {
          background-color: var(--color-maroon, #63131D);
          color: var(--color-gold, #D4AF37);
          border-color: var(--color-gold, #D4AF37);
          box-shadow: 0 4px 10px rgba(99, 19, 29, 0.25);
        }
        
        .dash-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          margin-bottom: 2.5rem;
        }
        .dash-stat-card {
          background: #ffffff;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          border: 1px solid rgba(0,0,0,0.05);
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }
        .dash-stat-icon-wrapper {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: var(--color-light);
          color: var(--color-maroon);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dash-stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-dark);
          line-height: 1.1;
        }
        .dash-stat-label {
          font-size: 0.82rem;
          color: #777;
          font-weight: 600;
          margin-top: 0.2rem;
        }

        .report-accordion {
          margin-bottom: 1rem;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.02);
          border: 1px solid rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .accordion-header {
          padding: 1.25rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          user-select: none;
          background-color: #ffffff;
          transition: background-color 0.2s;
        }
        .accordion-header:hover {
          background-color: #FAF9F6;
        }
        .accordion-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-maroon);
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .accordion-content {
          border-top: 1px solid #f9f9f9;
          padding: 1.5rem;
          background-color: #FCFAF7;
        }
        
        .progress-track {
          height: 10px;
          border-radius: 50px;
          background: #eaeaea;
          overflow: hidden;
          margin-top: 0.4rem;
        }
        .progress-bar {
          height: 100%;
          border-radius: 50px;
          transition: width 0.5s ease-out;
        }

        .accordion-grid-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 0.75rem;
        }
        .accordion-group-item {
          border: 1px solid #eae5dc;
          border-radius: 6px;
          background: #ffffff;
          overflow: hidden;
        }
        .group-header {
          padding: 0.6rem 1rem;
          background: #fbf9f6;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.92rem;
          border-bottom: 1px solid #f4eade;
        }
        .group-member-list {
          padding: 0.5rem 1rem;
          max-height: 200px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          font-size: 0.85rem;
        }

        .lineage-setup-card {
          background: #ffffff;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 15px rgba(0,0,0,0.03);
          border: 1.5px solid var(--color-sandalwood);
          margin-bottom: 2rem;
        }
        .lineage-options-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.8rem;
          margin-top: 1.5rem;
        }
        .lineage-btn {
          padding: 0.8rem 1rem;
          background: #faf8f5;
          border: 1px solid #e2dad0;
          border-radius: 8px;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.88rem;
          color: var(--color-dark);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lineage-btn:hover {
          background: #f2e9de;
          border-color: var(--color-gold);
          transform: translateY(-1px);
        }
        .lineage-btn.selected {
          background: var(--color-maroon);
          color: var(--color-gold);
          border-color: var(--color-gold);
        }

        .report-viewer-card {
          background: #ffffff;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 6px 20px rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.05);
          position: relative;
        }

        /* Printable / PDF layout override */
        @media print {
          body {
            background-color: #ffffff;
            color: #000000;
          }
          .app-header, .mobile-bottom-nav, .reports-tab-container, .lineage-setup-card, .print-action-bar {
            display: none !important;
          }
          .container {
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
          .report-viewer-card {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .report-print-container {
            width: 100% !important;
          }
        }
      `}</style>

      {/* Main Title Section */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--color-maroon)', fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem' }}>
          {t('reports.title')}
        </h2>
        <p style={{ color: '#666', fontSize: '0.95rem', margin: 0 }}>
          {t('reports.subtitle')}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="reports-tab-container">
        <button 
          className={`reports-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <BarChart2 size={18} />
          {t('reports.tab_stats')}
        </button>
        <button 
          className={`reports-tab-btn ${activeTab === 'lineage' ? 'active' : ''}`}
          onClick={() => setActiveTab('lineage')}
        >
          <GitBranch size={18} />
          {t('reports.tab_lineage')}
        </button>
      </div>

      {/* -------------------------------------------------------------
          TAB CONTENT: DASHBOARD OVERVIEW
          ------------------------------------------------------------- */}
      {activeTab === 'dashboard' && (
        <div>
          {/* Stats Grid */}
          <div className="dash-stats-grid">
            <div className="dash-stat-card">
              <div className="dash-stat-icon-wrapper"><Users size={24} /></div>
              <div>
                <div className="dash-stat-value">{totalCount}</div>
                <div className="dash-stat-label">{t('reports.total_members')}</div>
              </div>
            </div>

            <div className="dash-stat-card">
              <div className="dash-stat-icon-wrapper" style={{ color: '#4A90E2' }}><Users size={24} /></div>
              <div>
                <div className="dash-stat-value">{maleCount} <span style={{ fontSize: '0.85rem', color: '#777', fontWeight: 500 }}>({Math.round((maleCount/totalCount)*100)}%)</span></div>
                <div className="dash-stat-label">{t('reports.males')}</div>
              </div>
            </div>

            <div className="dash-stat-card">
              <div className="dash-stat-icon-wrapper" style={{ color: '#E91E63' }}><Users size={24} /></div>
              <div>
                <div className="dash-stat-value">{femaleCount} <span style={{ fontSize: '0.85rem', color: '#777', fontWeight: 500 }}>({Math.round((femaleCount/totalCount)*100)}%)</span></div>
                <div className="dash-stat-label">{t('reports.females')}</div>
              </div>
            </div>

            <div className="dash-stat-card">
              <div className="dash-stat-icon-wrapper" style={{ color: '#c0392b' }}><Users size={24} /></div>
              <div>
                <div className="dash-stat-value">{deceasedCount} <span style={{ fontSize: '0.85rem', color: '#777', fontWeight: 500 }}>({Math.round((deceasedCount/totalCount)*100)}%)</span></div>
                <div className="dash-stat-label">{t('reports.deceased')}</div>
              </div>
            </div>
            
            <div className="dash-stat-card" style={{ gridColumn: 'span 1' }}>
              <div className="dash-stat-icon-wrapper" style={{ color: '#27ae60' }}><Calendar size={24} /></div>
              <div>
                <div className="dash-stat-value">{avgAge} {t('reports.years')}</div>
                <div className="dash-stat-label">{t('reports.avg_age')}</div>
              </div>
            </div>
          </div>

          {/* Visual Overview Section */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
            border: '1px solid rgba(0,0,0,0.05)',
            marginBottom: '2rem'
          }}>
            <div className="dash-visual-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
              
              {/* 1. Gender Ratio Chart */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', background: '#FCFAF7', borderRadius: '12px', border: '1px solid #F0E8E0' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-maroon)', margin: 0 }}>
                  👥 {t('reports.gender_ratio')}
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666', fontWeight: 600 }}>
                  <span style={{ color: '#4A90E2' }}>{t('reports.males')}: {maleCount} ({Math.round((maleCount/totalCount)*100)}%)</span>
                  <span style={{ color: '#E91E63' }}>{t('reports.females')}: {femaleCount} ({Math.round((femaleCount/totalCount)*100)}%)</span>
                </div>
                <div style={{ height: '16px', borderRadius: '8px', background: '#eaeaea', overflow: 'hidden', display: 'flex', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ width: `${(maleCount/totalCount)*100}%`, background: '#4A90E2', height: '100%', transition: 'width 0.6s ease' }} title="Males" />
                  <div style={{ width: `${(femaleCount/totalCount)*100}%`, background: '#E91E63', height: '100%', transition: 'width 0.6s ease' }} title="Females" />
                </div>
              </div>

              {/* 2. Top Gotrams Bar Graph */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', background: '#FCFAF7', borderRadius: '12px', border: '1px solid #F0E8E0' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-maroon)', margin: 0 }}>
                  🔱 {t('reports.top_gotrams')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {gotramData.slice(0, 3).map(g => {
                    const pct = Math.round((g.count / totalCount) * 100);
                    return (
                      <div key={g.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                          <span style={{ color: '#555' }}>{g.name}</span>
                          <span style={{ color: 'var(--color-maroon)' }}>{g.count} ({pct}%)</span>
                        </div>
                        <div style={{ height: '8px', borderRadius: '4px', background: '#EAEAEA', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, background: 'var(--color-gold, #D4AF37)', height: '100%', borderRadius: '4px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Top Surnames Bar Graph */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', background: '#FCFAF7', borderRadius: '12px', border: '1px solid #F0E8E0' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-maroon)', margin: 0 }}>
                  🏡 {t('reports.top_surnames')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {surnameData.slice(0, 3).map(s => {
                    const pct = Math.round((s.count / totalCount) * 100);
                    return (
                      <div key={s.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                          <span style={{ color: '#555' }}>{s.name}</span>
                          <span style={{ color: 'var(--color-maroon)' }}>{s.count} ({pct}%)</span>
                        </div>
                        <div style={{ height: '8px', borderRadius: '4px', background: '#EAEAEA', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, background: 'var(--color-maroon, #63131D)', height: '100%', borderRadius: '4px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Age Demographics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', background: '#FCFAF7', borderRadius: '12px', border: '1px solid #F0E8E0' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-maroon)', margin: 0 }}>
                  ⏳ {t('reports.age_demographics')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {Object.entries(ageData).map(([bracket, list]) => {
                    if (bracket === 'Unknown DOB / Deceased') return null;
                    const pct = Math.round((list.length / totalCount) * 100);
                    return (
                      <div key={bracket} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                          <span style={{ color: '#555' }}>{bracket}</span>
                          <span style={{ color: 'var(--color-maroon)' }}>{list.length} ({pct}%)</span>
                        </div>
                        <div style={{ height: '8px', borderRadius: '4px', background: '#EAEAEA', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, background: '#27ae60', height: '100%', borderRadius: '4px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Accordion List */}
          
          {/* Gotram Accordion */}
          <div className="report-accordion">
            <div className="accordion-header" onClick={() => handleToggleSection('gotram')}>
              <div className="accordion-title">
                <FileText size={20} />
                {t('reports.gotram_dist')} ({gotramData.length} Gotrams)
              </div>
              <ChevronDown size={20} style={{ transform: expandedSection === 'gotram' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {expandedSection === 'gotram' && (
              <div className="accordion-content">
                <div className="accordion-grid-list">
                  {gotramData.map(group => (
                    <div className="accordion-group-item" key={group.name}>
                      <div className="group-header" onClick={() => handleToggleItem(`gotram-${group.name}`)}>
                        <span>{group.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', background: '#eaeaea', padding: '2px 8px', borderRadius: '20px' }}>{group.count}</span>
                          <ChevronDown size={14} style={{ transform: expandedItems[`gotram-${group.name}`] ? 'rotate(180deg)' : 'none' }} />
                        </div>
                      </div>
                      {expandedItems[`gotram-${group.name}`] && (
                        <div className="group-member-list">
                          {group.list.map(p => (
                            <div key={p.pid} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9f9f9', padding: '2px 0' }}>
                              <span>{p.firstName} {p.surName}</span>
                              <span style={{ color: '#999', fontSize: '0.75rem' }}>{p.pid}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Surname Accordion */}
          <div className="report-accordion">
            <div className="accordion-header" onClick={() => handleToggleSection('surname')}>
              <div className="accordion-title">
                <FileText size={20} />
                {t('reports.surname_dist')} ({surnameData.length} Surnames)
              </div>
              <ChevronDown size={20} style={{ transform: expandedSection === 'surname' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {expandedSection === 'surname' && (
              <div className="accordion-content">
                <div className="accordion-grid-list">
                  {surnameData.map(group => (
                    <div className="accordion-group-item" key={group.name}>
                      <div className="group-header" onClick={() => handleToggleItem(`surname-${group.name}`)}>
                        <span>{group.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', background: '#eaeaea', padding: '2px 8px', borderRadius: '20px' }}>{group.count}</span>
                          <ChevronDown size={14} style={{ transform: expandedItems[`surname-${group.name}`] ? 'rotate(180deg)' : 'none' }} />
                        </div>
                      </div>
                      {expandedItems[`surname-${group.name}`] && (
                        <div className="group-member-list">
                          {group.list.map(p => (
                            <div key={p.pid} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9f9f9', padding: '2px 0' }}>
                              <span>{p.firstName} {p.surName}</span>
                              <span style={{ color: '#999', fontSize: '0.75rem' }}>{p.pid}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Generation Accordion */}
          <div className="report-accordion">
            <div className="accordion-header" onClick={() => handleToggleSection('generation')}>
              <div className="accordion-title">
                <GitBranch size={20} />
                {t('reports.gen_dist')} ({generationData.length} Generations)
              </div>
              <ChevronDown size={20} style={{ transform: expandedSection === 'generation' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {expandedSection === 'generation' && (
              <div className="accordion-content">
                <div className="accordion-grid-list">
                  {generationData.map(group => (
                    <div className="accordion-group-item" key={group.level}>
                      <div className="group-header" onClick={() => handleToggleItem(`gen-${group.level}`)}>
                        <span>{t('reports.generation')} {group.level}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', background: '#eaeaea', padding: '2px 8px', borderRadius: '20px' }}>{group.count}</span>
                          <ChevronDown size={14} style={{ transform: expandedItems[`gen-${group.level}`] ? 'rotate(180deg)' : 'none' }} />
                        </div>
                      </div>
                      {expandedItems[`gen-${group.level}`] && (
                        <div className="group-member-list">
                          {group.list.map(p => (
                            <div key={p.pid} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9f9f9', padding: '2px 0' }}>
                              <span>{p.firstName} {p.surName}</span>
                              <span style={{ color: '#999', fontSize: '0.75rem' }}>{p.pid}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Age Demographics Accordion */}
          <div className="report-accordion">
            <div className="accordion-header" onClick={() => handleToggleSection('age')}>
              <div className="accordion-title">
                <Calendar size={20} />
                {t('reports.age_demographics')}
              </div>
              <ChevronDown size={20} style={{ transform: expandedSection === 'age' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {expandedSection === 'age' && (
              <div className="accordion-content">
                <div className="accordion-grid-list">
                  {ageData.map(group => (
                    <div className="accordion-group-item" key={group.name}>
                      <div className="group-header" onClick={() => handleToggleItem(`age-${group.name}`)}>
                        <span>{group.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', background: '#eaeaea', padding: '2px 8px', borderRadius: '20px' }}>{group.count}</span>
                          <ChevronDown size={14} style={{ transform: expandedItems[`age-${group.name}`] ? 'rotate(180deg)' : 'none' }} />
                        </div>
                      </div>
                      {expandedItems[`age-${group.name}`] && (
                        <div className="group-member-list">
                          {group.list.map(p => (
                            <div key={p.pid} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9f9f9', padding: '2px 0' }}>
                              <span>{p.firstName} {p.surName} {p.dob ? `(${p.dob})` : ''}</span>
                              <span style={{ color: '#999', fontSize: '0.75rem' }}>{p.pid}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Astrological Accordion */}
          <div className="report-accordion">
            <div className="accordion-header" onClick={() => handleToggleSection('astro')}>
              <div className="accordion-title">
                <Calendar size={20} />
                {t('reports.astro_dist')}
              </div>
              <ChevronDown size={20} style={{ transform: expandedSection === 'astro' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {expandedSection === 'astro' && (
              <div className="accordion-content">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '2rem' }}>
                  
                  {/* Rashis */}
                  <div>
                    <h4 style={{ color: 'var(--color-maroon)', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.3rem' }}>Rashi Details</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {astroData.rashis.map(group => (
                        <div className="accordion-group-item" key={group.name}>
                          <div className="group-header" onClick={() => handleToggleItem(`rashi-${group.name}`)}>
                            <span>{group.name} Rashi</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.82rem', background: '#eaeaea', padding: '2px 8px', borderRadius: '20px' }}>{group.count}</span>
                              <ChevronDown size={14} style={{ transform: expandedItems[`rashi-${group.name}`] ? 'rotate(180deg)' : 'none' }} />
                            </div>
                          </div>
                          {expandedItems[`rashi-${group.name}`] && (
                            <div className="group-member-list">
                              {group.list.map(p => (
                                <div key={p.pid} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9f9f9', padding: '2px 0' }}>
                                  <span>{p.firstName} {p.surName}</span>
                                  <span style={{ color: '#999', fontSize: '0.75rem' }}>{p.pid}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Nakshatras */}
                  <div>
                    <h4 style={{ color: 'var(--color-maroon)', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.3rem' }}>Nakshatra Details</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {astroData.nakshatras.map(group => (
                        <div className="accordion-group-item" key={group.name}>
                          <div className="group-header" onClick={() => handleToggleItem(`nak-${group.name}`)}>
                            <span>{group.name} Nakshatram</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.82rem', background: '#eaeaea', padding: '2px 8px', borderRadius: '20px' }}>{group.count}</span>
                              <ChevronDown size={14} style={{ transform: expandedItems[`nak-${group.name}`] ? 'rotate(180deg)' : 'none' }} />
                            </div>
                          </div>
                          {expandedItems[`nak-${group.name}`] && (
                            <div className="group-member-list">
                              {group.list.map(p => (
                                <div key={p.pid} style={{ display: 'flex', justifyStyle: 'space-between', borderBottom: '1px solid #f9f9f9', padding: '2px 0' }}>
                                  <span>{p.firstName} {p.surName}</span>
                                  <span style={{ color: '#999', fontSize: '0.75rem' }}>{p.pid}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB CONTENT: LINEAGE REPORTS
          ------------------------------------------------------------- */}
      {activeTab === 'lineage' && (
        <div>
          {/* Setup controls */}
          <div className="lineage-setup-card">
            <h4 style={{ color: 'var(--color-maroon)', margin: '0 0 1rem', fontSize: '1.1rem' }}>
              {t('reports.select_primary')}
            </h4>
            
            <div style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
              <SearchableSelect 
                options={personOptions}
                value={primaryPid}
                onChange={handleSelectPerson}
                placeholder="Search name..."
              />
            </div>

            {primaryPid && (
              <>
                <h5 style={{ margin: '1.5rem 0 0.75rem', color: '#666', fontWeight: 600 }}>
                  {t('reports.choose_report')}:
                </h5>
                <div className="lineage-options-grid">
                  <button 
                    className={`lineage-btn ${selectedReport === 'close-family' ? 'selected' : ''}`}
                    onClick={() => triggerReport('close-family')}
                  >
                    <span>1) {t('reports.close_family')} 📄</span>
                    <ChevronRight size={16} />
                  </button>

                  <button 
                    className={`lineage-btn ${selectedReport === 'relationship-diagram' ? 'selected' : ''}`}
                    onClick={() => triggerReport('relationship-diagram')}
                  >
                    <span>2) {t('reports.relationship_diagram')} ⟷</span>
                    <ChevronRight size={16} />
                  </button>

                  <button 
                    className={`lineage-btn ${selectedReport === 'ancestors' ? 'selected' : ''}`}
                    onClick={() => triggerReport('ancestors')}
                  >
                    <span>3) {t('reports.ancestors')} 🌳</span>
                    <ChevronRight size={16} />
                  </button>

                  <button 
                    className={`lineage-btn ${selectedReport === 'descendants' ? 'selected' : ''}`}
                    onClick={() => triggerReport('descendants')}
                  >
                    <span>4) {t('reports.descendants')} 👶</span>
                    <ChevronRight size={16} />
                  </button>

                  <button 
                    className={`lineage-btn ${selectedReport === 'full-descendants' ? 'selected' : ''}`}
                    onClick={() => triggerReport('full-descendants')}
                  >
                    <span>5) {t('reports.full_descendants')} 👨‍👩‍👧‍👦</span>
                    <ChevronRight size={16} />
                  </button>

                  <button 
                    className={`lineage-btn ${selectedReport === 'full-descendants-diagram' ? 'selected' : ''}`}
                    onClick={() => triggerReport('full-descendants-diagram')}
                  >
                    <span>6) {t('reports.full_descendants_diagram')} 🌳</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}

            {/* Second person select (for relationship diagram only) */}
            {showRelDiagramSecondary && (
              <div style={{ marginTop: '2rem', padding: '1.25rem', backgroundColor: '#fcfbfa', border: '1.5px solid var(--color-sandalwood)', borderRadius: '8px' }}>
                <h4 style={{ color: 'var(--color-maroon)', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>
                  {t('reports.select_secondary')}
                </h4>
                <div style={{ maxWidth: '400px' }}>
                  <SearchableSelect 
                    options={personOptions.filter(o => o.value !== primaryPid)}
                    value={secondaryPid}
                    onChange={handleSelectSecondary}
                    placeholder="Search second name..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Report output area */}
          {primaryPid && selectedReport && (
            <div className="report-viewer-card">
              {/* Action Bar (Print / PDF) */}
              <div className="print-action-bar" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                <button 
                  onClick={printReport}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--color-maroon)',
                    color: 'var(--color-gold)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <Printer size={16} />
                  {t('reports.print_btn')}
                </button>
              </div>

              {/* Generated content */}
              <div style={{ padding: '0.5rem 0' }}>
                {renderSelectedReportContent()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
