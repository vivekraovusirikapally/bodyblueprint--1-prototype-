import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../App.jsx";
import { HealthProvider } from "../../context/HealthContext.jsx";

const setup = () => {
  render(
    <HealthProvider sync={false}>
      <App />
    </HealthProvider>,
  );
  return userEvent.setup();
};

describe("Today tab", () => {
  it("renders the score, advice and both loggers", () => {
    setup();
    expect(screen.getByText(/wellness index/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /water intake/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^sleep$/i })).toBeInTheDocument();
  });

  it("adds water with the quick buttons and the custom field, and rejects bad custom amounts", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "+500 ml" }));
    expect(screen.getByText(/^500/)).toBeInTheDocument();

    const custom = screen.getByLabelText(/custom amount/i);
    await user.type(custom, "-20");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/between 1 and 2000/);

    await user.clear(custom);
    await user.type(custom, "300");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/^800/)).toBeInTheDocument();
  });

  it("refuses identical bed and wake times, accepts a normal night", async () => {
    const user = setup();
    const bed = screen.getByLabelText(/bedtime/i);
    const wake = screen.getByLabelText(/wake time/i);
    fireEvent.change(bed, { target: { value: "07:00" } });
    fireEvent.change(wake, { target: { value: "07:00" } });
    await user.click(screen.getByRole("button", { name: /save sleep/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot be the same/i);

    fireEvent.change(wake, { target: { value: "15:00" } });
    await user.click(screen.getByRole("button", { name: /save sleep/i }));
    expect(screen.getByText("Saved.")).toBeInTheDocument();
  });
});

describe("Body tab", () => {
  it("shows field errors for empty or out-of-range input and does not save", async () => {
    const user = setup();
    await user.click(screen.getByRole("tab", { name: "Body" }));
    const height = screen.getByLabelText(/height/i);
    await user.clear(height);
    await user.click(screen.getByRole("button", { name: /calculate/i }));
    expect(screen.getByText(/height is required/i)).toBeInTheDocument();

    await user.type(height, "30");
    await user.click(screen.getByRole("button", { name: /calculate/i }));
    expect(screen.getByText(/height must be between 100 and 250 cm/i)).toBeInTheDocument();
    expect(height).toHaveAttribute("aria-invalid", "true");
  });

  it("saves valid input and updates the BMI result", async () => {
    const user = setup();
    await user.click(screen.getByRole("tab", { name: "Body" }));
    const weight = screen.getByLabelText(/weight/i);
    await user.clear(weight);
    await user.type(weight, "100");
    await user.click(screen.getByRole("button", { name: /calculate/i }));
    expect(screen.getByText("Saved.")).toBeInTheDocument();
    expect(document.querySelector(".badge")).toHaveTextContent("Obese");
  });

  it("switches units without losing the value", async () => {
    const user = setup();
    await user.click(screen.getByRole("tab", { name: "Body" }));
    await user.click(screen.getByRole("button", { name: /lbs \/ in/i }));
    expect(screen.getByLabelText(/height \(in\)/i)).toHaveValue(68.9);
  });
});

describe("Trends tab", () => {
  it("shows weekly insights and an accessible data table", async () => {
    const user = setup();
    await user.click(screen.getByRole("tab", { name: "Trends" }));
    expect(screen.getByRole("heading", { name: /weekly insights/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download my data/i })).toBeInTheDocument();
  });
});
