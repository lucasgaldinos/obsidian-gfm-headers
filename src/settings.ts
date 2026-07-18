/**
 * Plugin Settings — User-Customizable Link Affixes.
 *
 * Provides a settings tab in Obsidian's settings UI that allows users to
 * configure a prefix and suffix character to be prepended/appended to GFM
 * heading links during autocomplete. These affixes are purely cosmetic —
 * they are stripped during slug resolution so navigation still works.
 *
 * ## Settings
 *
 * - **prefix** (string, default `""`): Character prepended to the GFM slug
 *   in autocomplete output. Example: `"§"` → `[[Note#§my-heading]]`.
 * - **suffix** (string, default `""`): Character appended to the GFM slug
 *   in autocomplete output. Example: `"¶"` → `[[Note#my-heading¶]]`.
 *
 * ## Storage
 *
 * Settings are persisted via Obsidian's `loadData()`/`saveData()` mechanism,
 * which stores a JSON object in the plugin's data directory. The plugin
 * instance exposes settings via `plugin.settings` for access by the editor
 * suggest patch and the slug resolution pipeline.
 */

import { PluginSettingTab, Setting, App } from "obsidian";
import type GfmHeadingLinksPluginImpl from "../main";

/**
 * Serializable settings interface persisted via loadData()/saveData().
 */
export interface GfmSettings {
    prefix: string;
    suffix: string;
    enableWikilinkAlias: boolean;
}

export const DEFAULT_SETTINGS: GfmSettings = {
    prefix: "",
    suffix: "",
    enableWikilinkAlias: true
};

/**
 * Obsidian settings tab with dual support for declarative API (1.13.0+)
 * and legacy imperative API (< 1.13.0).
 *
 * - On Obsidian 1.13.0+, `getSettingDefinitions()` is called and `display()` is skipped.
 * - On older versions, `display()` runs as it always has.
 *
 * TASK-1013: Path B (dual support).
 */
export class GfmSettingsTab extends PluginSettingTab {
    plugin: GfmHeadingLinksPluginImpl;

    constructor(app: App, plugin: GfmHeadingLinksPluginImpl) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /** Declarative API — Obsidian 1.13.0+. Auto-binds to this.plugin.settings[key]. */
    getSettingDefinitions() {
        return [
            {
                name: "Link prefix",
                desc: "Character prepended to the GFM slug during autocomplete. Leave empty for no prefix.",
                control: {
                    type: "text" as const,
                    key: "prefix" as const,
                    placeholder: "e.g. §",
                },
            },
            {
                name: "Link suffix",
                desc: "Character appended to the GFM slug during autocomplete. Leave empty for no suffix.",
                control: {
                    type: "text" as const,
                    key: "suffix" as const,
                    placeholder: "e.g. ¶",
                },
            },
            {
                name: "Enable wikilink alias",
                desc: "When using wikilinks ([[), automatically append |Original Heading after the GFM slug. Disable if you prefer bare [[#slug]] without alias.",
                control: {
                    type: "toggle" as const,
                    key: "enableWikilinkAlias" as const,
                },
            },
        ];
    }

    /** Legacy imperative API — Obsidian < 1.13.0 fallback. */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Link prefix")
            .setDesc("Character prepended to the GFM slug during autocomplete. Example: § produces [[Note#§my-heading]]. Leave empty for no prefix.")
            .addText(text => text
                .setPlaceholder("e.g. §")
                .setValue(this.plugin.settings.prefix)
                .onChange(async (value) => {
                    this.plugin.settings.prefix = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Link suffix")
            .setDesc("Character appended to the GFM slug during autocomplete. Example: ¶ produces [[Note#my-heading¶]]. Leave empty for no suffix.")
            .addText(text => text
                .setPlaceholder("e.g. ¶")
                .setValue(this.plugin.settings.suffix)
                .onChange(async (value) => {
                    this.plugin.settings.suffix = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Enable wikilink alias")
            .setDesc("When using wikilinks ([[), automatically append |Original Heading after the GFM slug. Disable if you prefer bare [[#slug]] without alias.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableWikilinkAlias)
                .onChange(async (value) => {
                    this.plugin.settings.enableWikilinkAlias = value;
                    await this.plugin.saveSettings();
                }));
    }
}
