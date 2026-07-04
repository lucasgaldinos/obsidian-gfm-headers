import { Plugin } from "obsidian";
import { patchWorkspace } from "./src/patch-workspace";

export default class GfmHeadingLinksPlugin extends Plugin {
  private unpatch: (() => void) | null = null;

  async onload() {
    this.unpatch = patchWorkspace(this);
  }

  onunload() {
    if (this.unpatch) {
      this.unpatch();
      this.unpatch = null;
    }
  }
}


