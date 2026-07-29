"use client";

import { ChangeEvent, useMemo, useState } from "react";

type Stage = "New" | "Review" | "Contacted" | "Interview" | "Hold";
type Candidate = {
  id: number;
  name: string;
  role: string;
  department: string;
  source: string;
  stage: Stage;
  score: number;
  email: string;
  phone: string;
  experience: string;
  skills: string[];
  updated: string;
};

const seed: Candidate[] = [
  { id: 1, name: "Maya Chen", role: "Frontend Engineer", department: "Engineering", source: "LinkedIn", stage: "Review", score: 92, email: "maya.chen@example.com", phone: "", experience: "5 years", skills: ["React", "TypeScript", "Design systems"], updated: "Today" },
  { id: 2, name: "Jordan Brooks", role: "Product Designer", department: "Design", source: "Portfolio", stage: "Contacted", score: 86, email: "jordan.brooks@example.com", phone: "", experience: "6 years", skills: ["Figma", "Research", "Prototyping"], updated: "Yesterday" },
  { id: 3, name: "Alex Rivera", role: "Sales Development Rep", department: "Sales", source: "Indeed", stage: "New", score: 78, email: "alex.rivera@example.com", phone: "", experience: "3 years", skills: ["CRM", "Outbound", "SaaS"], updated: "Yesterday" },
  { id: 4, name: "Priya Shah", role: "Growth Marketing Manager", department: "Marketing", source: "Referral", stage: "Interview", score: 88, email: "priya.shah@example.com", phone: "", experience: "7 years", skills: ["SEO", "Analytics", "Lifecycle"], updated: "Jul 24" },
  { id: 5, name: "Sam Wilson", role: "Backend Engineer", department: "Engineering", source: "LinkedIn", stage: "Hold", score: 69, email: "sam.wilson@example.com", phone: "", experience: "2 years", skills: ["Python", "APIs", "SQL"], updated: "Jul 23" },
];

const jobKeywords = ["react", "typescript", "javascript", "python", "sql", "figma", "salesforce", "seo", "analytics", "design", "api", "product", "marketing"];
const stages: Stage[] = ["New", "Review", "Contacted", "Interview", "Hold"];

function scoreResume(text: string) {
  const lowered = text.toLowerCase();
  const matches = jobKeywords.filter((word) => lowered.includes(word));
  const years = Number(lowered.match(/(\d+)\+?\s*years?/)?.[1] ?? 0);
  return Math.min(98, Math.max(42, 42 + matches.length * 8 + Math.min(years, 8) * 3));
}

function stageClass(stage: Stage) { return `stage stage-${stage.toLowerCase()}`; }

