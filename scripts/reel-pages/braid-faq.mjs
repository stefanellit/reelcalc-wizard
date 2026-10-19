// Editorial only: use the stored fishing roles, never reel size alone, to explain
// the existing line range. This does not select line or calculator defaults.
export function braidFaqAdvice(reel, recommendation) {
  const uses = String(reel.useCase || "").toLowerCase();
  const freshwaterUses = uses.replace(/speckled trout|sea trout|seatrout/g, "");
  const saltwater = /saltwater|inshore|nearshore|offshore|surf|beach|pier|coastal|redfish|speckled trout|sea trout|seatrout/.test(uses);
  const trout = /\btrout\b/.test(freshwaterUses);
  const panfish = /panfish|crappie/.test(uses);
  const finesse = /finesse|ultralight/.test(uses);
  const bass = /\bbass\b/.test(uses);
  const heavyFreshwater = /pike|muskie|musky|catfish|carp|heav(?:y|ier) freshwater/.test(uses);
  const baitcaster = /baitcast|casting/.test(String(reel.reelType || "").toLowerCase());
  const prefix = `${recommendation.braidRange} is the practical ReelCalc range for this ${baitcaster ? "baitcaster" : "reel"}.`;
  const subjects = [trout && "trout", panfish && "panfish", /speckled trout/.test(uses) && "speckled trout", /redfish/.test(uses) && "redfish"].filter(Boolean);
  const list = (items) => items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
  let profile;
  let advice;

  if (baitcaster && /bait finesse|\bbfs\b/.test(`${uses} ${reel.baitcasterClass || ""}`)) {
    profile = "bait-finesse";
    advice = `For small lures${subjects.length ? ` targeting ${list(subjects)}` : ""}, start toward the lighter end and match the line to your rod and lure. The upper end can give more margin around light cover, but this is still a light-lure setup. Wind braid firmly and check for line digging into the wraps after a snag or hard pull.`;
  } else if (/trolling|line deployment/.test(uses)) {
    profile = "trolling";
    advice = "For trolling or bait fishing, choose within that range for your rod, rig, and the fish you expect. Thinner braid leaves more line in reserve; heavier braid takes up more spool space. Allow enough working line for the distance to your bait plus a useful reserve.";
  } else if (baitcaster && !/offshore|big saltwater|tuna|large pelagic|heavy jigging/.test(uses)) {
    profile = saltwater ? "coastal-baitcaster" : "casting";
    const heavyUses = /frog|heavy cover|vegetation|flipping|pitching/.test(uses);
    const largeLures = /swimbait|larger lure|larger bait|big bait|umbrella/.test(uses);
    const stronger = [heavyUses && "fishing cover", largeLures && "using larger baits", saltwater && "controlling fish near inshore structure"].filter(Boolean);
    advice = `For ${saltwater ? "inshore casting" : "casting lures"}, choose within that range to suit your rod and presentation. The lighter end suits open water; move up when ${stronger.length ? list(stronger) : "your rig and fishing conditions call for more strength"}. Do not choose the thinnest braid just to gain yardage: braid can dig into lower wraps on a baitcaster under load.`;
  } else if (/offshore|big saltwater|tuna|large pelagic|heavy jigging/.test(uses)) {
    profile = "offshore";
    advice = "For offshore fishing, balance the working line and reserve you need against the strength required by your rod, rig, and target fish. The lighter end leaves more line in reserve; the stronger end suits heavier rigs when the rest of the tackle is matched to them. Choose the leader separately for the fish and structure.";
  } else if (saltwater && /surf|beach|pier/.test(uses) && !trout && !panfish && !finesse) {
    profile = "surf-pier-inshore";
    advice = "For inshore, surf, or pier fishing, use the lighter end when casting distance and line capacity matter most. Move toward the stronger end around structure, heavier current, or larger baits, while staying within your rod's line rating. Match the leader to the structure and fish; heavier braid alone is not a substitute for a suitable leader.";
    // Do not introduce a fishing role that is absent from this reel's record.
    const roles = [/inshore/.test(uses) && "inshore", /surf|beach/.test(uses) && "surf", /pier/.test(uses) && "pier"].filter(Boolean);
    advice = advice.replace("inshore, surf, or pier", list(roles));
  } else if (saltwater && (trout || panfish || finesse || bass || /walleye/.test(uses)) && !heavyFreshwater) {
    profile = "freshwater-inshore";
    const lightRole = subjects.length ? `${list(subjects)} in open water` : "lighter lures in open water";
    advice = `Use the lighter end for ${lightRole}. For the reel's inshore or mixed-cover uses, choose more strength when your rod, rig, and the structure call for it. A leader suited to the fish and structure matters too; the braid's pound-test label does not tell you the whole setup.`;
  } else if (saltwater) {
    profile = heavyFreshwater ? "heavier-freshwater-inshore" : "inshore";
    advice = `For ${heavyFreshwater ? "heavier freshwater or inshore fishing" : "inshore fishing"}, the lighter end helps preserve casting distance and line capacity. Move up when larger baits, current, or nearby structure call for more control, within your rod's line rating. Choose the leader for the fish and structure rather than simply matching the braid label.`;
  } else if (heavyFreshwater) {
    profile = "heavier-freshwater";
    advice = "For heavier freshwater fishing, use the lighter end when you need casting distance and line in reserve. Move up for larger baits or stronger fish near cover, provided the rod and rig are suited to it. Choose the leader for the target fish, including bite protection where needed.";
  } else if (trout || panfish || finesse) {
    profile = "light-freshwater";
    const lightRole = subjects.length ? `small lures for ${list(subjects)}` : "finesse presentations";
    advice = `Use the lighter end when fishing ${lightRole} in open water. The upper end can provide more margin around light cover${bass ? " or when targeting bass" : ""}, but keep the line matched to the rod and lure so the setup still handles light presentations well.`;
  } else {
    profile = "general-freshwater";
    advice = "Choose within that range to suit your rod, lure or bait, and the cover you fish. The lighter end helps with smaller presentations and line capacity; the stronger end offers more margin when the rig or cover calls for it. Choose a leader to suit the fish and conditions.";
  }
  return { profile, text: `${prefix} ${advice}` };
}

export function isLegacyBraidFaq(text) {
  return /is the practical ReelCalc range for this (?:reel|baitcaster)\. Use the lighter end (?:for finesse presentations, trout, and open water\.|for open water and easier casting,|when line capacity and casting distance matter most\.)/.test(String(text));
}
