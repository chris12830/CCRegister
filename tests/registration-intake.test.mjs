import { test } from "node:test";
import assert from "node:assert/strict";
import { addDate, allocateSpaceSections, defaultCareHours, firstMonday, intakeAnswers, scheduleSummary, sectionsFor } from "../lib/registration-intake.ts";

const room = { id: "room", name: "Preschool 1", ageGroup: "Preschool", capacity: 2, beforeCapacity: 1, afterCapacity: 1 };
const slot = (care, before = false, after = false) => ({ date: "2026-09-28", care, before, after });

test("a full day reserves morning and afternoon on the same numbered space", () => {
  const result = allocateSpaceSections(room, [slot("day", true, true)], []);
  assert.deepEqual(result.reservations?.map(({ section, spaceNumber }) => [section, spaceNumber]), [["am", 1], ["pm", 1], ["before", 1], ["after", 1]]);
});

test("morning and afternoon can share one space; a full day needs both free together", () => {
  const morning = allocateSpaceSections(room, [slot("morning")], []);
  const afternoon = allocateSpaceSections(room, [slot("afternoon")], morning.reservations);
  assert.equal(afternoon.reservations?.[0].spaceNumber, 1);
  const split = [{ date: slot("day").date, section: "am", spaceNumber: 1 }, { date: slot("day").date, section: "pm", spaceNumber: 2 }];
  assert.deepEqual(allocateSpaceSections(room, [slot("day")], split), { unavailableDate: "2026-09-28" });
});

test("before and after school use independent offered sections and cannot exceed capacity", () => {
  assert.deepEqual(sectionsFor(slot("none", true, true)), ["before", "after"]);
  const first = allocateSpaceSections(room, [slot("none", true)], []);
  assert.equal(first.reservations?.[0].spaceNumber, 1);
  assert.deepEqual(allocateSpaceSections(room, [slot("none", true)], first.reservations), { unavailableDate: "2026-09-28" });
  assert.equal(allocateSpaceSections(room, [slot("none", false, true)], first.reservations).reservations?.[0].spaceNumber, 1);
});

test("four week window starts on Monday and contains 28 dates across month boundaries", () => {
  const start = firstMonday("2026-09-25");
  assert.equal(start, "2026-09-21");
  assert.equal(addDate(start, 27), "2026-10-18");
});

test("guardian answers retain Admin placement and show the selected care hours", () => {
  const intake = { childFirst: "Ava", childLast: "Doe", childDob: "2023-01-02", startDate: "2026-09-28", ageGroup: "Preschool", careType: "Licensed child care centre", roomName: "Preschool 1", guardianName: "Pat Doe", guardianEmail: "pat@example.com", guardianPhone: "555-0123", mode: "custom", hours: defaultCareHours(), slots: [slot("day", true)] };
  const answers = intakeAnswers(intake, { child_first: "Changed", guardians: [{ name: "Changed", relationship: "Other", phone: "0", email: "", address: "" }, { name: "Second guardian", relationship: "Parent", phone: "555-9999", email: "", address: "" }] });
  assert.equal(answers.child_first, "Ava");
  assert.equal(answers.guardians[0].name, "Pat Doe");
  assert.equal(answers.guardians[1].name, "Second guardian");
  assert.match(scheduleSummary(intake), /Day: 08:00–17:00/);
  assert.match(answers.schedule, /Before School: 07:00–09:00/);
});
