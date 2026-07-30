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
let selectedRecordIndex = null;
let lastSelectionAnchor = null;
let visibleRecordIndexes = [];
const selectedRecordIndexes = new Set();
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
function saveDepartmentView() { const savedApplicants = applicants.map(({ name, role, department, performance, performanceId, jobFitScore, nextStep, skills, experience, resume, status, source, hireDate, fileDetails }) => ({ name, role, department, performance, performanceId, jobFitScore, nextStep, skills, experience, resume, status, source, hireDate, fileDetails })); sessionStorage.setItem("applicant-reviewer-department-view", JSON.stringify(savedApplicants)); sessionStorage.setItem("applicant-reviewer-dashboard-view", JSON.stringify(savedApplicants)); sessionStorage.setItem("applicant-reviewer-file-type", currentFileType); }
function informationCoverage(applicant) { return [applicant.role, applicant.skills, applicant.experience, applicant.resume].filter(Boolean).length / 4; }
function statusFor(applicant) { return applicant.nextStep ? nextSteps[applicant.nextStep].label : "Not reviewed"; }
function renderEmptyReview() {
  const completed = applicants.filter((applicant) => applicant.nextStep).length;
  const departmentCount = new Set(applicants.map((applicant) => applicant.department || "No department listed")).size;
  $("#result").innerHTML = applicants.length
    ? `<p class="eyebrow">READY TO REVIEW</p><h2>Select a record</h2><p>Choose a record on the left to view its information and select its next step yourself.</p><div class="empty-overview"><div><b>${applicants.length}</b><span>records loaded</span></div><div><b>${completed}</b><span>reviewed</span></div><div><b>${departmentCount}</b><span>departments</span></div></div><p class="note">Tip: use ↑ and ↓ to move through the list, or / to search.</p>`
    : `<p class="eyebrow">RECORD REVIEW</p><h2>Choose a record</h2><p>Select a record on the left to view its information and choose the next step yourself.</p><p class="note">Tip: use ↑ and ↓ to move through the list, or / to search.</p>`;
}
function renderDashboard() {
  const dashboard = $("#dashboard"); if (!applicants.length) { dashboard.hidden = true; return; }
  const counts = Object.fromEntries(Object.keys(nextSteps).map((key) => [key, applicants.filter((applicant) => applicant.nextStep === key).length]));
  const undecided = applicants.filter((applicant) => !applicant.nextStep).length;
  const departments = applicants.reduce((groups, applicant) => { const department = applicant.department || "No department listed"; groups[department] = (groups[department] || 0) + 1; return groups; }, {});
  dashboard.hidden = false;
  dashboard.innerHTML = `<p class="eyebrow">Summary:</p><div class="summary-grid"><div class="metric"><span>RECORDS</span><b>${applicants.length}</b><small>loaded from this file</small></div><div class="metric"><span>STEPS LEFT TO CHOOSE</span><b>${undecided}</b><small>awaiting a person’s selection</small></div><div class="metric"><span>SELECTED ACTIONS</span><b>${counts["resume-reviewed"] + counts["interview-needed"] + counts["decision-made"]}</b><small>${counts["resume-reviewed"]} reviewed · ${counts["interview-needed"]} interview · ${counts["decision-made"]} decision</small></div></div><div class="department-summary"><p class="eyebrow">Records by department:</p><div class="department-tags">${Object.entries(departments).sort((a, b) => b[1] - a[1]).map(([department, count]) => `<a href="${departmentUrl(department)}" style="--department-color:${departmentColor(department)}" title="Open ${escapeText(department)} applicants"><i></i>${escapeText(department)} <b>${count}</b></a>`).join("")}</div></div>`;
}

