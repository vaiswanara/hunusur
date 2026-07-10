# 🛠️ Vamsha (వంశ) — Git Commands Cheatsheet

ఈ గైడ్ మీ వంశ వృక్షం ప్రాజెక్ట్‌లో తరచూ ఉపయోగించే గిట్ (Git) కమాండ్‌లను సులభంగా అర్థం చేసుకోవడానికి మరియు ఉపయోగించడానికి రూపొందించబడింది. ఇందులో తెలుగు వివరణలతో పాటు పూర్తి కమాండ్‌లు ఉన్నాయి.

---

## 1. బేసిక్ వర్каўలో కమాండ్లు (Basic Workflow Commands)
కోడ్ మార్పులను చెక్ చేయడం, యాడ్ చేయడం మరియు లోకల్ గా సేవ్ (Commit) చేయడం:

| కమాండ్ (Command) | తెలుగు వివరణ (Description) |
| :--- | :--- |
| `git status` | ఏ ఫైల్స్ మారాయో మరియు ఏవి యాడ్ అవ్వాలో చూపిస్తుంది. |
| `git add .` | మారిన అన్ని ఫైల్స్‌ను స్టేజింగ్ ఏరియాకి యాడ్ చేస్తుంది. |
| `git add path/to/file` | కేవలం ఒక నిర్దిష్ట ఫైల్‌ను మాత్రమే యాడ్ చేస్తుంది. |
| `git commit -m "commit message"` | యాడ్ చేసిన మార్పులకు ఒక పేరు పెట్టి లోకల్ గా సేవ్ చేస్తుంది. |

---

## 2. రిమోట్ రిపోజిటరీల మేనేజ్‌మెంట్ (Remote Repository Management)
మల్టిపుల్ గిట్‌హబ్ అకౌంట్లు లేదా వేర్వేరు రిపోజిటరీలను మేనేజ్ చేయడానికి:

### A. రిమోట్ లింకులను చూడటం (View Remotes)
ప్రస్తుతం మీ ప్రాజెక్ట్ ఏయే గిట్‌హబ్ లింకులకు కనెక్ట్ అయి ఉందో తెలుసుకోవడానికి:
```bash
git remote -v
```

### B. కొత్త రిమోట్ లింక్‌ను యాడ్ చేయడం (Add Remote)
వేరొక అకౌంట్ లేదా కొత్త రిపోజిటరీ లింక్‌ను జోడించడానికి:
```bash
git remote add <రిమోట్_పేరు> <గిట్‌హబ్_URL>
```
* *ఉదాహరణ:* `git remote add katuru https://github.com/katuru82/vamsha.git`
* *ఉదాహరణ:* `git remote add hunusur https://github.com/vaiswanara/hunusur.git`

### C. ఉన్న రిమోట్ లింక్‌ను మార్చడం (Change Remote URL)
ఒకవేళ పాత లింక్‌ను తీసేసి కొత్త లింక్ మార్చాలనుకుంటే (URL తప్పుగా టైప్ చేసినప్పుడు):
```bash
git remote set-url <రిమోట్_పేరు> <కొత్త_గిట్‌హబ్_URL>
```
* *ఉదాహరణ:* `git remote set-url origin https://github.com/katuru82/vamsha.git`
* *ఉదాహరణ:* `git remote set-url hunusur https://github.com/vaiswanara/hunusur.git`

### D. రిమోట్ ని తొలగించడం (Remove Remote)
అవసరం లేని పాత రిమోట్ లింక్‌ను డిలీట్ చేయడానికి:
```bash
git remote remove <రిమోట్_పేరు>
```
* *ఉదాహరణ:* `git remote remove katuru`

---

## 3. కోడ్‌ను పుష్ మరియు పుల్ చేయడం (Push & Pull)
గిట్‌హబ్ లోకి కోడ్ పంపడం లేదా అక్కడ నుండి తెచ్చుకోవడం:

### A. సాధారణ పుష్ (Normal Push)
మీ మార్పులను సురక్షితంగా గిట్‌హబ్ లోకి పంపడానికి:
```bash
git push <రిమోట్_పేరు> main
```
* *ఉదాహరణ:* `git push origin main` (vaiswanara కి పుష్ చేయడానికి)
* *ఉదాహరణ:* `git push katuru main` (katuru82 కి పుష్ చేయడానికి)

