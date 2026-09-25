const STARTER_CAMPAIGN = {
  campaignName: "The Scale of Verdant Night",
  campaignNotes: "A mystery-driven campaign following Lamfurion's search for the force that destroyed his order and the meaning of the green scale left behind.",
  encounterName: "The Ashen Crossing",
  round: 1,
  turn: 0,
  combatants: [
    { id: "c1", name: "Lamfurion", kind: "player", initiative: 18, hp: 47, maxHp: 52, ac: 19, conditions: [] },
    { id: "c2", name: "Goblin Hexer", number: 1, kind: "monster", initiative: 15, hp: 21, maxHp: 32, ac: 14, conditions: [{ id: "condition-1", name: "Concentrating", remainingTurns: null }], monsterId: "m1" },
    { id: "c3", name: "Ridgeback Drake", number: 1, kind: "monster", initiative: 11, hp: 44, maxHp: 58, ac: 16, conditions: [], monsterId: "m2" },
  ],
  players: [
    { id: "p1", name: "Lamfurion", race: "Golden Dragonborn", className: "Paladin / Warlock", level: 8, hp: 52, ac: 19, notes: "The green scale is the only clue left by the attackers who destroyed his order." },
    { id: "p2", name: "Mira Tideborn", race: "Sea Elf", className: "Druid", level: 8, hp: 45, ac: 16, notes: "Knows the old river paths leading toward the Ashen Crossing." },
  ],
  monsters: [
    { id: "m1", name: "Goblin Hexer", type: "Small humanoid", cr: "2", ac: 14, hp: 32, speed: "30 ft.", stats: "STR 8  DEX 16  CON 12  INT 14  WIS 11  CHA 15", abilities: "Nimble Escape — Disengage or Hide as a bonus action.\nHex Bolt — +5 to hit, 2d8 necrotic damage.", spells: "Cantrips: fire bolt, minor illusion\n1st: shield, witch bolt\n2nd: misty step", notes: "", slots: [3, 2, 0, 0, 0] },
    { id: "m2", name: "Ridgeback Drake", type: "Medium dragon", cr: "3", ac: 16, hp: 58, speed: "40 ft., fly 60 ft.", stats: "STR 18  DEX 14  CON 16  INT 6  WIS 12  CHA 8", abilities: "Pack Tactics — Advantage while an ally is within 5 feet.\nRending Bite — +6 to hit, 2d10 + 4 piercing.", spells: "No spells", notes: "", slots: [0, 0, 0, 0, 0] },
  ],
  sessions: [
    { id: "n1", title: "Session 12 — The Ashen Crossing", date: "2026-09-28", body: "Open on the bridge at dawn. The green scale reacts to the old ward-stone.\n\nRemember: Captain Vael knows more than she admitted.", done: false, encounters: [
      { id: "e1", name: "Ambush at the ward-stone", monsters: [
        { id: "em1", monsterId: "m1", number: 1 },
        { id: "em2", monsterId: "m1", number: 2 },
        { id: "em3", monsterId: "m2", number: 1 },
      ] },
    ] },
  ],
  story: [
    { id: "s1", title: "The order is destroyed", chapter: "Prologue", details: "Lamfurion returns to find the sanctuary burned and a single green scale among the ashes.", status: "happened", sessionIds: [] },
    { id: "s2", title: "Trace the ward-stone", chapter: "Chapter II", details: "The party must reach the Ashen Crossing before the cult removes the stone.", status: "active", sessionIds: ["n1"] },
    { id: "s3", title: "Reveal the Verdant Oath", chapter: "Chapter III", details: "The scale belongs to an ancient guardian bound beneath Neverwinter.", status: "planned", sessionIds: [] },
  ],
};

export function createStarterCampaign<T>(): T {
  return structuredClone(STARTER_CAMPAIGN) as T;
}
