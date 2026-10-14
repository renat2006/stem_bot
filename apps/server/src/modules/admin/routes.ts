import { ShiftPhaseSchema } from "@stem/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../shared/app-env.js";
import { mutationOptions, stateResponse } from "../../shared/route-context.js";
import { requireAdmin } from "../../shared/telegram-auth.js";
import { validateJson } from "../../shared/validate-json.js";
import {
  adjustTrack,
  applyTurn,
  createTeam,
  nextDay,
  removeMember,
  resetEvent,
  rewardTeams,
  setCaptain,
  setPhase,
  updateSettings,
} from "./service.js";

const RewardInput = z.object({
  teamIds: z.array(z.string().min(1)).min(1).max(50),
  amount: z.number().int().min(-50).max(50),
  reason: z.string().trim().min(1).max(120),
  comment: z.string().trim().max(200).optional(),
});
const TrackInput = z.object({
  teamId: z.string().min(1),
  delta: z.number().int().min(-30).max(30),
  reason: z.string().trim().max(120).optional(),
});
const PhaseInput = z.object({
  phase: ShiftPhaseSchema,
  minutes: z.number().int().min(1).max(600).nullable().optional(),
});
const SettingsInput = z.object({ purchaseLimit: z.number().int().min(0).max(20).nullable() });
const TeamInput = z.object({ name: z.string().trim().min(2).max(40) });
const CaptainInput = z.object({ teamId: z.string().min(1), userId: z.number().int().positive() });
const MemberInput = z.object({ userId: z.number().int().positive() });
const ResetInput = z.object({
  templateId: z.string().min(1).optional(),
  demoTeams: z.boolean().default(false),
});

export const adminRouter = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .post("/reward", validateJson(RewardInput), async (c) => {
    const options = await mutationOptions(c);
    await rewardTeams(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/track", validateJson(TrackInput), async (c) => {
    const options = await mutationOptions(c);
    await adjustTrack(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/phase", validateJson(PhaseInput), async (c) => {
    const options = await mutationOptions(c);
    await setPhase(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/settings", validateJson(SettingsInput), async (c) => {
    const options = await mutationOptions(c);
    await updateSettings(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/next-day", async (c) => {
    const options = await mutationOptions(c);
    await nextDay(options);
    return stateResponse(c, options.eventId);
  })
  .post("/apply-turn", async (c) => {
    const options = await mutationOptions(c);
    await applyTurn(options);
    return stateResponse(c, options.eventId);
  })
  .post("/teams", validateJson(TeamInput), async (c) => {
    const options = await mutationOptions(c);
    await createTeam(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/captain", validateJson(CaptainInput), async (c) => {
    const options = await mutationOptions(c);
    await setCaptain(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/remove-member", validateJson(MemberInput), async (c) => {
    const options = await mutationOptions(c);
    await removeMember(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  })
  .post("/reset", validateJson(ResetInput), async (c) => {
    const options = await mutationOptions(c);
    await resetEvent(options, c.req.valid("json"));
    return stateResponse(c, options.eventId);
  });
