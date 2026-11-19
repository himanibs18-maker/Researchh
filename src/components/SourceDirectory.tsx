import { ArrowUpRight, Database, Network } from "lucide-react";
import { Kicker } from "./UI";
export interface DatabaseEntry {
  name: string;
  url: string;
  purpose: string;
  coverage: string;
  mode: "Integrated" | "Discovery";
  sort_order: number;
}
export default function SourceDirectory({
  entries,
}: {
  entries: DatabaseEntry[];
}) {
  if (!entries.length) return null;
  return (
    <section
      className="panel directory-section"
      aria-label="Open research database directory"
    >
      <Kicker>SCHOLARLY RESOURCES</Kicker>
      <div className="list-heading">
        <h2>Open source directory</h2>
        <Database size={20} />
      </div>
      <p className="muted directory-description">
        Integrated databases are queried during verification. Discovery
        resources open separately for additional research; they are not included
        in an automated check unless listed in its audit.
      </p>
      {(["Integrated", "Discovery"] as const).map((mode) => (
        <div className="directory-group" key={mode}>
          <h3>
            <Network size={13} />
            {mode === "Integrated"
              ? "Verification databases"
              : "Additional discovery resources"}
          </h3>
          <div className="directory-grid">
            {entries
              .filter((d) => d.mode === mode)
              .map((d) => (
                <a
                  className="tool-card directory-item"
                  key={d.name}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="directory-top">
                    <strong>{d.name}</strong>
                    <ArrowUpRight size={14} />
                  </span>
                  <p>{d.purpose}</p>
                  <small className="tool-index">{d.coverage}</small>
                </a>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