### B. ఫోర్స్ పుష్ (Force Push) — ⚠️ జాగ్రత్తగా వాడండి
రిపోజిటరీ సరికొత్తదైనా లేదా హిస్టరీ వేరుగా ఉన్నందున పుష్ రిజెక్ట్ అయినప్పుడు, మీ లోకల్ కోడ్‌తో గిట్‌హబ్‌ని ఓవర్‌రైట్ చేయడానికి:
```bash
git push <రిమోట్_పేరు> main --force
```
* *ఉదాహరణ:* `git push hunusur main --force`
* *ఉదాహరణ:* `git push katuru main --force`

### C. పుల్ చేయడం (Pull Remote Changes)
గిట్‌హబ్ లో ఇతరులు చేసిన మార్పులను మీ లోకల్ కంప్యూటర్ లోకి అప్‌డేట్ చేసుకోవడానికి:
```bash
git pull <రిమోట్_పేరు> main
```

---

## 🔍 ట్రబుల్‌షూటింగ్ చిట్కాలు (Troubleshooting Tips)

### 1. `rejected (non-fast-forward)` లేదా `fetch first` ఎర్రర్ వస్తే:
* **కారణం:** గిట్‌హబ్ లో ఉన్న ఫైల్స్ మీ లోకల్ కంప్యూటర్ లో లేవు (ఉదా: రిపోజిటరీ క్రియేట్ చేసినప్పుడు README క్రియేట్ చేయడం వల్ల).
* **పరిష్కారం:** మీ లోకల్ కోడ్ మాత్రమే ఫైనల్ అనుకుంటే, ఫోర్స్ పుష్ చేయండి: `git push <రిమోట్_పేరు> main --force`

### 2. `fatal: refusing to merge unrelated histories` ఎర్రర్ వస్తే:
* **కారణం:** రెండు రిపోజిటరీల హిస్టరీ వేరువేరుగా ఉన్నప్పుడు వాటిని కలపడానికి గిట్ ఒప్పుకోదు.
* **పరిష్కారం:** మీరు గిట్‌హబ్ లోలోని మార్పులను కూడా ఉంచి లోకల్ కోడ్‌తో కలపాలనుకుంటే: `git pull <రిమోట్_పేరు> main --allow-unrelated-histories`


MITRAMAA, same code ni nenu vaiswanara/hunusur ki push cheyalante ye ye commands vaadaali. 

కొత్త రిమోట్ జోడించడానికి: టర్మినల్ లో ఈ కింది కమాండ్ రన్ చేయండి (ఇక్కడ hunusur అనేది మనం పెట్టుకున్న రిమోట్ పేరు):

bash
git remote add hunusur https://github.com/vaiswanara/hunusur.git

కోడ్ పుష్ చేయడానికి:

bash
git push -u hunusur main

(భవిష్యత్తులో vamsha కి పుష్ చేయడానికి git push origin main అని, hunusur కి పుష్ చేయడానికి git push hunusur main అని వాడవచ్చు).

మార్గం 2: ఉన్న రిమోట్ లింక్‌ను మార్చడం
మీరు ఇకపై vamsha రిపోజిటరీని వాడకూడదని, కేవలం hunusur కి మాత్రమే కోడ్ పుష్ చేయాలని అనుకుంటే ఈ పద్ధతి వాడండి.

ప్రస్తుత origin యొక్క లింక్‌ను మార్చడానికి:

bash
git remote set-url origin https://github.com/vaiswanara/hunusur.git

కోడ్ పుష్ చేయడానికి:

bash
git push -u origin main
⚠️ ముఖ్య గమనిక (Force Push):

ఒకవేళ vaiswanara/hunusur రిపోజిటరీ ఖాళీగా లేకుండా, అందులో ఇప్పటికే పాత కోడ్ లేదా వేరే ఫైళ్లు ఉంటే.. పుష్ చేసేటప్పుడు గిట్ తిరస్కరించవచ్చు (reject చేయవచ్చు).

అలాంటప్పుడు, అక్కడ ఉన్న కోడ్‌ను ఓవర్‌రైట్ చేస్తూ ఫోర్స్ పుష్ చేయడానికి కమాండ్ చివరన --force జోడించాలి:

మార్గం 1 కోసం: git push -u hunusur main --force
మార్గం 2 కోసం: git push -u origin main --force