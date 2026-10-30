import { DEPARTMENTS } from "../../shared/types";
export const SERVICE_SITES = (
  [
    {
      id: "agua",
      x: -9,
      z: -4.3,
      height: 4.5,
      short: "Agua",
    },
    {
      id: "energia",
      x: -3,
      z: -6,
      height: 4.7,
      short: "Energía",
    },
    {
      id: "movilidad",
      x: -7.4,
      z: 3.3,
      height: 2.5,
      short: "Movilidad",
    },
    {
      id: "comunicaciones",
      x: 2.2,
      z: -3.5,
      height: 5.5,
      short: "Comunicaciones",
    },
    {
      id: "turismo",
      x: 10.2,
      z: 3.5,
      height: 4.2,
      short: "Turismo",
    },
    {
      id: "municipal",
      x: -0.5,
      z: 4,
      height: 3.5,
      short: "Municipal",
    },
  ] as const
).map((site) => ({
  ...site,
  description: DEPARTMENTS.find((department) => department.id === site.id)!
    .infrastructure,
}));
export const STATUS_COLORS = {
  operational: "#2788e8",
  warning: "#f58232",
  down: "#a84b25",
};