function missingFields(applicant) { return ["role", "skills", "experience", "resume"].filter((field) => !String(applicant[field] || "").trim()); }
function renderLegacyDashboard() {
  const dashboard = $("#dashboard"); if (!applicants.length) { dashboard.hidden = true; return; }
  const counts = Object.fromEntries(Object.keys(nextSteps).map((key) => [key, applicants.filter((applicant) => applicant.nextStep === key).length]));
  const undecided = applicants.filter((applicant) => !applicant.nextStep).length;
  const completed = applicants.length - undecided;
  const progress = Math.round((completed / applicants.length) * 100);
  const departments = applicants.reduce((groups, applicant) => { const department = applicant.department || "No department listed"; groups[department] = (groups[department] || 0) + 1; return groups; }, {});
  dashboard.hidden = false;
  dashboard.innerHTML = `<p class="eyebrow">Summary:</p><div class="summary-grid"><div class="metric"><span>RECORDS</span><b>${applicants.length}</b><small>loaded from this file</small></div><div class="metric"><span>STEPS LEFT TO CHOOSE</span><b>${undecided}</b><small>awaiting a person’s selection</small></div><div class="metric"><span>SELECTED ACTIONS</span><b>${completed}</b><small>${counts["resume-reviewed"]} reviewed · ${counts["interview-needed"]} interview · ${counts["decision-made"]} decision</small></div></div><section class="review-progress" aria-label="Review progress"><div><b>Review progress</b><span>${completed} of ${applicants.length} records have a human-selected next step</span></div><div class="progress-track" aria-hidden="true"><i style="width:${progress}%"></i></div><small>${progress}% complete</small></section><div class="department-summary"><p class="eyebrow">Records by department:</p><div class="department-tags">${Object.entries(departments).sort((a, b) => b[1] - a[1]).map(([department, count]) => `<a href="${departmentUrl(department)}" style="--department-color:${departmentColor(department)}" title="Open ${escapeText(department)} records"><i></i>${escapeText(department)} <b>${count}</b></a>`).join("")}</div></div>`;
}
function filteredApplicants() {
  const query = $("#applicantSearch").value.trim().toLowerCase(); const department = $("#departmentFilter").value; const step = $("#stepFilter").value; const needsInformation = $("#missingOnly").checked;
  return applicants.map((applicant, index) => ({ applicant, index })).filter(({ applicant }) => {
    const searchable = `${applicant.name} ${applicant.role} ${applicant.department}`.toLowerCase();
    return (!query || searchable.includes(query)) && (!department || applicant.department === department) && (!step || (step === "unassigned" ? !applicant.nextStep : applicant.nextStep === step)) && (!needsInformation || missingFields(applicant).length);
  });
}
function populateDepartmentFilter() {
  const filter = $("#departmentFilter"); const selected = filter.value; const departments = [...new Set(applicants.map((applicant) => applicant.department || "No department listed"))].sort((a, b) => a.localeCompare(b));
  filter.innerHTML = `<option value="">All departments</option>${departments.map((department) => `<option value="${escapeText(department)}">${escapeText(department)}</option>`).join("")}`; filter.value = departments.includes(selected) ? selected : "";
}
function renderLegacyList() {
  const list = $("#applicantList"); const count = $("#listCount");
  if (!applicants.length) { list.innerHTML = '<p class="empty">No records were found in this CSV.</p>'; count.textContent = "No records loaded."; return; }
  const visible = filteredApplicants(); count.textContent = `${visible.length} of ${applicants.length} record${applicants.length === 1 ? "" : "s"} shown`;
  if (!visible.length) { list.innerHTML = '<p class="empty">No records match these options.</p>'; return; }
  const sort = $("#sortFilter").value; let distributed;
  if (sort === "name") distributed = [...visible].sort((first, second) => first.applicant.name.localeCompare(second.applicant.name));
  else if (sort === "department") distributed = [...visible].sort((first, second) => `${first.applicant.department} ${first.applicant.name}`.localeCompare(`${second.applicant.department} ${second.applicant.name}`));
  else if (sort === "step") distributed = [...visible].sort((first, second) => `${first.applicant.nextStep || "0"} ${first.applicant.name}`.localeCompare(`${second.applicant.nextStep || "0"} ${second.applicant.name}`));
  else { const queues = new Map(); visible.forEach(({ applicant, index }) => { const department = applicant.department || "No department listed"; if (!queues.has(department)) queues.set(department, []); queues.get(department).push({ applicant, index }); }); const departmentOrder = [...queues.keys()].sort((first, second) => queues.get(second).length - queues.get(first).length); distributed = []; while (departmentOrder.some((department) => queues.get(department).length)) departmentOrder.forEach((department) => { const next = queues.get(department).shift(); if (next) distributed.push(next); }); }
  list.innerHTML = distributed.map(({ applicant, index }) => `<button class="applicant" data-index="${index}" style="--department-color:${departmentColor(applicant.department)}"><span>${escapeText(applicant.name).split(" ").map((part) => part[0]).join("").slice(0, 2) || "?"}</span><div><b>${escapeText(applicant.name)}</b><small>${escapeText(applicant.role)} · ${escapeText(applicant.department || "No department")}</small></div></button>`).join("");
  list.querySelectorAll("button").forEach((button) => { button.onclick = () => { list.querySelectorAll("button").forEach((item) => item.classList.remove("is-selected")); button.classList.add("is-selected"); showApplicant(applicants[Number(button.dataset.index)]); }; });
}

