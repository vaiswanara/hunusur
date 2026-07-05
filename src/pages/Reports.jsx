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
import { useNavigate } from 'react-router-dom';

const Reports = ({ profiles }) => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  
  // State for lineage reports
  const [primaryPid, setPrimaryPid] = useState('');
  const [secondaryPid, setSecondaryPid] = useState('');
  const [selectedReport, setSelectedReport] = useState(''); // 'close-family', 'relationship-diagram', 'ancestors', 'descendants', 'full-descendants', 'full-descendants-diagram'
  const [showRelDiagramSecondary, setShowRelDiagramSecondary] = useState(false);

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

      let birthYear = "";
      if (p.dob) {
        const dObj = parseDate(p.dob);
        if (dObj && !isNaN(dObj.getFullYear())) {
          birthYear = dObj.getFullYear();
        }
      }

      return (
        <div className="ca-node-wrapper" key={pid}>
          <div 
            className={`ca-node ${isRoot ? 'root' : ''}`} 
            style={{ 
              border: isRoot ? '2px solid #FF9800' : `2px solid ${p.gender === 'Male' ? '#4A90E2' : '#E91E63'}`,
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onClick={() => {
              localStorage.setItem('vamsha_home_pid', p.pid);
              navigate('/tree');
            }}
            title="Click to view in Tree"
          >
            {label && <div className="ca-node-role">{label}</div>}
            <div style={{ position: 'relative' }}>
              <img src={avatarUrl} alt={p.firstName} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #eee' }} />
              {p.isDeceased && (
                <span 
                  title="Deceased"
                  style={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    right: 0, 
                    fontSize: '0.85rem', 
                    background: 'white', 
                    borderRadius: '50%', 
                    padding: '2px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  🪔
                </span>
              )}
            </div>
            <div className="ca-node-name" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{displayName}</div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '2px' }}>
              {birthYear && <span style={{ fontSize: '0.7rem', color: '#666', background: '#f0ede6', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>{birthYear}</span>}
              <span className="ca-node-id" style={{ fontSize: '0.7rem', color: '#999' }}>{p.pid}</span>
            </div>
          </div>
        </div>
      );
    };

    const finalRel = findRelationship(profiles, id1, id2, language);

    // Compute step-by-step descriptions
    const stepSentences = [];
    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i+1];
      const pU = getPerson(profiles, u);
      const pV = getPerson(profiles, v);
      if (pU && pV) {
        const relationCode = getRelationshipCode(profiles, u, v);
        const relTerm = resolveRelationName(profiles, relationCode, pU, pV, language);
        
        let sentence = "";
        if (language === 'te') {
          sentence = t('reports.step_connect_te')
            .replace('{name1}', `<strong>${pV.firstName} ${pV.surName}</strong>`)
            .replace('{name2}', `<strong>${pU.firstName} ${pU.surName}</strong>`)
            .replace('{relation}', relTerm);
        } else if (language === 'kn') {
          sentence = t('reports.step_connect_kn')
            .replace('{name1}', `<strong>${pV.firstName} ${pV.surName}</strong>`)
            .replace('{name2}', `<strong>${pU.firstName} ${pU.surName}</strong>`)
            .replace('{relation}', relTerm);
        } else {
          sentence = t('reports.step_connect_en')
            .replace('{name1}', `<strong>${pV.firstName} ${pV.surName}</strong>`)
            .replace('{name2}', `<strong>${pU.firstName} ${pU.surName}</strong>`)
            .replace('{relation}', relTerm);
        }
        stepSentences.push(sentence);
      }
    }

    let conclusion = "";
    if (language === 'te') {
      conclusion = t('reports.conclusion_te')
        .replace('{name1}', `${p1.firstName} ${p1.surName}`)
        .replace('{name2}', `${p2.firstName} ${p2.surName}`)
        .replace('{relation}', finalRel);
    } else if (language === 'kn') {
      conclusion = t('reports.conclusion_kn')
        .replace('{name1}', `${p1.firstName} ${p1.surName}`)
        .replace('{name2}', `${p2.firstName} ${p2.surName}`)
        .replace('{relation}', finalRel);
    } else {
      conclusion = t('reports.conclusion_en')
        .replace('{name1}', `${p1.firstName} ${p1.surName}`)
        .replace('{name2}', `${p2.firstName} ${p2.surName}`)
        .replace('{relation}', finalRel);
    }

    // Clean text for copy/share (stripping HTML tags)
    const getCleanText = () => {
      const cleanSteps = [];
      for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i+1];
        const pU = getPerson(profiles, u);
        const pV = getPerson(profiles, v);
        if (pU && pV) {
          const relationCode = getRelationshipCode(profiles, u, v);
          const relTerm = resolveRelationName(profiles, relationCode, pU, pV, language);
          
          let cleanSentence = "";
          if (language === 'te') {
            cleanSentence = `${pV.firstName} ${pV.surName} గారు ${pU.firstName} ${pU.surName} కు "${relTerm}" అవుతారు`;
          } else if (language === 'kn') {
            cleanSentence = `${pV.firstName} ${pV.surName} ಅವರು ${pU.firstName} ${pU.surName} ಗೆ "${relTerm}" ಆಗುತ್ತಾರೆ`;
          } else {
            cleanSentence = `${pV.firstName} ${pV.surName} is the ${relTerm} of ${pU.firstName} ${pU.surName}`;
          }
          cleanSteps.push(cleanSentence);
        }
      }

      let cleanConclusion = "";
      if (language === 'te') {
        cleanConclusion = `కావున, ${p2.firstName} ${p2.surName} గారు ${p1.firstName} ${p1.surName} కు "${finalRel}" అవుతారు.`;
      } else if (language === 'kn') {
        cleanConclusion = `ಆದ್ದರಿಂದ, ${p2.firstName} ${p2.surName} ಅವರು ${p1.firstName} ${p1.surName} ಗೆ "${finalRel}" ಆಗುತ್ತಾರೆ.`;
      } else {
        cleanConclusion = `Therefore, ${p2.firstName} ${p2.surName} is the ${finalRel} of ${p1.firstName} ${p1.surName}.`;
      }

      return { cleanSteps, cleanConclusion };
    };

    const handleCopyPath = () => {
      const { cleanSteps, cleanConclusion } = getCleanText();
      const textToCopy = `*${p1.firstName} & ${p2.firstName} బంధుత్వ విశ్లేషణ:*\n\n` + 
        cleanSteps.map((s, idx) => `${idx + 1}. ${s}`).join('\n') + 
        `\n\n👉 *${cleanConclusion}*`;
      navigator.clipboard.writeText(textToCopy);
      alert(t('reports.path_copied'));
    };

    const handleShareWhatsApp = () => {
      const { cleanSteps, cleanConclusion } = getCleanText();
      const textToShare = `*${p1.firstName} & ${p2.firstName} బంధుత్వ విశ్లేషణ:*\n\n` + 
        cleanSteps.map((s, idx) => `${idx + 1}. ${s}`).join('\n') + 
        `\n\n👉 *${cleanConclusion}*`;
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(textToShare)}`;
      window.open(url, '_blank');
    };

    return (
      <div style={{ padding: '1rem', overflowX: 'auto' }}>
        <style>{`
          .ca-diagram { display: flex; flex-direction: column; align-items: center; padding: 20px 10px; font-family: sans-serif; }
          .ca-node {
              border-radius: 12px; padding: 10px; text-align: center;
              width: 130px; background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.04);
              z-index: 2; position: relative; display: flex; flex-direction: column; align-items: center;
              border: 2px solid var(--color-sandalwood);
              transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .ca-node:hover {
              transform: translateY(-4px);
              box-shadow: 0 8px 20px rgba(99, 19, 29, 0.08);
          }
          .ca-node.root { background: #fffde7; border-color: #fbc02d !important; }
          .ca-node img { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; margin-bottom: 5px; border: 1px solid #eee; }
          .ca-node-name { font-weight: bold; color: #333; line-height: 1.2; }
          .ca-node-role { 
              font-size: 9px; color: var(--color-maroon); font-weight: bold; background: #FFF3F3; 
              padding: 2px 8px; border-radius: 10px; margin-bottom: 6px; border: 1px solid #FFDCDC;
              text-transform: uppercase; letter-spacing: 0.5px;
          }
          .ca-pivot-wrapper { display: flex; flex-direction: column; align-items: center; position: relative; margin-bottom: 30px; }
          
          @keyframes linePulse {
            0% { background-position: 0% 0%; }
            100% { background-position: 0% 200%; }
          }

          .ca-pivot-wrapper::after,
          .ca-node-wrapper::after,
          .ca-branch::after,
          .ca-sibling-container::before {
              content: ''; position: absolute;
              background: linear-gradient(180deg, #D3BCA2 0%, var(--color-maroon) 50%, #D3BCA2 100%);
              background-size: 100% 200%;
              animation: linePulse 1.5s linear infinite;
          }

          .ca-pivot-wrapper::after {
              top: 100%; left: 50%; width: 2px; height: 30px;
              transform: translateX(-50%);
          }
          .ca-branches { display: flex; justify-content: center; gap: 40px; position: relative; }
          .ca-branch { display: flex; flex-direction: column; align-items: center; position: relative; padding-top: 30px; }
          .ca-branch::before { content: ''; position: absolute; top: 0; height: 2px; background: #bbb; }
          .ca-branch.left::before { right: -20px; width: calc(50% + 20px); }
          .ca-branch.right::before { left: -20px; width: calc(50% + 20px); }
          .ca-branch::after {
              top: 0; left: 50%; width: 2px; height: 30px;
              transform: translateX(-50%);
          }
          .ca-node-wrapper { position: relative; margin-bottom: 30px; }
          .ca-node-wrapper:last-child { margin-bottom: 0; }
          .ca-node-wrapper::after {
              top: 100%; left: 50%; width: 2px; height: 30px;
              transform: translateX(-50%);
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
              top: 45px; left: 50%; transform: translateX(-50%);
              width: 60px; height: 2px; z-index: 1;
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

        {/* Step-by-Step Explanation Card */}
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          backgroundColor: '#FCFAF7',
          borderRadius: '12px',
          border: '1.5px solid var(--color-sandalwood, #EADDCA)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
        }}>
          <h4 style={{ color: 'var(--color-maroon)', marginTop: 0, marginBottom: '1.25rem', fontSize: '1.1rem', fontWeight: 800 }}>
            📜 {t('reports.relation_path') || 'Step-by-Step Relationship Pathway'}
          </h4>

          {/* Quick Actions (WhatsApp Share & Copy) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '1.5rem' }}>
            <button 
              onClick={handleShareWhatsApp}
              style={{
                padding: '0.6rem 1.2rem',
                backgroundColor: '#25D366',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(37, 211, 102, 0.2)',
                transition: 'filter 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.08)'}
              onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
            >
              💬 {t('reports.share_whatsapp')}
            </button>
            <button 
              onClick={handleCopyPath}
              style={{
                padding: '0.6rem 1.2rem',
                backgroundColor: 'var(--color-maroon)',
                color: 'var(--color-gold)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(99, 19, 29, 0.15)',
                transition: 'filter 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.08)'}
              onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
            >
              📋 {t('reports.copy_path')}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {stepSentences.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px', fontSize: '0.92rem', color: '#444', lineHeight: '1.5' }}>
                <span style={{ 
                  minWidth: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  backgroundColor: 'var(--color-sandalwood)', 
                  color: 'var(--color-maroon)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontWeight: 'bold', 
                  fontSize: '0.82rem', 
                  flexShrink: 0,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                }}>
                  {idx + 1}
                </span>
                <span dangerouslySetInnerHTML={{ __html: s }} />
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px dashed var(--color-sandalwood)',
            fontSize: '1.1rem',
            fontWeight: 800,
            color: 'var(--color-maroon)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            👉 {conclusion}
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
          .app-header, .mobile-bottom-nav, .lineage-setup-card, .print-action-bar {
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
  );
};

export default Reports;
