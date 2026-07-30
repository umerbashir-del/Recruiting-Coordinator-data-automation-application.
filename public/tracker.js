const $ = (selector) => document.querySelector(selector);
const keywords = ["react", "typescript", "javascript", "python", "sql", "figma", "salesforce", "seo", "analytics", "design", "api", "product", "marketing"];
const nextSteps = { "resume-reviewed": { label: "Resume reviewed", instruction: "Email applicant within 48 hours." }, "interview-needed": { label: "Interview needed", instruction: "Schedule interview within 72 hours." }, "decision-made": { label: "Decision is made", instruction: "Within 24 hours, notify applicant of the final decision." } };
const fieldAliases = {
  name: ["name", "applicant name", "full name", "employee name", "employee_name", "employee", "employee full name"],
  role: ["role", "job title", "position", "applied position", "job position", "employee position", "title", "jobrole"],
  skills: ["skills", "job skills", "technical skills", "qualifications", "competencies", "special projects"],
  experience: ["experience", "years experience", "work experience", "career experience"], resume: ["resume", "resume text", "notes", "summary", "candidate summary", "comments"],
  department: ["department", "dept", "division"], status: ["employment status", "status", "employee status"], performance: ["performance score", "performance", "review score"], performanceId: ["perf score id", "performance score id", "review score id"], jobFitScore: ["job fit score", "human job fit score", "human review score", "reviewer score"],
  engagement: ["engagement survey", "engagement"], satisfaction: ["employee satisfaction", "satisfaction"], projects: ["special projects count", "project count", "special projects"],
  source: ["recruitment source", "source", "application source"], hireDate: ["date of hire", "hire date", "dateofhire"], terminationDate: ["date of termination", "termination date", "dateoftermination"], terminationReason: ["term reason", "termination reason"],
  race: ["race", "race description", "race desc", "ethnicity"], gender: ["gender", "sex", "gender identity", "sex description"], dob: ["dob", "date of birth", "birth date"], marital: ["marital status", "marital desc"], zip: ["zip", "zip code", "zipcode"], citizen: ["citizen desc", "citizenship", "citizen"], employeeId: ["emp id", "employee id", "empid"]
};
let applicants = [];
let currentFileType = "applicant";
const escapeText = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const normalizeHeader = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const matchesFor = (applicant) => keywords.filter((word) => `${applicant.role} ${applicant.skills} ${applicant.experience} ${applicant.resume}`.toLowerCase().includes(word));

function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) { if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; } else if (character === '"') quoted = false; else cell += character; continue; }
    if (character === '"') quoted = true;
    else if (character === ",") { row.push(cell.trim()); cell = ""; }
    else if (character === "\n") { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
    else if (character !== "\r") cell += character;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); return rows;
}

function readField(cells, headers, aliases) { const index = aliases.map(normalizeHeader).map((name) => headers.indexOf(name)).find((value) => value >= 0); return index === undefined ? "" : String(cells[index] || "").trim(); }

function renderScanSummary(headers, mapped, rowCount) {
  const summary = $("#scanSummary"); const missing = ["name", "role"].filter((field) => !mapped[field]);
  const sensitive = ["race", "gender", "dob", "marital", "zip", "citizen", "employeeId"].filter((field) => mapped[field]);
  const employeeHistory = Boolean(mapped.status || mapped.performance || mapped.hireDate || mapped.terminationDate);
  currentFileType = employeeHistory ? "employee-history" : "applicant";
  summary.hidden = false;
  summary.innerHTML = `<p class="eyebrow">FILE SCAN</p><h2>${employeeHistory ? "Employee-history CSV detected" : "Applicant CSV detected"}</h2><p>${rowCount} record${rowCount === 1 ? "" : "s"} found. Recognized fields: <b>${Object.keys(mapped).filter((field) => mapped[field] && !["race", "gender", "dob", "marital", "zip", "citizen", "employeeId"].includes(field)).map((field) => escapeText(field.replace(/([A-Z])/g, " $1"))).join(", ") || "none"}</b>.</p>${missing.length ? `<p class="scan-warning">Missing required field: ${missing.join(" and ")}. The tracker will show a placeholder until a matching column is added.</p>` : ""}${sensitive.length ? `<p class="scan-note">Sensitive columns detected and excluded from recommendations and text exports: ${sensitive.join(", ")}.</p>` : ""}${employeeHistory ? '<p class="scan-note">This looks like employee history, not a résumé file. It is shown for record review and should not be used to automatically make hiring decisions.</p>' : ""}`;
}

