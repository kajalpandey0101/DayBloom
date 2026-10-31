import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import DailyCheckIn from "./DailyCheckIn";
import { api } from "../lib/api";
import type { Activity, CheckIn, CheckInResult } from "../types";

vi.mock("../lib/api", () => ({ api: vi.fn() }));

const activityNames = [
  "LeetCode",
  "GitHub Push",
  "Contribution",
  "Communication Practice",
  "Reel Posting",
  "Form Filling",
  "Workout",
  "Skincare",
  "Master Homework",
  "Gemini Homework",
  "ChatGPT Homework",
];

const activities: Activity[] = activityNames.map((name, index) => ({
  id: index + 1,
  name,
  slug: name.toLowerCase().replace(/ /g, "-"),
  description: `Did I complete ${name} today?`,
  category: index < 3 ? "coding" : index < 6 ? "career" : index < 8 ? "health" : "ai",
  sort_order: (index + 1) * 10,
  is_active: true,
}));

const savedCheckIn: CheckIn = {
  id: 4,
  date: "2026-10-25",
  responses: activities.map((activity, index) => ({
    activity_id: activity.id,
    activity_slug: activity.slug,
    activity_name: activity.name,
    category: activity.category,
    status: index === 0 ? "YES" : index === 1 ? "NO" : index === 2 ? "SKIP" : "YES",
    note: "",
  })),
  summary: { completed: 9, not_completed: 1, skipped: 1, completion_rate: 90 },
};

function mockApi() {
  vi.mocked(api).mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === "/activities/") return activities as never;
    if (path === "/checkins/today/") {
      return { date: "2026-10-25", checkin: null } satisfies CheckInResult as never;
    }
    if (path.startsWith("/checkins/") && options?.method === "PUT") return savedCheckIn as never;
    throw new Error(`Unexpected API call: ${path}`);
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DailyCheckIn", () => {
  it("renders all eleven activities and starts unanswered", async () => {
    mockApi();
    render(<MemoryRouter><DailyCheckIn /></MemoryRouter>);

    for (const name of activityNames) {
      expect(await screen.findByRole("heading", { name })).toBeInTheDocument();
    }
    expect(document.querySelector(".progress-top")?.textContent).toContain("0 of 11 completed");
    expect(screen.getByText("11 still to answer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Today’s Progress" })).toBeDisabled();
  });

  it("records Yes, No and Skip answers and confirms before saving", async () => {
    mockApi();
    render(<MemoryRouter><DailyCheckIn /></MemoryRouter>);
    await screen.findByRole("heading", { name: "LeetCode" });

    fireEvent.click(screen.getByRole("button", { name: "LeetCode: Yes, completed" }));
    fireEvent.click(screen.getByRole("button", { name: "GitHub Push: No, not today" }));
    fireEvent.click(screen.getByRole("button", { name: "Contribution: Not tracked / Skip" }));
    for (const activity of activities.slice(3)) {
      fireEvent.click(screen.getByRole("button", { name: `${activity.name}: Yes, completed` }));
    }

    const saveButton = screen.getByRole("button", { name: "Save Today’s Progress" });
    expect(saveButton).toBeEnabled();
    expect(screen.getByText("11 of 11 answered")).toBeInTheDocument();

    await userEvent.click(saveButton);
    expect(screen.getByRole("dialog", { name: "Save your progress?" })).toBeInTheDocument();
    expect(screen.getByText(/save your answers for 25 October 2026/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, save it" })).toBeEnabled();
  }, 15000);

  it("restores saved answers and notes for an existing date", async () => {
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === "/activities/") return activities as never;
      return { date: "2026-10-25", checkin: savedCheckIn } as never;
    });
    render(<MemoryRouter><DailyCheckIn /></MemoryRouter>);
    await screen.findByText(/Your progress for/);
    expect(screen.getByText("9/11")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();

    const group = screen.getByRole("group", { name: "Answer for LeetCode" });
    expect(within(group).getByRole("button", { name: "LeetCode: Yes, completed" })).toHaveAttribute("aria-pressed", "true");
  });
});
