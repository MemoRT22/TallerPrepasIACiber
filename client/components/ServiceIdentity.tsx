import type { DepartmentState, Phase } from "../../shared/types";
import {
  serviceContribution,
  serviceProfile,
  serviceState,
} from "../serviceIdentity";
import { DepartmentIcon } from "./UI";

export function ServiceStateBadge({
  service,
  connected,
}: {
  service?: DepartmentState;
  connected: boolean;
}) {
  const state = serviceState(service, connected);
  return (
    <span
      className={`service-state-badge ${state.status}`}
      role="status"
      title={state.message}
      aria-label={`${state.label}. ${state.message}`}
    >
      {state.label}
    </span>
  );
}

export function ServiceStateNotice({
  service,
  connected,
}: {
  service?: DepartmentState;
  connected: boolean;
}) {
  const state = serviceState(service, connected);
  if (state.status !== "warning" && state.status !== "down") return null;
  return (
    <p className={`service-state-notice ${state.status}`} role="status">
      {state.message}
    </p>
  );
}

export function ServiceResponsibility({
  department,
  phase,
  urgent,
}: {
  department: string;
  phase: Phase;
  urgent: boolean;
}) {
  const profile = serviceProfile(department);
  if (!profile) return null;
  return (
    <details className="service-responsibility" open={!urgent}>
      <summary>
        <DepartmentIcon id={profile.id} size={18} /> CENTRO DE CONTROL —{" "}
        {profile.short}
      </summary>
      <dl>
        <div>
          <dt>TU RESPONSABILIDAD</dt>
          <dd>{profile.responsibility}</dd>
          <dd className="service-infrastructure">
            Infraestructura: {profile.infrastructure}.
          </dd>
        </div>
        <div>
          <dt>SI TU SERVICIO FALLA</dt>
          <dd>{profile.potentialImpact}</dd>
        </div>
        <div>
          <dt>TU MISIÓN</dt>
          <dd>{serviceContribution(phase)}</dd>
        </div>
      </dl>
    </details>
  );
}