const departmentPalette = ["#2f7967", "#597fb8", "#a76784", "#af7b35", "#6c67ab", "#a75e4d", "#3e8b98"];
function departmentColor(department) { return departmentPalette[Array.from(String(department || "Other")).reduce((total, character) => total + character.charCodeAt(0), 0) % departmentPalette.length]; }
const departmentPages = { "Admin Offices": "admin-offices.html", "Executive Office": "executive-office.html", "IT/IS": "it-is.html", "Production": "production.html", "Sales": "sales.html", "Software Engineering": "software-engineering.html" };
function departmentUrl(department) { return departmentPages[department] || `department.html?name=${encodeURIComponent(department)}`; }
function saveDepartmentView() { const savedApplicants = applicants.map(({ name, role, department, performance, performanceId, jobFitScore, nextStep, skills, experience, resume, status, source, hireDate }) => ({ name, role, department, performance, performanceId, jobFitScore, nextStep, skills, experience, resume, status, source, hireDate })); sessionStorage.setItem("applicant-reviewer-department-view", JSON.stringify(savedApplicants)); sessionStorage.setItem("applicant-reviewer-dashboard-view", JSON.stringify(savedApplicants)); sessionStorage.setItem("applicant-reviewer-file-type", currentFileType); }
function informationCoverage(applicant) { return [applicant.role, applicant.skills, applicant.experience, applicant.resume].filter(Boolean).length / 4; }
function renderDashboard() {
  const dashboard = $("#dashboard"); if (!applicants.length) { dashboard.hidden = true; return; }
  const counts = Object.fromEntries(Object.keys(nextSteps).map((key) => [key, applicants.filter((applicant) => applicant.nextStep === key).length]));
  const undecided = applicants.filter((applicant) => !applicant.nextStep).length;
  const departments = applicants.reduce((groups, applicant) => { const department = applicant.department || "No department listed"; groups[department] = (groups[department] || 0) + 1; return groups; }, {});
  dashboard.hidden = false;
  dashboard.innerHTML = `<p class="eyebrow">Summary:</p><div class="summary-grid"><div class="metric"><span>RECORDS</span><b>${applicants.length}</b><small>loaded from this file</small></div><div class="metric"><span>STEPS LEFT TO CHOOSE</span><b>${undecided}</b><small>awaiting a person’s selection</small></div><div class="metric"><span>SELECTED ACTIONS</span><b>${counts["resume-reviewed"] + counts["interview-needed"] + counts["decision-made"]}</b><small>${counts["resume-reviewed"]} reviewed · ${counts["interview-needed"]} interview · ${counts["decision-made"]} decision</small></div></div><div class="department-summary"><p class="eyebrow">Records by department:</p><div class="department-tags">${Object.entries(departments).sort((a, b) => b[1] - a[1]).map(([department, count]) => `<a href="${departmentUrl(department)}" style="--department-color:${departmentColor(department)}" title="Open ${escapeText(department)} applicants"><i></i>${escapeText(department)} <b>${count}</b></a>`).join("")}</div></div>`;
}