function updateBatchBar() {
  const count = selectedRecordIndexes.size;
  $("#batchBar").hidden = count === 0;
  $("#batchCount").textContent = count;
  $("#selectionHint").textContent = count ? `${count} selected` : "For review or export";
  $("#selectVisible").textContent = visibleRecordIndexes.length && visibleRecordIndexes.every((index) => selectedRecordIndexes.has(index)) ? "Clear shown" : "Select shown";
}
function selectRecord(index, focus = false) {
  selectedRecordIndex = index;
  renderList();
  showApplicant(applicants[index]);
  if (focus) document.querySelector(`.applicant[data-index="${index}"]`)?.focus();
}
function renderList() {
  const list = $("#applicantList"); const count = $("#listCount");
  if (!applicants.length) { list.innerHTML = '<p class="empty">No records were found in this CSV.</p>'; count.textContent = "No records loaded."; visibleRecordIndexes = []; updateBatchBar(); return; }
  const visible = filteredApplicants(); count.textContent = `${visible.length} of ${applicants.length} record${applicants.length === 1 ? "" : "s"} shown`;
  if (!visible.length) { list.innerHTML = '<p class="empty">No records match these options.</p>'; visibleRecordIndexes = []; updateBatchBar(); return; }
  const sort = $("#sortFilter").value; let distributed;
  if (sort === "name") distributed = [...visible].sort((first, second) => first.applicant.name.localeCompare(second.applicant.name));
  else if (sort === "department") distributed = [...visible].sort((first, second) => `${first.applicant.department} ${first.applicant.name}`.localeCompare(`${second.applicant.department} ${second.applicant.name}`));
  else if (sort === "step") distributed = [...visible].sort((first, second) => `${first.applicant.nextStep || "0"} ${first.applicant.name}`.localeCompare(`${second.applicant.nextStep || "0"} ${second.applicant.name}`));
  else { const queues = new Map(); visible.forEach(({ applicant, index }) => { const department = applicant.department || "No department listed"; if (!queues.has(department)) queues.set(department, []); queues.get(department).push({ applicant, index }); }); const departmentOrder = [...queues.keys()].sort((first, second) => queues.get(second).length - queues.get(first).length); distributed = []; while (departmentOrder.some((department) => queues.get(department).length)) departmentOrder.forEach((department) => { const next = queues.get(department).shift(); if (next) distributed.push(next); }); }
  visibleRecordIndexes = distributed.map(({ index }) => index);
  list.innerHTML = distributed.map(({ applicant, index }) => `<article class="applicant ${selectedRecordIndex === index ? "is-selected" : ""}" data-index="${index}" style="--department-color:${departmentColor(applicant.department)}"><label class="record-select"><input type="checkbox" data-select-index="${index}" ${selectedRecordIndexes.has(index) ? "checked" : ""} aria-label="Select ${escapeText(applicant.name)}"></label><button type="button" class="applicant-open" aria-label="Review ${escapeText(applicant.name)}"><span>${escapeText(applicant.name).split(" ").map((part) => part[0]).join("").slice(0, 2) || "?"}</span><div><b>${escapeText(applicant.name)}</b><small>${escapeText(applicant.role)} · ${escapeText(applicant.department || "No department")}</small><em class="status-badge ${applicant.nextStep || "unassigned"}">${escapeText(statusFor(applicant))}</em></div></button></article>`).join("");
  list.querySelectorAll(".applicant-open").forEach((button) => { button.onclick = () => selectRecord(Number(button.closest(".applicant").dataset.index)); });
  list.querySelectorAll(".record-select input").forEach((checkbox) => { checkbox.onclick = (event) => { checkbox.dataset.shiftSelect = event.shiftKey ? "true" : ""; }; checkbox.onchange = (event) => { const index = Number(event.target.dataset.selectIndex); if (checkbox.dataset.shiftSelect === "true" && lastSelectionAnchor !== null) { const first = visibleRecordIndexes.indexOf(lastSelectionAnchor); const last = visibleRecordIndexes.indexOf(index); if (first >= 0 && last >= 0) visibleRecordIndexes.slice(Math.min(first, last), Math.max(first, last) + 1).forEach((item) => selectedRecordIndexes.add(item)); } else if (event.target.checked) selectedRecordIndexes.add(index); else selectedRecordIndexes.delete(index); lastSelectionAnchor = index; renderList(); }; });
  updateBatchBar();
}
function showApplicant(applicant) {
  const matches = matchesFor(applicant); const employeeHistory = currentFileType === "employee-history";
  const recommendation = employeeHistory ? "Employee-history record — human review only" : matches.length >= 2 ? "Recommended for a human review" : "More job-related information is needed";
  const reason = employeeHistory ? "This record contains employment history. It can support workforce record review, but it is not a résumé-based hiring recommendation." : matches.length >= 2 ? `The CSV includes job-related terms such as ${matches.slice(0, 4).map((word) => `<code>${escapeText(word)}</code>`).join(", ")}.` : "The CSV does not yet include enough job-related skills or experience to form a useful review message.";
  const workHistory = [applicant.department && `Department: ${applicant.department}`, applicant.status && `Status: ${applicant.status}`, applicant.performance && `Performance: ${applicant.performance}`, applicant.source && `Source: ${applicant.source}`, applicant.hireDate && `Hire date: ${applicant.hireDate}`].filter(Boolean);
  const sensitive = [applicant.race && `Race: ${applicant.race}`, applicant.gender && `Gender: ${applicant.gender}`, applicant.dob && `Date of birth: ${applicant.dob}`, applicant.marital && `Marital status: ${applicant.marital}`].filter(Boolean);
  const details = workHistory.length ? `<details class="record-fields"><summary>Details from this file</summary>${workHistory.map((item) => `<p>${escapeText(item)}</p>`).join("")}</details>` : "";
  const additionalFields = Object.entries(applicant.fileDetails || {}).filter(([header]) => !/(race|gender|sex|dob|birth|marital|zip|citizen|ethnicity|empid|employeeid)/.test(normalizeHeader(header))); const additionalDetails = additionalFields.length ? `<details class="record-fields all-file-fields"><summary>Additional fields from this file</summary>${additionalFields.map(([header, value]) => `<p><b>${escapeText(header)}:</b> ${escapeText(value)}</p>`).join("")}</details>` : "";
  const sensitiveDetails = sensitive.length ? `<details class="record-fields"><summary>Record details — not used in review</summary>${sensitive.map((item) => `<p>${escapeText(item)}</p>`).join("")}</details>` : "";
  $("#result").innerHTML = `<p class="eyebrow">RECORD REVIEW</p><div class="badge">${recommendation}</div><h2>${escapeText(applicant.name)}</h2><p class="role">Position: <b>${escapeText(applicant.role)}</b></p><div class="message"><p><b>Message</b></p><p>${escapeText(applicant.name)} is listed for ${escapeText(applicant.role)}. ${reason}</p></div><label class="next-step">What should happen next?<select id="nextStep"><option value="">Choose an option</option>${Object.entries(nextSteps).map(([key, step]) => `<option value="${key}" ${applicant.nextStep === key ? "selected" : ""}>${step.label}</option>`).join("")}</select></label><div class="action-message" id="actionMessage">${applicant.nextStep ? escapeText(nextSteps[applicant.nextStep].instruction) : "Choose a next step to add it to the text file."}</div>${details}${additionalDetails}${sensitiveDetails}<p class="note">Next steps are selected by a person. Sensitive details are not used in recommendations or text exports.</p>`;
  $("#nextStep").onchange = (event) => { applicant.nextStep = event.target.value; $("#actionMessage").textContent = applicant.nextStep ? nextSteps[applicant.nextStep].instruction : "Choose a next step to add it to the text file."; saveDepartmentView(); sessionStorage.setItem("applicant-reviewer-returning", "true"); window.location.reload(); };
  const checklist = document.createElement("section"); checklist.className = "review-checklist"; const missing = missingFields(applicant); checklist.innerHTML = `<p class="eyebrow">INFORMATION CHECK</p><p>${missing.length ? `Still needed: <b>${missing.map((field) => escapeText(field === "resume" ? "résumé" : field)).join(", ")}</b>.` : "Role, skills, experience, and résumé information are present."}</p>`; $("#nextStep").before(checklist);
  const removeButton = document.createElement("button"); removeButton.className = "remove-record"; removeButton.id = "removeRecord"; removeButton.type = "button"; removeButton.textContent = "Remove this record from this session"; $("#result").append(removeButton);
  $("#removeRecord").onclick = () => { if (!window.confirm(`Remove ${applicant.name} from this browser session?`)) return; applicants = applicants.filter((record) => record !== applicant); saveDepartmentView(); populateDepartmentFilter(); renderList(); renderDashboard(); $("#downloadText").disabled = applicants.length === 0; $("#result").innerHTML = '<p class="eyebrow">RECORD REMOVED</p><h2>Removed from this session</h2><p>The original uploaded file was not changed.</p>'; };
}

