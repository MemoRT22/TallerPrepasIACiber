export const SERVICE_SITES = [
  {
    id: "agua",
    x: -9,
    z: -4.3,
    height: 4.5,
    short: "Agua",
    description: "Torre de agua, depósitos y planta de tratamiento",
  },
  {
    id: "energia",
    x: -3,
    z: -6,
    height: 4.7,
    short: "Energía",
    description:
      "Minitorres eléctricas, tendido, transformadores y paneles solares",
  },
  {
    id: "movilidad",
    x: -7.4,
    z: 3.3,
    height: 2.5,
    short: "Movilidad",
    description: "Terminal urbana, autobuses y circulación vial",
  },
  {
    id: "comunicaciones",
    x: 2.2,
    z: -3.5,
    height: 5.5,
    short: "Comunicaciones",
    description: "Antena de telecomunicaciones, parabólicas y centro de datos",
  },
  {
    id: "turismo",
    x: 10.2,
    z: 3.5,
    height: 4.2,
    short: "Turismo",
    description: "Hotel, piscina, playa y servicios turísticos",
  },
  {
    id: "municipal",
    x: -0.5,
    z: 4,
    height: 3.5,
    short: "Municipal",
    description: "Palacio municipal, plaza y fuente pública",
  },
] as const;
export const STATUS_COLORS = {
  operational: "#2788e8",
  warning: "#f58232",
  down: "#a84b25",
};
