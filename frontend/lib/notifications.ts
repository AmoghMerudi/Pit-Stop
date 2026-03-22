export function requestPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return Promise.resolve("denied" as NotificationPermission)
  return Notification.requestPermission()
}

export function notify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return
  new Notification(title, { body, icon: "/favicon.ico" })
}

export interface StrategySnapshot {
  recommend_pit: boolean
  crossover_lap: number
  undercut_threats: { driver: string }[]
}

export function checkTriggers(prev: StrategySnapshot | null, curr: StrategySnapshot) {
  if (!prev) return

  // Pit window just opened
  if (!prev.recommend_pit && curr.recommend_pit) {
    notify("Pit Window Open", "Strategy recommends pitting now!")
  }

  // Crossover imminent (within 2 laps and was further before)
  if (curr.crossover_lap <= 2 && curr.crossover_lap < 999 && prev.crossover_lap > 2) {
    notify("Crossover Imminent", `Crossover in ${curr.crossover_lap} lap${curr.crossover_lap === 1 ? "" : "s"}`)
  }

  // New undercut threat
  const prevDrivers = new Set(prev.undercut_threats.map((t) => t.driver))
  const newThreats = curr.undercut_threats.filter((t) => !prevDrivers.has(t.driver))
  if (newThreats.length > 0) {
    notify("New Undercut Threat", `${newThreats.map((t) => t.driver).join(", ")} threatening undercut`)
  }
}
