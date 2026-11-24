import { HostClock } from "@typeonce/ritmo"
import { Intent, makeSimulation, setupSchedule, updateSchedule } from "./sim/index.ts"

export const lintTarget = () => {
  const runtime = makeSimulation({
    seed: 13700501,
    debug: { hostClock: HostClock.test() }
  })
  return {
    runtime,
    schedules: {
      setup: setupSchedule,
      update: updateSchedule
    },
    hostEvents: [Intent]
  }
}
