import GUI from "lil-gui";

export interface Tunable {
  /** The setting's name in SCENE_SETTINGS, also shown as its label. */
  name: string;
  min: number;
  max: number;
  step: number;
  /** Applies a new value to the running scene. */
  apply: (value: number) => void;
}

/**
 * A panel for adjusting the running scene by hand, opened with `?tune`. "Copy values" puts the
 * current values on the clipboard as JSON, ready to paste into settings.ts.
 */
export function openTuningPanel(initial: Readonly<Record<string, number>>, tunables: Tunable[]) {
  const values: Record<string, number> = Object.fromEntries(
    tunables.map((tunable) => [tunable.name, initial[tunable.name] ?? tunable.min]),
  );
  const panel = new GUI({ title: "Tune the scene" });
  for (const tunable of tunables) {
    panel
      .add(values, tunable.name, tunable.min, tunable.max, tunable.step)
      .onChange((value: number) => {
        tunable.apply(value);
      });
  }

  const actions = {
    copyValues: () => {
      const json = JSON.stringify(values, null, 2);
      navigator.clipboard.writeText(json).then(
        () => {
          copyButton.name("Copied");
          setTimeout(() => copyButton.name("Copy values"), 1500);
        },
        // Clipboard access can be refused; show the values to copy by hand instead.
        () => {
          prompt("Copy these values", json);
        },
      );
    },
  };
  const copyButton = panel.add(actions, "copyValues").name("Copy values");
}
