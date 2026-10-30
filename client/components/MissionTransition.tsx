import type { PublicState } from "../../shared/types";
import { missionStory } from "../../shared/missionStory";

export default function MissionTransition({ state }: { state: PublicState }) {
  const story = missionStory(state);
  if (!story) return null;
  return (
    <section
      className="mission-transition"
      aria-label="Continuidad de la crisis"
    >
      <span className="eyebrow">{story.label}</span>
      <h3>{story.title}</h3>
      <p>{story.text}</p>
    </section>
  );
}