export default function Home() {
  const [candidates, setCandidates] = useState(seed);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [active, setActive] = useState<Candidate | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", role: "", email: "", source: "Direct", resume: "" });

  const visible = useMemo(() => candidates.filter((c) => {
    const words = `${c.name} ${c.role} ${c.department} ${c.skills.join(" ")}`.toLowerCase();
    return words.includes(search.toLowerCase()) && (stageFilter === "All" || c.stage === stageFilter);
  }), [candidates, search, stageFilter]);
  const counts = stages.map((stage) => ({ stage, count: candidates.filter((c) => c.stage === stage).length }));

  function updateStage(id: number, stage: Stage) {
    setCandidates((current) => current.map((c) => c.id === id ? { ...c, stage, updated: "Just now" } : c));
    setActive((current) => current?.id === id ? { ...current, stage, updated: "Just now" } : current);
  }

  function addCandidate() {
    if (!form.name.trim() || !form.role.trim()) { setNotice("Add a name and role to create the candidate."); return; }
    const inferredSkills = jobKeywords.filter((word) => form.resume.toLowerCase().includes(word));
    const role = form.role.toLowerCase();
    const department = role.includes("design") ? "Design" : role.includes("market") || role.includes("growth") ? "Marketing" : role.includes("sales") ? "Sales" : "Engineering";
    const candidate: Candidate = { id: Date.now(), name: form.name.trim(), role: form.role.trim(), department, source: form.source, stage: "New", score: scoreResume(`${form.role} ${form.resume}`), email: form.email.trim(), phone: "", experience: "Not provided", skills: inferredSkills.length ? inferredSkills.map((s) => s[0].toUpperCase() + s.slice(1)) : ["Resume to review"], updated: "Just now" };
    setCandidates((current) => [candidate, ...current]); setForm({ name: "", role: "", email: "", source: "Direct", resume: "" }); setShowAdd(false); setNotice(`${candidate.name} was added with a ${candidate.score}% match signal.`);
  }

  function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
      const headers = (lines.shift() ?? "").split(",").map((h) => h.trim().toLowerCase());
      const created = lines.slice(0, 100).map((line, index) => {
        const cells = line.split(",").map((cell) => cell.trim()); const get = (name: string) => cells[headers.indexOf(name)] ?? "";
        const role = get("role") || get("job title") || "Candidate";
        return { id: Date.now() + index, name: get("name") || `Imported candidate ${index + 1}`, role, department: get("department") || "General", source: get("source") || "CSV import", stage: "New" as Stage, score: scoreResume(`${role} ${get("skills")} ${get("resume")}`), email: get("email"), phone: get("phone"), experience: get("experience") || "Not provided", skills: (get("skills") || "Resume to review").split(";").map((s) => s.trim()), updated: "Just now" };
      });
      setCandidates((current) => [...created, ...current]); setNotice(`${created.length} candidate${created.length === 1 ? "" : "s"} imported. Please review each match signal.`);
    };
    reader.readAsText(file); event.target.value = "";
  }

  function downloadCsv() {
    const rows = [["Name", "Role", "Department", "Source", "Stage", "Match signal", "Email", "Skills"], ...candidates.map((c) => [c.name, c.role, c.department, c.source, c.stage, `${c.score}%`, c.email, c.skills.join("; ")])];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = "applicant-tracker-export.csv"; anchor.click(); URL.revokeObjectURL(anchor.href);
  }

  return <main>
    <nav><div className="brand"><span className="brand-mark">a</span><span>Applicant<span className="muted">track</span></span></div><div className="nav-actions"><button className="text-button" onClick={downloadCsv}>Export CSV</button><label className="import-button">Import CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label><button className="primary" onClick={() => setShowAdd(true)}>+ Add candidate</button></div></nav>
    <section className="hero"><div><p className="eyebrow">HIRING WORKSPACE</p><h1>Make every review<br/><em>count.</em></h1><p className="hero-copy">A calm, focused home for your applicant pipeline—so good candidates never slip through the cracks.</p></div><div className="hero-note"><span>◌</span><p>Match signals are based on job-related keywords only. Always use your own fair, lawful review process.</p></div></section>
    <section className="metrics"><div><span>ALL CANDIDATES</span><strong>{candidates.length}</strong><small>in your workspace</small></div><div><span>READY TO REVIEW</span><strong>{candidates.filter((c) => c.stage === "New" || c.stage === "Review").length}</strong><small>new or in review</small></div><div><span>IN MOTION</span><strong>{candidates.filter((c) => c.stage === "Contacted" || c.stage === "Interview").length}</strong><small>contacted or interviewing</small></div><div><span>AVERAGE SIGNAL</span><strong>{Math.round(candidates.reduce((sum, c) => sum + c.score, 0) / candidates.length)}%</strong><small>job-related match</small></div></section>
    <section className="workspace"><aside><p className="eyebrow">PIPELINE</p><button className={stageFilter === "All" ? "filter active" : "filter"} onClick={() => setStageFilter("All")}>All candidates <span>{candidates.length}</span></button>{counts.map(({ stage, count }) => <button key={stage} className={stageFilter === stage ? "filter active" : "filter"} onClick={() => setStageFilter(stage)}><i className={`dot dot-${stage.toLowerCase()}`}/>{stage}<span>{count}</span></button>)}<hr/><p className="side-note">Tip: import a CSV with columns like Name, Role, Email, Skills, and Source.</p></aside>
      <div className="list"><div className="list-top"><div><p className="eyebrow">CANDIDATES</p><h2>{stageFilter === "All" ? "Everyone" : stageFilter}</h2></div><label className="search">⌕ <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search candidates" /></label></div>{notice && <div className="notice">{notice}<button onClick={() => setNotice("")}>×</button></div>}<div className="table-head"><span>Candidate</span><span>Stage</span><span>Match signal</span><span/></div><div className="rows">{visible.map((c) => <article className="candidate" key={c.id} onClick={() => setActive(c)}><div className="person"><div className="avatar">{c.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</div><div><b>{c.name}</b><p>{c.role} · {c.department}</p></div></div><div><span className={stageClass(c.stage)}>{c.stage}</span><p className="source">{c.source}</p></div><div className="score"><b>{c.score}%</b><div><i style={{ width: `${c.score}%` }}/></div></div><button className="row-open" aria-label={`Open ${c.name}`}>→</button></article>)}{visible.length === 0 && <div className="empty">No candidates match that search yet.</div>}</div></div>
    </section>
    {showAdd && <div className="modal-backdrop"><section className="modal"><button className="close" onClick={() => setShowAdd(false)}>×</button><p className="eyebrow">NEW CANDIDATE</p><h2>Add a candidate</h2><p>Paste job-related resume notes to create a transparent match signal.</p><div className="form-grid"><label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></label><label>Role<input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Frontend Engineer" /></label><label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" /></label><label>Source<select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}><option>Direct</option><option>LinkedIn</option><option>Indeed</option><option>Referral</option><option>Portfolio</option></select></label></div><label>Job-related resume notes<textarea value={form.resume} onChange={(e) => setForm({ ...form, resume: e.target.value })} placeholder="Skills, relevant experience, and role-specific work…" /></label><div className="modal-footer"><span>Signal preview: <b>{scoreResume(`${form.role} ${form.resume}`)}%</b></span><button className="primary" onClick={addCandidate}>Add to pipeline</button></div></section></div>}
    {active && <div className="drawer-backdrop" onClick={() => setActive(null)}><aside className="drawer" onClick={(e) => e.stopPropagation()}><button className="close" onClick={() => setActive(null)}>×</button><div className="drawer-person"><div className="avatar large">{active.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</div><div><p className="eyebrow">CANDIDATE PROFILE</p><h2>{active.name}</h2><p>{active.role}</p></div></div><div className="signal"><span>JOB-RELATED MATCH SIGNAL</span><strong>{active.score}%</strong><p>Based on role keywords and the information provided. Review the actual application before acting.</p></div><div className="drawer-section"><p className="eyebrow">SKILLS &amp; CONTEXT</p><div className="chips">{active.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><dl><div><dt>Experience</dt><dd>{active.experience}</dd></div><div><dt>Source</dt><dd>{active.source}</dd></div><div><dt>Email</dt><dd>{active.email || "Not provided"}</dd></div></dl></div><div className="drawer-section"><p className="eyebrow">PIPELINE STAGE</p><select className="stage-select" value={active.stage} onChange={(e) => updateStage(active.id, e.target.value as Stage)}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></div><div className="outreach"><p className="eyebrow">FOLLOW-UP DRAFT</p><p>Hi {active.name.split(" ")[0]},<br/><br/>Thanks for your interest in the {active.role} role. We’d love to learn more about your experience. Would you be open to a short conversation?</p><button onClick={() => { navigator.clipboard?.writeText(`Hi ${active.name.split(" ")[0]},\n\nThanks for your interest in the ${active.role} role. We’d love to learn more about your experience. Would you be open to a short conversation?`); setNotice("Follow-up draft copied."); }}>Copy draft</button></div></aside></div>}
  </main>;
}