function renderList() {
  const list = $("#applicantList");
  if (!applicants.length) { list.innerHTML = '<p class="empty">No records were found in this CSV.</p>'; return; }
  const queues = new Map();
  applicants.forEach((applicant, index) => { const department = applicant.department || "No department listed"; if (!queues.has(department)) queues.set(department, []); queues.get(department).push({ applicant, index }); });
  const departmentOrder = [...queues.keys()].sort((first, second) => queues.get(second).length - queues.get(first).length);
  const distributed = [];
  while (departmentOrder.some((department) => queues.get(department).length)) departmentOrder.forEach((department) => { const next = queues.get(department).shift(); if (next) distributed.push(next); });
  list.innerHTML = distributed.map(({ applicant, index }) => `<button class="applicant" data-index="${index}" style="--department-color:${departmentColor(applicant.department)}"><span>${escapeText(applicant.name).split(" ").map((part) => part[0]).join("").slice(0, 2) || "?"}</span><div><b>${escapeText(applicant.name)}</b><small>${escapeText(applicant.role)} · ${escapeText(applicant.department || "No department")}</small></div></button>`).join("");
  list.querySelectorAll("button").forEach((button) => { button.onclick = () => showApplicant(applicants[Number(button.dataset.index)]); });
}

function showApplicant(applicant) {
  const matches = matchesFor(applicant); const employeeHistory = currentFileType === "employee-history";
  const recommendation = employeeHistory ? "Employee-history record — human review only" : matches.length >= 2 ? "Recommended for a human review" : "More job-related information is needed";
  const reason = employeeHistory ? "This record contains employment history. It can support workforce record review, but it is not a résumé-based hiring recommendation." : matches.length >= 2 ? `The CSV includes job-related terms such as ${matches.slice(0, 4).map((word) => `<code>${escapeText(word)}</code>`).join(", ")}.` : "The CSV does not yet include enough job-related skills or experience to form a useful review message.";
  const workHistory = [applicant.department && `Department: ${applicant.department}`, applicant.status && `Status: ${applicant.status}`, applicant.performance && `Performance: ${applicant.performance}`, applicant.source && `Source: ${applicant.source}`, applicant.hireDate && `Hire date: ${applicant.hireDate}`].filter(Boolean);
  const sensitive = [applicant.race && `Race: ${applicant.race}`, applicant.gender && `Gender: ${applicant.gender}`, applicant.dob && `Date of birth: ${applicant.dob}`, applicant.marital && `Marital status: ${applicant.marital}`].filter(Boolean);
  const details = workHistory.length ? `<details class="record-fields"><summary>Work record fields</summary>${workHistory.map((item) => `<p>${escapeText(item)}</p>`).join("")}</details>` : "";
  const sensitiveDetails = sensitive.length ? `<details class="record-fields"><summary>Record details — not used in review</summary>${sensitive.map((item) => `<p>${escapeText(item)}</p>`).join("")}</details>` : "";
  $("#result").innerHTML = `<p class="eyebrow">RECORD REVIEW</p><div class="badge">${recommendation}</div><h2>${escapeText(applicant.name)}</h2><p class="role">Position: <b>${escapeText(applicant.role)}</b></p><div class="message"><p><b>Message</b></p><p>${escapeText(applicant.name)} is listed for ${escapeText(applicant.role)}. ${reason}</p></div><label class="next-step">Next step<select id="nextStep"><option value="">Choose an option</option>${Object.entries(nextSteps).map(([key, step]) => `<option value="${key}" ${applicant.nextStep === key ? "selected" : ""}>${step.label}</option>`).join("")}</select></label><div class="action-message" id="actionMessage">${applicant.nextStep ? escapeText(nextSteps[applicant.nextStep].instruction) : "Choose a next step to add it to the text file."}</div>${details}${sensitiveDetails}<p class="note">Next steps are selected by a person. Sensitive details are not used in recommendations or text exports.</p>`;
  $("#nextStep").onchange = (event) => { applicant.nextStep = event.target.value; $("#actionMessage").textContent = applicant.nextStep ? nextSteps[applicant.nextStep].instruction : "Choose a next step to add it to the text file."; saveDepartmentView(); sessionStorage.setItem("applicant-reviewer-returning", "true"); window.location.reload(); };
}

