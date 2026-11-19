import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Kicker } from "./UI";

export default function WorkspaceSignal({ name }: { name?: string }) {
  return (
    <div className="dashboard-heading">
      <div>
        <Kicker>RESEARCH WORKSPACE</Kicker>
        <h1 className="page-title">
          {name ? `Welcome back, ${name}.` : "Your research workspace."}
        </h1>
        <p className="page-subtitle">
          Your documents, evidence, and verification history in one place.
        </p>
      </div>
      <Link className="btn btn-primary" to="/verify">
        <Plus size={16} />
        New verification
      </Link>
    </div>
  );
}
