import type { CardItem, GameTemplate } from "@stem/shared";
import { hashId } from "./procedural/index.js";

const roots: Record<string, string> = {
  lion: "льв",
  shark: "акуло",
  scorpion: "скорп",
  cheetah: "гепардо",
  bear: "медведо",
  wolf: "волко",
  eagle: "орло",
  turtle: "черепахо",
  snake: "зме",
  rhino: "носорого",
  grasshopper: "кузнеч",
  crab: "крабо",
  octopus: "осьми",
  crocodile: "кроко",
};

export function speciesName(template: GameTemplate, equipped: Record<string, string | null>): string {
  const cards = new Map(template.cards.map((card) => [card.id, card]));
  const part = (slot: string) => cards.get(equipped[slot] ?? "");
  if (template.objectRig === "airship") {
    const envelope = part("envelope");
    return envelope ? `NX-${(hashId(envelope.id) % 900) + 100} «${envelope.name}»` : "NX-0 «Прототип»";
  }
  if (template.objectRig === "campus") {
    const name = [part("prod"), part("tech")]
      .filter((card): card is CardItem => Boolean(card))
      .map((card) => title(card.id.split("-")[0] ?? ""));
    return name.length ? `${name.join("")}Labs` : "ProtoLabs";
  }
  const selected = [part("head"), part("body"), part("tail")].filter((card): card is CardItem =>
    Boolean(card),
  );
  const name = selected
    .map((card) => {
      const family = card.id.split("-")[0] ?? card.id;
      return (
        roots[family] ??
        card.name
          .split(" ")
          .at(-1)
          ?.replace(/[^а-яёa-z]/gi, "")
          .slice(0, 6) ??
        ""
      );
    })
    .join("");
  return name ? title(name) : "Неизвестный вид";
}

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
