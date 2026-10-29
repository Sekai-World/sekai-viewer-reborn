import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MusicVocal } from "#lib/domain/music-detail.js";
import MusicVocalSelector from "./MusicVocalSelector.svelte";

vi.mock("#lib/assets/characters.js", () => ({
  getLocalCharacterThumbnailAssetURL: (characterId: number) => `/characters/${characterId}.png`
}));

const vocal = (overrides: Partial<MusicVocal> = {}): MusicVocal => ({
  id: "v1",
  musicId: "8",
  vocalType: "Original",
  overrideChara: null,
  characters: null,
  assetBundleName: "v1",
  ...overrides
});

const props = {
  vocals: [vocal()],
  selectedVocalId: "v1",
  vocalLabel: "Vocals",
  vocalTypeLabel: "Type",
  vocalCharacterLabel: "Character",
  lockedVocalLabel: "Fixed vocal version",
  noVocalsLabel: "No vocals",
  onSelect: vi.fn()
};

const vocalGroup = (name: string): HTMLElement =>
  screen.getByRole("group", { name: `Type: ${name}` });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("MusicVocalSelector character ownership", () => {
  it("uses individual supplied names for tooltips across namespaces and a localized fallback", () => {
    render(MusicVocalSelector, {
      ...props,
      vocals: [
        vocal({
          characters: [
            {
              characterId: 3,
              unit: "light_sound",
              characterType: "game_character",
              name: "Game singer"
            },
            {
              characterId: 3,
              unit: "none",
              characterType: "outside_character",
              name: "External singer"
            },
            { characterId: 4, unit: "none", characterType: null, name: null }
          ]
        })
      ]
    });
    const group = vocalGroup("Original");
    expect(group.querySelector("img")?.closest("[title]")?.getAttribute("title")).toBe(
      "Game singer"
    );
    expect(
      group
        .querySelector('[data-character-type="outside_character"]')
        ?.closest("[title]")
        ?.getAttribute("title")
    ).toBe("External singer");
    expect(
      group
        .querySelector('[data-character-type="unknown"]')
        ?.closest("[title]")
        ?.getAttribute("title")
    ).toBe("Character");
    expect(group.querySelector('[title^="Type:"]')).toBeNull();
    expect(group.querySelector('[title="3"]')).toBeNull();
    const button = screen.getByRole("button", { name: "Original" });
    expect(button.classList.contains("cursor-pointer")).toBe(true);
    expect(button.classList.contains("disabled:cursor-default")).toBe(true);
    expect(button.classList.contains("focus-visible:outline-2")).toBe(true);
    expect(button.classList.contains("btn")).toBe(false);
  });

  it("keeps same-ID game and non-game characters distinct and never borrows game art or color", () => {
    render(MusicVocalSelector, {
      ...props,
      vocals: [
        vocal({
          characters: [
            { characterId: 3, unit: "light_sound" },
            { characterId: 3, unit: "light_sound", characterType: "game_character" },
            { characterId: 3, unit: "none", characterType: null },
            { characterId: 3, unit: "none", characterType: "outside_character" },
            { characterId: 3, unit: "none", characterType: "unknown_character" }
          ]
        })
      ]
    });
    const group = vocalGroup("Original");
    expect(group.querySelectorAll('img[src="/characters/3.png"]')).toHaveLength(2);
    for (const type of ["outside_character", "unknown_character", "unknown"]) {
      const fallback = group.querySelector(`[data-character-type="${type}"]`);
      expect(fallback?.getAttribute("data-character-id")).toBe("3");
      expect(fallback?.textContent?.trim()).toBe("?");
      expect(fallback?.querySelector("img")).toBeNull();
      expect(fallback?.hasAttribute("style")).toBe(false);
      expect(fallback?.getAttribute("aria-hidden")).toBe("true");
    }
    expect(group.querySelector("a")).toBeNull();
  });

  it("renders each vocal's own characters in its selected or unselected pill", async () => {
    render(MusicVocalSelector, {
      ...props,
      vocals: [
        vocal({ characters: [{ characterId: 1, unit: "light_sound" }] }),
        vocal({
          id: "v2",
          vocalType: "Another",
          characters: [{ characterId: 2, unit: "idol" }]
        })
      ]
    });

    const original = vocalGroup("Original");
    const another = vocalGroup("Another");
    expect(original.querySelector('button[aria-pressed="true"]')).not.toBeNull();
    expect(another.querySelector('button[aria-pressed="false"]')).not.toBeNull();
    expect(original.classList.contains("btn-primary")).toBe(true);
    expect(another.classList.contains("btn-ghost")).toBe(true);
    expect(original.querySelector('img[src="/characters/1.png"]')).not.toBeNull();
    expect(original.querySelector('img[src="/characters/2.png"]')).toBeNull();
    expect(another.querySelector('img[src="/characters/2.png"]')).not.toBeNull();
    expect(another.querySelector('img[src="/characters/1.png"]')).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    await fireEvent.click(another.querySelector("img")!);
    expect(props.onSelect).toHaveBeenCalledWith("v2");
  });

  it("uses overrideChara instead of characters and makes avatars decorative within the vocal button", () => {
    render(MusicVocalSelector, {
      ...props,
      vocals: [
        vocal({
          characters: [{ characterId: 1, unit: "light_sound" }],
          overrideChara: [{ characterId: 4, unit: "vivid" }]
        })
      ]
    });

    const group = vocalGroup("Original");
    const button = group.querySelector("button");
    const avatars = group.querySelector('span[aria-label="Character"]');
    expect(group.querySelector('img[src="/characters/4.png"]')).not.toBeNull();
    expect(group.querySelector('img[src="/characters/1.png"]')).toBeNull();
    expect(button?.parentElement).toBe(group);
    expect(button?.contains(avatars ?? null)).toBe(true);
    expect(group.querySelector("a")).toBeNull();
  });

  it("preserves disabled fixed-vocal selection and its title", () => {
    render(MusicVocalSelector, {
      ...props,
      selectedVocalId: "v2",
      lockedVocalId: "v2",
      vocals: [vocal(), vocal({ id: "v2", vocalType: "Another" })]
    });

    const original = screen.getByRole("button", { name: "Original" });
    const another = screen.getByRole("button", { name: "Another" });
    expect(original).toHaveProperty("disabled", true);
    expect(another).toHaveProperty("disabled", true);
    expect(another.getAttribute("aria-pressed")).toBe("true");
    expect(original.classList.contains("text-inherit")).toBe(true);
    expect(another.classList.contains("text-inherit")).toBe(true);
    expect(original.classList.contains("btn")).toBe(false);
    expect(another.classList.contains("btn-ghost")).toBe(false);
    expect(original.classList.contains("focus-visible:outline-2")).toBe(true);
    expect(original.getAttribute("title")).toBe("Fixed vocal version");
    expect(another.getAttribute("title")).toBe("Fixed vocal version");
  });

  it("keeps non-positive characters decorative and omits avatars when none exist", () => {
    render(MusicVocalSelector, {
      ...props,
      vocals: [
        vocal({
          overrideChara: [{ characterId: 0, unit: "none" }]
        }),
        vocal({ id: "v2", vocalType: "No character", characters: null })
      ]
    });

    const npc = vocalGroup("Original");
    const noCharacter = vocalGroup("No character");
    expect(npc.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(1);
    expect(npc.querySelector("a")).toBeNull();
    expect(noCharacter.querySelector('span[aria-label="Character"]')).toBeNull();
    expect(noCharacter.querySelector("a")).toBeNull();
  });

  it("inherits the pill foreground and switches the pressed vocal", async () => {
    const onSelect = vi.fn();
    const vocals = [vocal(), vocal({ id: "v2", vocalType: "Another" })];
    const { rerender } = render(MusicVocalSelector, {
      ...props,
      onSelect,
      vocals
    });

    const original = screen.getByRole("button", { name: "Original" });
    const another = screen.getByRole("button", { name: "Another" });
    expect(original.getAttribute("aria-pressed")).toBe("true");
    expect(another.getAttribute("aria-pressed")).toBe("false");
    expect(original.classList.contains("text-inherit")).toBe(true);
    expect(another.classList.contains("text-inherit")).toBe(true);

    await fireEvent.click(another);
    expect(onSelect).toHaveBeenCalledWith("v2");

    await rerender({ ...props, onSelect, vocals, selectedVocalId: "v2" });
    expect(screen.getByRole("button", { name: "Original" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    expect(screen.getByRole("button", { name: "Another" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(vocalGroup("Original").classList.contains("btn-ghost")).toBe(true);
    expect(vocalGroup("Another").classList.contains("btn-primary")).toBe(true);
  });
});

function phoneViewport() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(max-width: 639px)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
}

describe("MusicVocalSelector mobile dropdown", () => {
  const longLabel = "A complete, deliberately long vocal version label";
  const vocals = [
    vocal({
      characters: [
        {
          characterId: 3,
          unit: "none",
          characterType: "outside_character",
          name: "External singer"
        }
      ]
    }),
    vocal({
      id: "v2",
      vocalType: longLabel,
      characters: [{ characterId: 9, unit: "none" }],
      overrideChara: [
        { characterId: 3, unit: "light_sound", name: "Game singer" },
        { characterId: 25, unit: "piapro", name: "Singer 25" },
        { characterId: 1, unit: "light_sound", name: "Singer 1" },
        { characterId: 2, unit: "light_sound", name: "Singer 2" },
        { characterId: 4, unit: "light_sound", name: "Singer 4" }
      ]
    })
  ];

  it("shows complete option labels and every per-vocal avatar, and selecting an avatar changes only its vocal", async () => {
    phoneViewport();
    const onSelect = vi.fn();
    const { rerender } = render(MusicVocalSelector, { ...props, vocals, onSelect });
    const trigger = await screen.findByRole("button", { name: "Vocals: Original" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("group", { name: "Type: Original" })).toBeNull();
    await fireEvent.click(trigger);
    const menu = await screen.findByRole("listbox", { name: "Vocals" });
    const original = within(menu).getByRole("option", { name: "Original" });
    const another = within(menu).getByRole("option", { name: longLabel });
    expect(original.getAttribute("aria-selected")).toBe("true");
    expect(
      original
        .querySelector('[data-character-type="outside_character"]')
        ?.closest("[title]")
        ?.getAttribute("title")
    ).toBe("External singer");
    expect(original.querySelector("img")).toBeNull();
    expect(another.textContent).toContain(longLabel);
    expect(another.querySelectorAll("img")).toHaveLength(5);
    expect(another.querySelector('img[src="/characters/9.png"]')).toBeNull();
    expect(menu.querySelectorAll("a")).toHaveLength(0);
    await fireEvent.click(another.querySelector("img")!);
    expect(onSelect).toHaveBeenCalledWith("v2");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await rerender({ ...props, vocals, onSelect, selectedVocalId: "v2" });
    expect(screen.getByRole("button", { name: `Vocals: ${longLabel}` })).toBe(trigger);
  });

  it("supports arrow/Home/End focus, Escape/Tab and outside-pointer closing", async () => {
    phoneViewport();
    render(MusicVocalSelector, { ...props, vocals });
    const trigger = await screen.findByRole("button", { name: "Vocals: Original" });
    await fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const menu = await screen.findByRole("listbox");
    const options = within(menu).getAllByRole("option");
    await waitFor(() => expect(document.activeElement).toBe(options[0]));
    await fireEvent.keyDown(options[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(options[1]);
    await fireEvent.keyDown(options[1]!, { key: "Home" });
    expect(document.activeElement).toBe(options[0]);
    await fireEvent.keyDown(options[0]!, { key: "End" });
    expect(document.activeElement).toBe(options[1]);
    await fireEvent.keyDown(options[1]!, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await fireEvent.click(trigger);
    await fireEvent.keyDown(await screen.findByRole("listbox"), { key: "Tab" });
    expect(screen.queryByRole("listbox")).toBeNull();
    await fireEvent.click(trigger);
    await fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("ignores a queued unchanged window scroll after opening, but closes on an actual scroll", async () => {
    phoneViewport();
    render(MusicVocalSelector, { ...props, vocals });
    await fireEvent.click(await screen.findByRole("button", { name: "Vocals: Original" }));
    const menu = await screen.findByRole("listbox");
    const selected = within(menu).getByRole("option", { name: "Original" });
    await waitFor(() => expect(document.activeElement).toBe(selected));
    await fireEvent.scroll(window);
    expect(screen.getByRole("listbox")).toBe(menu);
    expect(document.activeElement).toBe(selected);
    vi.stubGlobal("scrollY", 24);
    expect(window.scrollY).toBe(24);
    await fireEvent.scroll(window);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes an open menu and disables its selected trigger when MV locks the vocal", async () => {
    phoneViewport();
    const { rerender } = render(MusicVocalSelector, { ...props, vocals });
    const trigger = await screen.findByRole("button", { name: "Vocals: Original" });
    await fireEvent.click(trigger);
    expect(await screen.findByRole("listbox")).toBeTruthy();
    await rerender({ ...props, vocals, selectedVocalId: "v2", lockedVocalId: "v2" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger).toHaveProperty("disabled", true);
    expect(trigger.getAttribute("title")).toBe("Fixed vocal version");
    await fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
