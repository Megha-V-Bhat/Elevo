import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Table } from "../exports";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8.5, padding: 40, paddingTop: 70, paddingBottom: 50, color: "#10201B" },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: 48, backgroundColor: "#0F766E", paddingHorizontal: 40, justifyContent: "center" },
  bandText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Helvetica-Bold" },
  meta: { color: "#5E6B66", marginBottom: 10 },
  th: { flexDirection: "row", backgroundColor: "#0F766E", color: "#FFFFFF", fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#E3E8E2" },
  cell: { flex: 1, padding: 4 },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", color: "#5E6B66", fontSize: 7 },
});

/** Summary PDF for administrative exports (tables only — no charts or insights). */
export function TableReport({ t, department, generated }: { t: Table; department: string; generated: string }) {
  return (
    <Document title={`${t.title} — Elevo`} author="Elevo">
      <Page size="A4" orientation={t.columns.length > 6 ? "landscape" : "portrait"} style={s.page}>
        <View style={s.band} fixed>
          <Text style={s.bandText}>elevo · {t.title}</Text>
        </View>
        <Text style={s.meta}>
          {department} · Generated {generated} · {t.rows.length} rows
        </Text>
        <View style={s.th} fixed>
          {t.columns.map((c) => (
            <Text key={c} style={s.cell}>
              {c}
            </Text>
          ))}
        </View>
        {t.rows.map((r, i) => (
          <View key={i} style={s.tr} wrap={false}>
            {r.map((v, j) => (
              <Text key={j} style={s.cell}>
                {v == null ? "—" : String(v)}
              </Text>
            ))}
          </View>
        ))}
        <View style={s.footer} fixed>
          <Text>Confidential — administrative use only.</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