function loadCsv(file) {
  if (!file || !file.name.toLowerCase().endsWith(".csv")) { $("#result").innerHTML = '<p class="eyebrow">CSV NEEDED</p><h2>Please choose a CSV file</h2><p>Drag a CSV, ZIP, or folder onto the upload area, or click Choose CSV.</p>'; return Promise.resolve(false); }
  $("#result").innerHTML = '<p class="eyebrow">LOADING FILE</p><h2>Reading your records</h2><p>Please wait a moment while this file is prepared in your browser.</p>'; return new Promise((resolve) => { const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(String(reader.result)); if (!rows.length) return;
    const originalHeaders = rows[0].map((header, index) => String(header || "").trim() || `Column ${index + 1}`); const headers = originalHeaders.map(normalizeHeader); const mapped = Object.fromEntries(Object.entries(fieldAliases).map(([field, aliases]) => [field, aliases.map(normalizeHeader).find((name) => headers.includes(name)) || ""]));
    applicants = rows.slice(1).map((cells) => { const record = {}; Object.entries(fieldAliases).forEach(([field, aliases]) => { record[field] = readField(cells, headers, aliases); }); record.fileDetails = Object.fromEntries(originalHeaders.map((header, index) => [header, String(cells[index] || "").trim()]).filter(([, value]) => value)); record.nextStep = ""; return record; }); selectedRecordIndex = null; lastSelectionAnchor = null; selectedRecordIndexes.clear();
    applicants.forEach((applicant) => { if (!applicant.name) applicant.name = "Unnamed record"; if (!applicant.role) applicant.role = "Position not provided"; });
    saveDepartmentView(); renderScanSummary(headers, mapped, applicants.length); populateDepartmentFilter(); renderList(); renderDashboard(); $("#downloadText").disabled = applicants.length === 0;
    renderEmptyReview(); resolve(true);
  };
  reader.onerror = () => resolve(false); reader.readAsText(file); });
}