function loadCsv(file) {
  if (!file || !file.name.toLowerCase().endsWith(".csv")) { $("#result").innerHTML = '<p class="eyebrow">CSV NEEDED</p><h2>Please choose a CSV file</h2><p>Drag a CSV, ZIP, or folder onto the upload area, or click Choose CSV.</p>'; return Promise.resolve(false); }
  return new Promise((resolve) => { const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(String(reader.result)); if (!rows.length) return;
    const headers = rows[0].map(normalizeHeader); const mapped = Object.fromEntries(Object.entries(fieldAliases).map(([field, aliases]) => [field, aliases.map(normalizeHeader).find((name) => headers.includes(name)) || ""]));
    applicants = rows.slice(1, 201).map((cells) => { const record = {}; Object.entries(fieldAliases).forEach(([field, aliases]) => { record[field] = readField(cells, headers, aliases); }); record.nextStep = ""; return record; });
    applicants.forEach((applicant) => { if (!applicant.name) applicant.name = "Unnamed record"; if (!applicant.role) applicant.role = "Position not provided"; });
    saveDepartmentView(); renderScanSummary(headers, mapped, applicants.length); renderList(); renderDashboard(); $("#downloadText").disabled = applicants.length === 0;
    $("#result").innerHTML = `<p class="eyebrow">CSV LOADED</p><h2>${applicants.length} record${applicants.length === 1 ? "" : "s"} found</h2><p>Select a record on the left to review its recognized job-related information and choose the next step.</p>`; resolve(true);
  };
  reader.onerror = () => resolve(false); reader.readAsText(file); });
}

async function loadZip(file) { if (!window.JSZip) { $("#result").innerHTML = '<p class="eyebrow">ZIP SUPPORT</p><h2>ZIP support is loading</h2><p>Please try the ZIP again in a moment.</p>'; return; } const zip = await JSZip.loadAsync(file); const csvEntry = Object.values(zip.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".csv")); if (!csvEntry) { $("#result").innerHTML = '<p class="eyebrow">NO CSV FOUND</p><h2>This ZIP has no CSV file</h2><p>Please choose a ZIP that contains a CSV file.</p>'; return; } loadCsv(new File([await csvEntry.async("blob")], csvEntry.name, { type: "text/csv" })); }
function loadItem(file) { if (!file) return; if (file.name.toLowerCase().endsWith(".zip")) { loadZip(file); return; } loadCsv(file); }

