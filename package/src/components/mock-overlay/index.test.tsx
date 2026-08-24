import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MockOverlay, resolveMockUrl } from "./index";

describe("resolveMockUrl", () => {
  const config = {
    routes: {
      "/home": "/mocks/home.png",
      "/home/settings": "/mocks/settings.png",
    },
  };

  it("returns the mock URL for an exact pathname match", () => {
    expect(resolveMockUrl(config, "/home")).toBe("/mocks/home.png");
  });

  it("tolerates trailing slashes", () => {
    expect(resolveMockUrl(config, "/home/settings/")).toBe(
      "/mocks/settings.png",
    );
  });

  it("returns null for unmapped routes", () => {
    expect(resolveMockUrl(config, "/unknown")).toBeNull();
  });

  it("returns null without a config", () => {
    expect(resolveMockUrl(undefined, "/home")).toBeNull();
  });

  it("supports a resolver function", () => {
    const fn = {
      routes: (pathname: string) =>
        pathname === "/x" ? "/mocks/x.png" : null,
    };
    expect(resolveMockUrl(fn, "/x")).toBe("/mocks/x.png");
    expect(resolveMockUrl(fn, "/y")).toBeNull();
  });
});

describe("MockOverlay", () => {
  const baseProps = {
    url: "/mocks/home.png",
    opacity: 0.5,
    onOpacityChange: () => {},
    fitWidth: true,
    onFitWidthChange: () => {},
    onClose: () => {},
  };

  it("renders the mock image with the given opacity", () => {
    render(<MockOverlay {...baseProps} />);
    const img = document.querySelector(
      "[data-agentation-mock-overlay] img",
    ) as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("/mocks/home.png");
    expect(img.style.opacity).toBe("0.5");
  });

  it("calls onOpacityChange when the slider moves", () => {
    const onOpacityChange = vi.fn();
    render(<MockOverlay {...baseProps} onOpacityChange={onOpacityChange} />);
    fireEvent.change(screen.getByLabelText("Mock overlay opacity"), {
      target: { value: "80" },
    });
    expect(onOpacityChange).toHaveBeenCalledWith(0.8);
  });

  it("calls onClose from the panel close button", () => {
    const onClose = vi.fn();
    render(<MockOverlay {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Hide mock overlay"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error state instead of the image when loading fails", () => {
    render(<MockOverlay {...baseProps} />);
    const img = document.querySelector(
      "[data-agentation-mock-overlay] img",
    ) as HTMLImageElement;
    fireEvent.error(img);
    expect(
      document.querySelector("[data-agentation-mock-overlay]"),
    ).toBeNull();
    expect(screen.getByText("image failed to load")).not.toBeNull();
  });
});