async function loadZip(file) { if (!window.JSZip) { $("#result").innerHTML = '<p class="eyebrow">ZIP SUPPORT</p><h2>ZIP support is loading</h2><p>Please try the ZIP again in a moment.</p>'; return; } const zip = await JSZip.loadAsync(file); const csvEntry = Object.values(zip.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".csv")); if (!csvEntry) { $("#result").innerHTML = '<p class="eyebrow">NO CSV FOUND</p><h2>This ZIP has no CSV file</h2><p>Please choose a ZIP that contains a CSV file.</p>'; return; } loadCsv(new File([await csvEntry.async("blob")], csvEntry.name, { type: "text/csv" })); }
function loadItem(file) { if (!file) return; if (file.name.toLowerCase().endsWith(".zip")) { loadZip(file); return; } loadCsv(file); }

$("#csvInput").onchange = (event) => { loadItem(event.target.files?.[0]); event.target.value = ""; };
const uploadZone = $("#uploadZone"); const dropHint = $("#dropHint");
function filesFromEntry(entry) { if (entry.isFile) return new Promise((resolve) => entry.file((file) => resolve([file]), () => resolve([]))); return new Promise((resolve) => { const reader = entry.createReader(); const entries = []; const readBatch = () => reader.readEntries(async (batch) => { if (batch.length) { entries.push(...batch); readBatch(); return; } resolve((await Promise.all(entries.map(filesFromEntry))).flat()); }, () => resolve([])); readBatch(); }); }
[uploadZone, dropHint].forEach((zone) => { ["dragenter", "dragover"].forEach((eventName) => zone.addEventListener(eventName, (event) => { event.preventDefault(); zone.classList.add("dragging"); })); ["dragleave", "drop"].forEach((eventName) => zone.addEventListener(eventName, (event) => { event.preventDefault(); zone.classList.remove("dragging"); })); zone.addEventListener("drop", async (event) => { const entries = Array.from(event.dataTransfer.items || []).map((item) => item.webkitGetAsEntry?.()).filter(Boolean); const files = entries.length ? (await Promise.all(entries.map(filesFromEntry))).flat() : Array.from(event.dataTransfer.files || []); loadItem(files.find((file) => /\.(csv|zip)$/i.test(file.name))); }); });
["#applicantSearch", "#departmentFilter", "#stepFilter", "#sortFilter", "#missingOnly"].forEach((selector) => { $(selector).addEventListener(selector === "#applicantSearch" ? "input" : "change", renderList); });
$("#clearFilters").onclick = () => { $("#applicantSearch").value = ""; $("#departmentFilter").value = ""; $("#stepFilter").value = ""; $("#sortFilter").value = "balanced"; $("#missingOnly").checked = false; renderList(); };
$("#selectVisible").onclick = () => { const allSelected = visibleRecordIndexes.length && visibleRecordIndexes.every((index) => selectedRecordIndexes.has(index)); visibleRecordIndexes.forEach((index) => allSelected ? selectedRecordIndexes.delete(index) : selectedRecordIndexes.add(index)); renderList(); };
$("#clearSelection").onclick = () => { selectedRecordIndexes.clear(); lastSelectionAnchor = null; renderList(); };
$("#markReviewed").onclick = () => { const chosen = [...selectedRecordIndexes]; if (!chosen.length) return; if (!window.confirm(`Mark ${chosen.length} selected record${chosen.length === 1 ? "" : "s"} as reviewed? This is a human-selected next step.`)) return; chosen.forEach((index) => { applicants[index].nextStep = "resume-reviewed"; }); selectedRecordIndexes.clear(); lastSelectionAnchor = null; saveDepartmentView(); renderList(); renderDashboard(); renderEmptyReview(); };
function exportRecords(records, filename) {
  const missingNextSteps = records.filter((applicant) => !applicant.nextStep);
  if (missingNextSteps.length) { $("#result").innerHTML = `<p class="eyebrow">NEXT STEP NEEDED</p><h2>Choose a next step first</h2><p>${missingNextSteps.length} selected record${missingNextSteps.length === 1 ? " is" : "s are"} missing a human-selected next step.</p>`; return; }
  const departments = [...new Set(records.map((applicant) => applicant.department || "No department listed"))].sort((first, second) => first.localeCompare(second)); const lines = ["APPLICANT NEXT STEPS BY DEPARTMENT", ""];
  departments.forEach((department) => { lines.push(`Department: ${department}`, ""); records.filter((applicant) => (applicant.department || "No department listed") === department).sort((first, second) => first.name.localeCompare(second.name)).forEach((applicant) => { const step = nextSteps[applicant.nextStep]; lines.push(`Name: ${applicant.name}`, `Position: ${applicant.role}`, `Next step: ${step.label}`, `Instruction: ${step.instruction}`, ""); }); });
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
$("#exportSelected").onclick = () => { const selected = [...selectedRecordIndexes].map((index) => applicants[index]).filter(Boolean); if (!selected.length) return; exportRecords(selected, "selected-applicant-next-steps.txt"); };
document.addEventListener("keydown", (event) => {
  const target = event.target; if (target.matches("input, textarea, select, button, summary") || target.closest(".more-options")) return;
  if (event.key === "/") { event.preventDefault(); $("#applicantSearch").focus(); return; }
  if (!visibleRecordIndexes.length || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault(); const currentPosition = visibleRecordIndexes.indexOf(selectedRecordIndex); const nextPosition = event.key === "ArrowDown" ? Math.min(currentPosition < 0 ? 0 : currentPosition + 1, visibleRecordIndexes.length - 1) : Math.max(currentPosition < 0 ? 0 : currentPosition - 1, 0); selectRecord(visibleRecordIndexes[nextPosition], true);
});
function downloadTextFile() { const missingNextSteps = applicants.filter((applicant) => !applicant.nextStep); if (missingNextSteps.length) { window.alert(`No entry for next step. Select a next step for all ${missingNextSteps.length} applicant${missingNextSteps.length === 1 ? "" : "s"} before downloading.`); return; } const departments = [...new Set(applicants.map((applicant) => applicant.department || "No department listed"))].sort((first, second) => first.localeCompare(second)); const lines = ["APPLICANT NEXT STEPS BY DEPARTMENT", ""]; departments.forEach((department) => { lines.push(`Department: ${department}`, ""); applicants.filter((applicant) => (applicant.department || "No department listed") === department).sort((first, second) => first.name.localeCompare(second.name)).forEach((applicant) => { const step = nextSteps[applicant.nextStep]; lines.push(`Name: ${applicant.name}`, `Position: ${applicant.role}`, `Next step: ${step.label}`, `Instruction: ${step.instruction}`, ""); }); }); const blob = new Blob([lines.join("\n")], { type: "text/plain" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "applicant-next-steps-by-department.txt"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000); $("#result").innerHTML = '<p class="eyebrow">TEXT FILE READY</p><h2>Download started</h2><p>Your department-organized next-step file is being saved.</p>'; }
$("#downloadText").onclick = downloadTextFile;
$("#runTest").onclick = async () => { $("#result").innerHTML = '<p class="eyebrow">TEST RUN</p><h2>Loading included test CSV…</h2>'; const response = await fetch("/test-data/HRDataset_v14.csv"); if (!response.ok || !(await loadCsv(new File([await response.blob()], "HRDataset_v14.csv", { type: "text/csv" })))) return; const choices = Object.keys(nextSteps); applicants.forEach((applicant) => { applicant.nextStep = choices[Math.floor(Math.random() * choices.length)]; }); saveDepartmentView(); renderList(); renderDashboard(); };
function clearCurrentFile() { sessionStorage.removeItem("applicant-reviewer-dashboard-view"); sessionStorage.removeItem("applicant-reviewer-department-view"); sessionStorage.removeItem("applicant-reviewer-file-type"); window.location.reload(); }
$("#refreshPage").onclick = clearCurrentFile;
$("#applicantRefresh").onclick = clearCurrentFile;
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
    populateDepartmentFilter(); renderList(); renderDashboard(); $("#downloadText").disabled = false;
    $("#result").innerHTML = `<p class="eyebrow">CSV RESTORED</p><h2>${applicants.length} record${applicants.length === 1 ? "" : "s"} available</h2><p>Your loaded applicant list is still available for this browser session. Select an applicant to continue reviewing.</p>`;
  } catch { sessionStorage.removeItem("applicant-reviewer-dashboard-view"); }
}
restoreDashboardView();
const savedTheme = localStorage.getItem("applicant-tracker-theme"); if (savedTheme === "night") document.body.classList.add("night");
function updateThemeButton() { const night = document.body.classList.contains("night"); $("#themeToggle").textContent = night ? "☀ Day" : "☾ Night"; $("#themeToggle").setAttribute("aria-label", night ? "Switch to day mode" : "Switch to night mode"); }
$("#themeToggle").onclick = () => { document.body.classList.toggle("night"); document.documentElement.classList.toggle("night", document.body.classList.contains("night")); localStorage.setItem("applicant-tracker-theme", document.body.classList.contains("night") ? "night" : "day"); updateThemeButton(); };
updateThemeButton();
