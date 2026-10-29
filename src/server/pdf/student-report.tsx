import { Document, Font, Image, Page, Path, Svg, StyleSheet, Text, View } from "@react-pdf/renderer";
import { join } from "node:path";

/*
 * Student Mentoring Report (PDF). Data comes ONLY from verified/finalized records and
 * shared mentoring items marked include_in_report. By construction this component has
 * no inputs for charts, insights, risk flags, Pulse, planner results or questions.
 */

// Vendored copies of the @fontsource files, read by path from the project root. Bundled
// require.resolve() can't find node_modules in a production build; next.config.ts traces this folder.
const FONT_DIR = join(process.cwd(), "src/server/pdf/fonts");
let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Manrope",
    fonts: [
      { src: join(FONT_DIR, "manrope-latin-400-normal.woff"), fontWeight: 400 },
      { src: join(FONT_DIR, "manrope-latin-600-normal.woff"), fontWeight: 600 },
      { src: join(FONT_DIR, "manrope-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  Font.register({ family: "Bricolage", fonts: [{ src: join(FONT_DIR, "bricolage-grotesque-latin-700-normal.woff"), fontWeight: 700 }] });
  Font.registerHyphenationCallback((w) => [w]);
  fontsReady = true;
}

export type ReportData = {
  institution: string;
  department: string;
  generatedAt: string;
  student: { name: string; usn: string | null; program: string | null; semester: number | null; section: string | null; academicYear: string | null; email: string | null; photo: string | null };
  mentor: string | null;
  cgpa: number | null;
  creditsCompleted: number;
  semesters: {
    no: number;
    year: string | null;
    status: "VERIFIED" | "FINALIZED";
    sgpa: number | null;
    credits: number | null;
    subjects: { code: string; name: string; mse: string; see: string; max: string; credits: string; grade: string; result: string }[];
  }[];
  mentoring: { kind: string; category: string; title: string; body: string; status: string; date: string; due: string | null }[];
};

const PINE = "#0F766E";
const INK = "#10201B";
const MUTED = "#5E6B66";
const LINE = "#E3E8E2";
const TINT = "#ECF8F5";

const s = StyleSheet.create({
  page: { fontFamily: "Manrope", fontSize: 9.5, color: INK, paddingTop: 92, paddingBottom: 62, paddingHorizontal: 51 },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: 66, backgroundColor: PINE, paddingHorizontal: 51, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bandRight: { alignItems: "flex-end" },
  bandTitle: { color: "#FFFFFF", fontFamily: "Bricolage", fontSize: 13 },
  bandSub: { color: "#D5EFEA", fontSize: 8, marginTop: 2 },
  footer: { position: "absolute", bottom: 26, left: 51, right: 51, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED, borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 6 },
  h1: { fontFamily: "Bricolage", fontSize: 20, color: INK, marginBottom: 2 },
  lead: { fontSize: 9, color: MUTED, marginBottom: 14 },
  section: { marginTop: 14 },
  h2row: { flexDirection: "row", alignItems: "baseline", marginBottom: 8, borderBottomWidth: 1, borderBottomColor: PINE, paddingBottom: 4 },
  h2num: { color: PINE, fontWeight: 700, fontSize: 11, marginRight: 8 },
  h2: { fontWeight: 700, fontSize: 11.5, color: INK },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  kv: { width: "50%", marginBottom: 6, paddingRight: 8 },
  k: { fontSize: 7, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 },
  v: { fontSize: 10, marginTop: 1 },
  stats: { flexDirection: "row", marginBottom: 8 },
  stat: { flex: 1, backgroundColor: TINT, borderRadius: 6, padding: 8, marginRight: 6 },
  statV: { fontFamily: "Bricolage", fontSize: 16, color: PINE },
  statK: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  table: { borderWidth: 0.6, borderColor: LINE, borderRadius: 4 },
  th: { flexDirection: "row", backgroundColor: PINE, color: "#FFFFFF", fontWeight: 700, fontSize: 8 },
  tr: { flexDirection: "row", borderTopWidth: 0.6, borderTopColor: LINE, fontSize: 8.5 },
  trAlt: { backgroundColor: "#F7FAF6" },
  cell: { paddingVertical: 4, paddingHorizontal: 5 },
  semHead: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 5 },
  semTitle: { fontWeight: 700, fontSize: 10.5 },
  semMeta: { fontSize: 8.5, color: MUTED },
  rec: { borderLeftWidth: 2, borderLeftColor: PINE, paddingLeft: 8, marginBottom: 8 },
  recTitle: { fontWeight: 700, fontSize: 10 },
  recMeta: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  recBody: { fontSize: 9, marginTop: 3, lineHeight: 1.4 },
  photo: { width: 64, height: 64, borderRadius: 10, objectFit: "cover" },
  empty: { fontSize: 9, color: MUTED, fontStyle: "normal" },
});

const COLS = [
  { k: "code", l: "Code", w: "12%" },
  { k: "name", l: "Subject", w: "34%" },
  { k: "mse", l: "MSE", w: "9%", r: true },
  { k: "see", l: "SEE", w: "9%", r: true },
  { k: "max", l: "Max (MSE/SEE)", w: "13%", r: true },
  { k: "credits", l: "Credits", w: "8%", r: true },
  { k: "grade", l: "Grade", w: "7%", r: true },
  { k: "result", l: "Result", w: "8%" },
] as const;

function WhiteLogo() {
  return (
    <Svg viewBox="0 0 64 64" style={{ width: 30, height: 30 }}>
      <Path d="M32 60 C32 50 32 42 32 31" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M31 43 C17 44 7 34 7 18 C22 18 31 28 31 43 Z" fill="#FFFFFF" />
      <Path d="M33 33 C33 22 41 13 56 13 C56 26 47 34 33 33 Z" fill="#6EE7B7" />
      <Path d="M23.5 9 A5.5 5.5 0 1 0 34.5 9 A5.5 5.5 0 1 0 23.5 9 Z" fill="#FCD34D" />
    </Svg>
  );
}

function Heading({ n, title }: { n: string; title: string }) {
  return (
    <View style={s.h2row} minPresenceAhead={90}>
      <Text style={s.h2num}>{n}</Text>
      <Text style={s.h2}>{title}</Text>
    </View>
  );
}

export function StudentReport({ d }: { d: ReportData }) {
  registerFonts();
  return (
    <Document title={`Student Mentoring Report — ${d.student.name}`} author="Elevo" subject="Student Mentoring Report" creator="Elevo">
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <WhiteLogo />
            <Text style={{ color: "#FFFFFF", fontFamily: "Bricolage", fontSize: 18, marginLeft: 8 }}>elevo</Text>
          </View>
          <View style={s.bandRight}>
            <Text style={s.bandTitle}>Student Mentoring Report</Text>
            <Text style={s.bandSub}>
              {d.institution} · {d.department} · Generated {d.generatedAt}
            </Text>
          </View>
        </View>
        <View style={s.footer} fixed>
          <Text>Confidential — for academic mentoring use only. Generated from verified records.</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

        <Text style={s.h1}>{d.student.name}</Text>
        <Text style={s.lead}>
          {[d.student.usn, d.student.program, d.student.semester ? `Semester ${d.student.semester}` : null].filter(Boolean).join(" · ")}
        </Text>

        <View style={s.section}>
          <Heading n="01" title="Student Information" />
          <View style={{ flexDirection: "row" }}>
            {d.student.photo ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={d.student.photo} style={[s.photo, { marginRight: 14 }]} />
            ) : null}
            <View style={[s.grid, { flex: 1 }]}>
              {[
                ["Name", d.student.name],
                ["USN", d.student.usn ?? "—"],
                ["Department", d.department],
                ["Program", d.student.program ?? "—"],
                ["Current semester", d.student.semester ? String(d.student.semester) : "—"],
                ["Section", d.student.section ?? "—"],
                ["Academic year", d.student.academicYear ?? "—"],
                ["Mentor", d.mentor ?? "Not assigned"],
              ].map(([k, v]) => (
                <View key={k} style={s.kv}>
                  <Text style={s.k}>{k}</Text>
                  <Text style={s.v}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Heading n="02" title="Academic Summary" />
          <View style={s.stats}>
            <View style={s.stat}>
              <Text style={s.statV}>{d.cgpa == null ? "—" : d.cgpa.toFixed(2)}</Text>
              <Text style={s.statK}>Current CGPA (verified semesters)</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statV}>{d.creditsCompleted}</Text>
              <Text style={s.statK}>Credits completed</Text>
            </View>
            <View style={[s.stat, { marginRight: 0 }]}>
              <Text style={s.statV}>{d.semesters.length}</Text>
              <Text style={s.statK}>Verified semesters</Text>
            </View>
          </View>
          {d.semesters.length > 0 && (
            <View style={s.table}>
              <View style={s.th}>
                {["Semester", "Academic year", "SGPA", "Credits", "Status"].map((h) => (
                  <Text key={h} style={[s.cell, { width: "20%" }]}>
                    {h}
                  </Text>
                ))}
              </View>
              {d.semesters.map((m, i) => (
                <View key={m.no} style={[s.tr, i % 2 ? s.trAlt : {}]} wrap={false}>
                  <Text style={[s.cell, { width: "20%" }]}>Semester {m.no}</Text>
                  <Text style={[s.cell, { width: "20%" }]}>{m.year ?? "—"}</Text>
                  <Text style={[s.cell, { width: "20%" }]}>{m.sgpa == null ? "—" : m.sgpa.toFixed(2)}</Text>
                  <Text style={[s.cell, { width: "20%" }]}>{m.credits ?? "—"}</Text>
                  <Text style={[s.cell, { width: "20%" }]}>{m.status === "FINALIZED" ? "Finalized" : "Verified"}</Text>
                </View>
              ))}
            </View>
          )}
          {d.semesters.length === 0 && <Text style={s.empty}>No verified semesters yet.</Text>}
        </View>

        <View style={s.section}>
          <Heading n="03" title="Semester-wise Performance" />
          {d.semesters.length === 0 && <Text style={s.empty}>No verified semesters yet.</Text>}
          {d.semesters.map((m) => (
            <View key={m.no} style={{ marginBottom: 6 }}>
              <View style={s.semHead} minPresenceAhead={60} wrap={false}>
                <Text style={s.semTitle}>Semester {m.no}</Text>
                <Text style={s.semMeta}>
                  {m.year ?? ""} · SGPA {m.sgpa == null ? "—" : m.sgpa.toFixed(2)} · {m.credits ?? "—"} credits
                </Text>
              </View>
              <View style={s.table}>
                <View style={s.th} fixed>
                  {COLS.map((c) => (
                    <Text key={c.k} style={[s.cell, { width: c.w, textAlign: "r" in c ? "right" : "left" }]}>
                      {c.l}
                    </Text>
                  ))}
                </View>
                {m.subjects.map((r, i) => (
                  <View key={`${r.code}-${i}`} style={[s.tr, i % 2 ? s.trAlt : {}]} wrap={false}>
                    {COLS.map((c) => (
                      <Text key={c.k} style={[s.cell, { width: c.w, textAlign: "r" in c ? "right" : "left" }]}>
                        {r[c.k]}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Heading n="04" title="Mentoring Records" />
          {d.mentoring.length === 0 && <Text style={s.empty}>No mentoring records selected for this report.</Text>}
          {d.mentoring.map((r, i) => (
            <View key={i} style={s.rec} wrap={false}>
              <Text style={s.recTitle}>{r.title}</Text>
              <Text style={s.recMeta}>
                {r.kind} · {r.category} · {r.status} · {r.date}
                {r.due ? ` · due ${r.due}` : ""}
              </Text>
              {r.body ? <Text style={s.recBody}>{r.body}</Text> : null}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