$("#csvInput").onchange = (event) => { loadItem(event.target.files?.[0]); event.target.value = ""; };
const uploadZone = $("#uploadZone"); const dropHint = $("#dropHint");
function filesFromEntry(entry) { if (entry.isFile) return new Promise((resolve) => entry.file((file) => resolve([file]), () => resolve([]))); return new Promise((resolve) => { const reader = entry.createReader(); const entries = []; const readBatch = () => reader.readEntries(async (batch) => { if (batch.length) { entries.push(...batch); readBatch(); return; } resolve((await Promise.all(entries.map(filesFromEntry))).flat()); }, () => resolve([])); readBatch(); }); }
[uploadZone, dropHint].forEach((zone) => { ["dragenter", "dragover"].forEach((eventName) => zone.addEventListener(eventName, (event) => { event.preventDefault(); zone.classList.add("dragging"); })); ["dragleave", "drop"].forEach((eventName) => zone.addEventListener(eventName, (event) => { event.preventDefault(); zone.classList.remove("dragging"); })); zone.addEventListener("drop", async (event) => { const entries = Array.from(event.dataTransfer.items || []).map((item) => item.webkitGetAsEntry?.()).filter(Boolean); const files = entries.length ? (await Promise.all(entries.map(filesFromEntry))).flat() : Array.from(event.dataTransfer.files || []); loadItem(files.find((file) => /\.(csv|zip)$/i.test(file.name))); }); });
function downloadTextFile() { const missingNextSteps = applicants.filter((applicant) => !applicant.nextStep); if (missingNextSteps.length) { window.alert(`No entry for next step. Select a next step for all ${missingNextSteps.length} applicant${missingNextSteps.length === 1 ? "" : "s"} before downloading.`); return; } const departments = [...new Set(applicants.map((applicant) => applicant.department || "No department listed"))].sort((first, second) => first.localeCompare(second)); const lines = ["APPLICANT NEXT STEPS BY DEPARTMENT", ""]; departments.forEach((department) => { lines.push(`Department: ${department}`, ""); applicants.filter((applicant) => (applicant.department || "No department listed") === department).sort((first, second) => first.name.localeCompare(second.name)).forEach((applicant) => { const step = nextSteps[applicant.nextStep]; lines.push(`Name: ${applicant.name}`, `Position: ${applicant.role}`, `Next step: ${step.label}`, `Instruction: ${step.instruction}`, ""); }); }); const blob = new Blob([lines.join("\n")], { type: "text/plain" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "applicant-next-steps-by-department.txt"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000); }
$("#downloadText").onclick = downloadTextFile;
$("#runTest").onclick = async () => { $("#result").innerHTML = '<p class="eyebrow">TEST RUN</p><h2>Loading included test CSV…</h2>'; const response = await fetch("/test-data/HRDataset_v14.csv"); if (!response.ok || !(await loadCsv(new File([await response.blob()], "HRDataset_v14.csv", { type: "text/csv" })))) return; const choices = Object.keys(nextSteps); applicants.forEach((applicant) => { applicant.nextStep = choices[Math.floor(Math.random() * choices.length)]; }); saveDepartmentView(); renderDashboard(); };
$("#refreshPage").onclick = () => { sessionStorage.removeItem("applicant-reviewer-dashboard-view"); sessionStorage.removeItem("applicant-reviewer-department-view"); sessionStorage.removeItem("applicant-reviewer-file-type"); window.location.reload(); };
function restoreDashboardView() {
  try {
    const returningFromDepartment = sessionStorage.getItem("applicant-reviewer-returning") === "true" || new URLSearchParams(window.location.search).get("return") === "populated";
    if (!returningFromDepartment) { sessionStorage.removeItem("applicant-reviewer-dashboard-view"); sessionStorage.removeItem("applicant-reviewer-department-view"); sessionStorage.removeItem("applicant-reviewer-file-type"); return; }
    sessionStorage.removeItem("applicant-reviewer-returning");
    if (new URLSearchParams(window.location.search).get("return") === "populated") window.history.replaceState({}, "", "tracker.html");
    const savedApplicants = JSON.parse(sessionStorage.getItem("applicant-reviewer-dashboard-view") || "[]");
    if (!Array.isArray(savedApplicants) || !savedApplicants.length) return;
    applicants = savedApplicants;
    currentFileType = sessionStorage.getItem("applicant-reviewer-file-type") || "applicant";
    renderList(); renderDashboard(); $("#downloadText").disabled = false;
    $("#result").innerHTML = `<p class="eyebrow">CSV RESTORED</p><h2>${applicants.length} record${applicants.length === 1 ? "" : "s"} available</h2><p>Your loaded applicant list is still available for this browser session. Select an applicant to continue reviewing.</p>`;
  } catch { sessionStorage.removeItem("applicant-reviewer-dashboard-view"); }
}
restoreDashboardView();
const savedTheme = localStorage.getItem("applicant-tracker-theme"); if (savedTheme === "night") document.body.classList.add("night");
function updateThemeButton() { const night = document.body.classList.contains("night"); $("#themeToggle").textContent = night ? "☀ Day" : "☾ Night"; $("#themeToggle").setAttribute("aria-label", night ? "Switch to day mode" : "Switch to night mode"); }
$("#themeToggle").onclick = () => { document.body.classList.toggle("night"); document.documentElement.classList.toggle("night", document.body.classList.contains("night")); localStorage.setItem("applicant-tracker-theme", document.body.classList.contains("night") ? "night" : "day"); updateThemeButton(); };
updateThemeButton();
